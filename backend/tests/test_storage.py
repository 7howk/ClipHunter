import asyncio
import time
from pathlib import Path
from threading import Event
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from cliphunter.domain.errors import ServiceUnavailable
from cliphunter.infrastructure.storage import S3ObjectStorage


@pytest.mark.anyio
async def test_s3_adapter_uses_bounded_transfer(tmp_path: Path) -> None:
    path = tmp_path / "video"
    path.write_bytes(b"abc")
    client = MagicMock()
    storage = S3ObjectStorage(client, "bucket")
    await storage.upload(path, "projects/id/original/id.mp4", "video/mp4")
    args = client.upload_file.call_args
    assert args.args == (str(path), "bucket", "projects/id/original/id.mp4")
    assert args.kwargs["ExtraArgs"] == {"ContentType": "video/mp4"}
    config = args.kwargs["Config"]
    assert config.multipart_chunksize == 8 * 1024 * 1024
    assert config.max_concurrency == 1 and not config.use_threads


@pytest.mark.anyio
async def test_s3_errors_hide_provider_details(tmp_path: Path) -> None:
    client = MagicMock()
    client.upload_file.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "secret endpoint and credentials"}},
        "PutObject",
    )
    with pytest.raises(ServiceUnavailable) as error:
        await S3ObjectStorage(client, "bucket").upload(tmp_path / "x", "key", "video/mp4")
    assert "secret" not in str(error.value)


@pytest.mark.anyio
async def test_bucket_bootstrap_is_idempotent_and_does_not_ignore_forbidden() -> None:
    client = MagicMock()
    storage = S3ObjectStorage(client, "bucket")
    await storage.ensure_bucket()
    client.create_bucket.assert_not_called()
    client.head_bucket.side_effect = ClientError({"Error": {"Code": "404"}}, "HeadBucket")
    await storage.ensure_bucket()
    client.create_bucket.assert_called_once_with(Bucket="bucket")
    client.head_bucket.side_effect = ClientError({"Error": {"Code": "403"}}, "HeadBucket")
    with pytest.raises(ServiceUnavailable):
        await storage.ensure_bucket()


@pytest.mark.anyio
async def test_cancellation_waits_for_sdk_before_temp_file_can_be_removed(tmp_path: Path) -> None:
    path = tmp_path / "video"
    path.write_bytes(b"abc")
    started, finished = Event(), Event()
    client = MagicMock()

    def transfer(*args: object, **kwargs: object) -> None:
        started.set()
        try:
            time.sleep(0.05)
            assert path.exists(), "Caller must preserve the file until the SDK worker exits"
            kwargs["Callback"](3)
        finally:
            finished.set()

    client.upload_file.side_effect = transfer
    task = asyncio.create_task(S3ObjectStorage(client, "bucket").upload(path, "key", "video/mp4"))
    await asyncio.to_thread(started.wait)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert finished.is_set()
