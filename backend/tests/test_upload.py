import asyncio
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from cliphunter.application.upload import UploadInput, UploadVideo
from cliphunter.domain.entities import VideoProject
from cliphunter.domain.errors import (
    Conflict,
    InsufficientStorage,
    InvalidInput,
    ServiceUnavailable,
    UnsupportedMedia,
    UploadTimedOut,
    UploadTooLarge,
)
from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.uploads import FFprobeVideoInspector, TemporaryUploadBuffer
from cliphunter.main import create_app
from tests.fakes import MemoryUnitOfWork


async def chunks(*values: bytes) -> AsyncIterator[bytes]:
    for value in values:
        yield value


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.fail = False

    async def upload(self, path: Path, key: str, content_type: str) -> None:
        self.objects[key] = path.read_bytes()
        if self.fail:
            raise ServiceUnavailable("Storage failed")

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


@pytest.mark.anyio
async def test_stream_upload_commits_metadata_and_cleans_temp(tmp_path: Path) -> None:
    project = VideoProject(title="Upload")
    store = {project.id: project}
    storage = MemoryStorage()
    buffer = TemporaryUploadBuffer(tmp_path, max_bytes=20, reserve_bytes=0)
    inspector = AsyncMock()
    inspector.inspect.return_value = 2.5
    use_case = UploadVideo(MemoryUnitOfWork(store), buffer, inspector, storage)
    result = await use_case.execute(
        project.id,
        UploadInput(filename="стрим.MP4", content_type="video/mp4"),
        chunks(b"abc", b"def"),
    )
    assert result.status == "uploaded" and result.file_size == 6 and result.duration == 2.5
    assert result.original_filename == "стрим.MP4"
    assert list(storage.objects.values()) == [b"abcdef"]
    assert str(project.id) in next(iter(storage.objects))
    assert not list(tmp_path.iterdir())
    with pytest.raises(Conflict):
        await use_case.execute(
            project.id, UploadInput(filename="a.mp4", content_type="video/mp4"), chunks(b"abc")
        )
    assert len(storage.objects) == 1


@pytest.mark.anyio
async def test_storage_failure_rolls_back_and_removes_partial_object(tmp_path: Path) -> None:
    project = VideoProject(title="Upload")
    store = {project.id: project}
    storage = MemoryStorage()
    storage.fail = True
    inspector = AsyncMock()
    inspector.inspect.return_value = 2
    use_case = UploadVideo(
        MemoryUnitOfWork(store), TemporaryUploadBuffer(tmp_path, 20, 0), inspector, storage
    )
    with pytest.raises(ServiceUnavailable):
        await use_case.execute(
            project.id, UploadInput(filename="a.mp4", content_type="video/mp4"), chunks(b"abc")
        )
    assert store[project.id].status == "created"
    assert not storage.objects and not list(tmp_path.iterdir())


@pytest.mark.anyio
@pytest.mark.parametrize("committed", [False, True])
async def test_commit_failure_is_reconciled_before_object_deletion(
    tmp_path: Path, committed: bool
) -> None:
    project = VideoProject(title="Commit failure")
    store = {project.id: project}

    class FailingCommit(MemoryUnitOfWork):
        async def commit(self) -> None:
            if committed:
                await super().commit()
            raise RuntimeError("Lost COMMIT acknowledgement")

    storage = MemoryStorage()
    inspector = AsyncMock()
    inspector.inspect.return_value = 2
    use_case = UploadVideo(
        FailingCommit(store), TemporaryUploadBuffer(tmp_path, 20, 0), inspector, storage
    )
    data = UploadInput(filename="a.mp4", content_type="video/mp4")
    if committed:
        result = await use_case.execute(project.id, data, chunks(b"abc"))
        assert result.status == "uploaded" and len(storage.objects) == 1
    else:
        with pytest.raises(RuntimeError):
            await use_case.execute(project.id, data, chunks(b"abc"))
        assert store[project.id].status == "created" and not storage.objects
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
@pytest.mark.parametrize(
    "parts,expected,error",
    [
        ([b"abc", b"def"], None, UploadTooLarge),
        ([b"abc"], 10, UploadTooLarge),
        ([b"abc"], 4, InvalidInput),
        ([], None, InvalidInput),
    ],
)
async def test_stream_size_validation_and_cleanup(
    tmp_path: Path, parts: list[bytes], expected: int | None, error: type[Exception]
) -> None:
    buffer = TemporaryUploadBuffer(tmp_path, max_bytes=5, reserve_bytes=0)
    with pytest.raises(error):
        async with buffer.receive(chunks(*parts), expected):
            pytest.fail("Invalid upload must not reach the consumer")
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
async def test_buffer_checks_disk_space(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from collections import namedtuple

    usage = namedtuple("usage", "total used free")
    monkeypatch.setattr(
        "cliphunter.infrastructure.uploads.shutil.disk_usage", lambda _: usage(100, 99, 1)
    )
    with pytest.raises(InsufficientStorage):
        async with TemporaryUploadBuffer(tmp_path, 10, 2).receive(chunks(b"abc"), None):
            pytest.fail("Insufficient disk space")
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
async def test_disconnected_stream_cleans_temp(tmp_path: Path) -> None:
    async def disconnected() -> AsyncIterator[bytes]:
        yield b"abc"
        raise ConnectionError("client disconnected")

    with pytest.raises(ConnectionError):
        async with TemporaryUploadBuffer(tmp_path, 10, 0).receive(disconnected(), None):
            pytest.fail("Disconnected upload")
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
async def test_upload_deadline_rolls_back(tmp_path: Path) -> None:
    async def slow() -> AsyncIterator[bytes]:
        yield b"abc"
        await asyncio.sleep(1)

    project = VideoProject(title="Timeout")
    store = {project.id: project}
    use_case = UploadVideo(
        MemoryUnitOfWork(store),
        TemporaryUploadBuffer(tmp_path, 10, 0),
        AsyncMock(),
        MemoryStorage(),
        timeout=0.01,
    )
    with pytest.raises(UploadTimedOut):
        await use_case.execute(
            project.id, UploadInput(filename="a.mp4", content_type="video/mp4"), slow()
        )
    assert store[project.id].status == "created" and not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "filename,mime,error",
    [
        ("../../a.mp4", "video/mp4", InvalidInput),
        ("C:\\a.mp4", "video/mp4", InvalidInput),
        ("a\x00.mp4", "video/mp4", InvalidInput),
        ("a.exe", "video/mp4", UnsupportedMedia),
        ("a.mp4", "text/plain", UnsupportedMedia),
    ],
)
def test_upload_filename_and_mime_policy(filename: str, mime: str, error: type[Exception]) -> None:
    with pytest.raises(error):
        UploadInput(filename=filename, content_type=mime).validate_format()


