"""S3-compatible adapter shared by MinIO and Cloudflare R2."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from threading import Event
from typing import TYPE_CHECKING

import boto3
from boto3.exceptions import S3UploadFailedError
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from cliphunter.domain.errors import ServiceUnavailable
from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.io import run_io

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client


class S3ObjectStorage:
    def __init__(self, client: S3Client, bucket: str, *, transfer_timeout: float = 300) -> None:
        self.client = client
        self.bucket = bucket
        self.transfer_timeout = transfer_timeout

    async def upload(self, path: Path, key: str, content_type: str) -> None:
        cancelled = Event()

        def transfer() -> None:
            deadline = time.monotonic() + self.transfer_timeout

            def progress(bytes_transferred: int) -> None:
                if cancelled.is_set() or time.monotonic() > deadline:
                    raise TimeoutError("S3 transfer deadline exceeded")

            self.client.upload_file(
                str(path),
                self.bucket,
                key,
                ExtraArgs={"ContentType": content_type},
                Callback=progress,
                Config=TransferConfig(
                    multipart_threshold=8 * 1024 * 1024,
                    multipart_chunksize=8 * 1024 * 1024,
                    max_concurrency=1,
                    use_threads=False,
                ),
            )

        try:
            await run_io(transfer, on_cancel=cancelled.set)
        except (BotoCoreError, ClientError, S3UploadFailedError, TimeoutError):
            raise ServiceUnavailable("Не удалось сохранить видео в хранилище") from None

    async def delete(self, key: str) -> None:
        try:
            await run_io(lambda: self.client.delete_object(Bucket=self.bucket, Key=key))
        except (BotoCoreError, ClientError):
            raise ServiceUnavailable("Хранилище временно недоступно") from None

    async def ensure_bucket(self) -> None:
        """Explicit local bootstrap; never called by API startup or for production R2."""

        def ensure() -> None:
            try:
                self.client.head_bucket(Bucket=self.bucket)
            except ClientError as exc:
                if exc.response["Error"]["Code"] not in ("404", "NoSuchBucket", "NotFound"):
                    raise
                self.client.create_bucket(Bucket=self.bucket)

        try:
            await run_io(ensure)
        except (BotoCoreError, ClientError):
            raise ServiceUnavailable("Не удалось подготовить локальный бакет") from None

    def close(self) -> None:
        self.client.close()


def create_storage(settings: Settings) -> S3ObjectStorage | None:
    if not settings.s3_endpoint_url:
        return None
    assert settings.s3_access_key is not None and settings.s3_secret_key is not None
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"mode": "standard", "total_max_attempts": 3},
            connect_timeout=5,
            read_timeout=60,
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )
    return S3ObjectStorage(
        client, settings.s3_bucket, transfer_timeout=settings.s3_transfer_timeout_seconds
    )


async def bootstrap_local_bucket() -> None:
    settings = Settings()
    if settings.app_env != "development" or settings.s3_endpoint_url != "http://minio:9000":
        raise RuntimeError("Создание бакета разрешено только для локального MinIO в Compose")
    storage = create_storage(settings)
    assert storage is not None
    try:
        await storage.ensure_bucket()
    finally:
        storage.close()


if __name__ == "__main__":
    asyncio.run(bootstrap_local_bucket())
