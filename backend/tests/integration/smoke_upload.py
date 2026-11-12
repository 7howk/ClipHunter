"""Container smoke test: real ffprobe, chunked HTTP, PostgreSQL and multipart S3.

Run from repository root:
docker compose --env-file .env -f infra/docker-compose.yml exec -T api python - \
    < backend/tests/integration/smoke_upload.py
"""

import asyncio
import hashlib
import http.client
import json
import os
import struct
import subprocess
import tempfile
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import create_async_engine

from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.database.models import VideoProjectModel
from cliphunter.infrastructure.storage import create_storage


def request(method: str, path: str, data: bytes, content_type: str) -> tuple[int, dict]:
    connection = http.client.HTTPConnection(
        "127.0.0.1", int(os.environ.get("APP_PORT", "8000")), timeout=60
    )
    try:
        connection.request(method, path, body=data, headers={"Content-Type": content_type})
        response = connection.getresponse()
        return response.status, json.loads(response.read())
    finally:
        connection.close()


async def main() -> None:
    settings = Settings()
    assert settings.s3_endpoint_url == "http://minio:9000", "Run only against local Compose MinIO"
    assert settings.database_url is not None
    engine = create_async_engine(settings.database_url.get_secret_value())
    storage = create_storage(settings)
    assert storage is not None
    projects: list[UUID] = []
    keys: list[str] = []
    try:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "smoke.mp4"
            subprocess.run(
                [
                    "ffmpeg",
                    "-v",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=s=32x32:r=1",
                    "-t",
                    "1",
                    "-c:v",
                    "mpeg4",
                    "-y",
                    str(path),
                ],
                check=True,
            )
            # A valid MP4 free box makes the fixture exceed the S3 multipart threshold.
            with path.open("ab") as file:
                box_size = 9 * 1024 * 1024
                file.write(struct.pack(">I4s", box_size, b"free"))
                remaining = box_size - 8
                while remaining:
                    block = min(65536, remaining)
                    file.write(b"\0" * block)
                    remaining -= block
            status, project = request(
                "POST", "/api/v1/projects", b'{"title":"Upload smoke"}', "application/json"
            )
            assert status == 201, project
            project_id = UUID(project["id"])
            projects.append(project_id)
            endpoint = f"/api/v1/projects/{project_id}/upload?filename=smoke.mp4"
            connection = http.client.HTTPConnection("127.0.0.1", settings.app_port, timeout=120)
            try:
                with path.open("rb") as file:
                    connection.request(
                        "POST",
                        endpoint,
                        body=file,
                        headers={"Content-Type": "video/mp4"},
                        encode_chunked=True,
                    )
                    response = connection.getresponse()
                    uploaded = json.loads(response.read())
                    assert response.status == 200, uploaded
            finally:
                connection.close()
            assert uploaded["status"] == "uploaded"
            assert uploaded["file_size"] == path.stat().st_size
            assert 0 < uploaded["duration"] <= 2
            status, state = request(
                "GET", f"/api/v1/projects/{project_id}/status", b"", "application/json"
            )
            assert status == 200 and state["status"] == "uploaded"
            status, conflict = request("POST", endpoint, b"bad", "video/mp4")
            assert status == 409, conflict
            async with engine.connect() as connection:
                key = await connection.scalar(
                    select(VideoProjectModel.storage_key).where(VideoProjectModel.id == project_id)
                )
            assert key is not None
            keys.append(key)
            metadata = storage.client.head_object(Bucket=storage.bucket, Key=key)
            assert metadata["ContentLength"] == path.stat().st_size
            assert metadata["ContentType"] == "video/mp4"
            assert "-2" in metadata["ETag"], "Expected a real multipart S3 upload"
            with path.open("rb") as file:
                expected_digest = hashlib.file_digest(file, "sha256").digest()
            body = storage.client.get_object(Bucket=storage.bucket, Key=key)["Body"]
            try:
                digest = hashlib.sha256()
                for block in iter(lambda: body.read(65536), b""):
                    digest.update(block)
                assert digest.digest() == expected_digest
            finally:
                body.close()
            status, invalid_project = request(
                "POST", "/api/v1/projects", b'{"title":"Invalid video smoke"}', "application/json"
            )
            assert status == 201
            invalid_id = UUID(invalid_project["id"])
            projects.append(invalid_id)
            status, error = request(
                "POST",
                f"/api/v1/projects/{invalid_id}/upload?filename=bad.mp4",
                b"not a video",
                "video/mp4",
            )
            assert status == 422, error
            status, unchanged = request(
                "GET", f"/api/v1/projects/{invalid_id}", b"", "application/json"
            )
            assert status == 200 and unchanged["status"] == "created"
            objects = storage.client.list_objects_v2(
                Bucket=storage.bucket, Prefix=f"projects/{invalid_id}/"
            )
            assert objects.get("KeyCount", 0) == 0
            print(
                "OK: chunked upload, ffprobe, PostgreSQL, multipart MinIO, "
                "SHA-256, duplicate and invalid video"
            )
    finally:
        for project_id in projects:
            objects = storage.client.list_objects_v2(
                Bucket=storage.bucket, Prefix=f"projects/{project_id}/"
            )
            for item in objects.get("Contents", []):
                await storage.delete(item["Key"])
        async with engine.begin() as connection:
            await connection.execute(
                delete(VideoProjectModel).where(VideoProjectModel.id.in_(projects))
            )
        storage.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