@pytest.mark.parametrize(
    "duration,video,format_name,valid",
    [
        (2, True, "mov,mp4", True),
        (0, True, "mov,mp4", False),
        (61, True, "mov,mp4", False),
        (float("nan"), True, "mov,mp4", False),
        (float("inf"), True, "mov,mp4", False),
        (2, False, "mov,mp4", False),
        (2, True, "matroska,webm", False),
    ],
)
def test_ffprobe_metadata_requires_real_video_and_valid_duration(
    duration: float, video: bool, format_name: str, valid: bool
) -> None:
    import json

    metadata = {
        "streams": [{"codec_type": "video", "width": 16, "height": 16}] if video else [],
        "format": {"duration": str(duration), "format_name": format_name},
    }
    inspector = FFprobeVideoInspector(60)
    if valid:
        assert inspector._validate(json.dumps(metadata).encode(), ".mp4") == duration
    else:
        with pytest.raises(InvalidInput):
            inspector._validate(json.dumps(metadata).encode(), ".mp4")


@pytest.mark.anyio
async def test_ffprobe_timeout_kills_child_process(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class SlowProcess:
        returncode = None
        killed = False

        async def communicate(self) -> tuple[bytes, bytes]:
            await asyncio.sleep(1)
            return b"", b""

        def kill(self) -> None:
            self.killed = True

        async def wait(self) -> int:
            self.returncode = -9
            return -9

    process = SlowProcess()
    spawn = AsyncMock(return_value=process)
    monkeypatch.setattr("cliphunter.infrastructure.uploads.asyncio.create_subprocess_exec", spawn)
    with pytest.raises(InvalidInput):
        await FFprobeVideoInspector(60, timeout=0.01).inspect(tmp_path / "safe.upload", ".mp4")
    assert process.killed
    args = spawn.call_args.args
    assert args[0] == "ffprobe" and args[-1] == str(tmp_path / "safe.upload")
    assert "file,pipe" in args


def test_upload_http_contract_and_errors(tmp_path: Path) -> None:
    project = VideoProject(title="HTTP upload")
    store = {project.id: project}
    inspector = AsyncMock()
    inspector.inspect.return_value = 2
    app = create_app(
        Settings(_env_file=None, database_url=None),
        lambda: MemoryUnitOfWork(store),
        storage=MemoryStorage(),
        upload_buffer=TemporaryUploadBuffer(tmp_path, 10, 0),
        video_inspector=inspector,
    )
    url = f"/api/v1/projects/{project.id}/upload?filename=a.mp4"
    with TestClient(app) as client:
        assert (
            client.post(url, content=b"bad", headers={"content-type": "text/plain"}).status_code
            == 415
        )
        assert (
            client.post(
                url, content=b"01234567890", headers={"content-type": "video/mp4"}
            ).status_code
            == 413
        )
        assert (
            client.post(
                f"/api/v1/projects/{uuid4()}/upload?filename=a.mp4",
                content=b"abc",
                headers={"content-type": "video/mp4"},
            ).status_code
            == 404
        )
        response = client.post(url, content=b"abc", headers={"content-type": "video/mp4"})
        assert response.status_code == 200 and response.json()["status"] == "uploaded"
        assert (
            client.post(url, content=b"abc", headers={"content-type": "video/mp4"}).status_code
            == 409
        )
        operation = client.get("/openapi.json").json()["paths"][
            "/api/v1/projects/{project_id}/upload"
        ]["post"]
        assert operation["requestBody"]["content"]["video/mp4"]["schema"]["format"] == "binary"
    assert not list(tmp_path.iterdir())
