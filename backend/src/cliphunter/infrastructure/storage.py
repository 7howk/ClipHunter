"""S3-compatible adapter shared by MinIO and Cloudflare R2."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
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
    def __init__(
        self,
        client: S3Client,
        bucket: str,
        *,
        public_client: S3Client | None = None,
        transfer_timeout: float = 300,
    ) -> None:
        self.client = client
        self.public_client = public_client if public_client is not None else client
        self.bucket = bucket
        self.transfer_timeout = transfer_timeout

    async def upload(
        self, path: Path, key: str, content_type: str, *, filename: str | None = None
    ) -> None:
        fields = {"ContentType": content_type}
        if filename is not None:
            fields["ContentDisposition"] = f'attachment; filename="{filename}"'
        await self._transfer(
            lambda config, callback: self.client.upload_file(
                str(path),
                self.bucket,
                key,
                ExtraArgs=fields,
                Callback=callback,
                Config=config,
            ),
            "Не удалось сохранить видео в хранилище",
        )

    async def download(self, key: str, path: Path) -> None:
        await self._transfer(
            lambda config, callback: self.client.download_file(
                self.bucket, key, str(path), Callback=callback, Config=config
            ),
            "Не удалось получить видео из хранилища",
        )

    async def _transfer(
        self, operation: Callable[[TransferConfig, Callable[[int], None]], None], message: str
    ) -> None:
        cancelled = Event()

        def transfer() -> None:
            deadline = time.monotonic() + self.transfer_timeout

            def progress(bytes_transferred: int) -> None:
                if cancelled.is_set() or time.monotonic() > deadline:
                    raise TimeoutError("S3 transfer deadline exceeded")

            operation(
                TransferConfig(
                    multipart_threshold=8 * 1024 * 1024,
                    multipart_chunksize=8 * 1024 * 1024,
                    max_concurrency=1,
                    use_threads=False,
                ),
                progress,
            )

        try:
            await run_io(transfer, on_cancel=cancelled.set)
        except (BotoCoreError, ClientError, S3UploadFailedError, TimeoutError):
            raise ServiceUnavailable(message) from None

    async def delete(self, key: str) -> None:
        try:
            await run_io(lambda: self.client.delete_object(Bucket=self.bucket, Key=key))
        except (BotoCoreError, ClientError):
            raise ServiceUnavailable("Хранилище временно недоступно") from None

    def sign_download(self, key: str, filename: str, *, expires_in: int) -> str:
        try:
            return self.public_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{filename}"',
                },
                ExpiresIn=expires_in,
            )
        except (BotoCoreError, ClientError):
            raise ServiceUnavailable("Не удалось подготовить ссылку для скачивания") from None

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
        if self.public_client is not self.client:
            self.public_client.close()


def create_storage(settings: Settings) -> S3ObjectStorage | None:
    if not settings.s3_endpoint_url:
        return None
    client = create_s3_client(settings, settings.s3_endpoint_url)
    public_client = (
        create_s3_client(settings, settings.s3_public_endpoint_url)
        if settings.s3_public_endpoint_url
        and settings.s3_public_endpoint_url != settings.s3_endpoint_url
        else client
    )
    return S3ObjectStorage(
        client,
        settings.s3_bucket,
        public_client=public_client,
        transfer_timeout=settings.s3_transfer_timeout_seconds,
    )


def create_s3_client(settings: Settings, endpoint: str) -> S3Client:
    assert settings.s3_access_key is not None and settings.s3_secret_key is not None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
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
