"""Compose smoke test with real WebM, ffmpeg, MP4, signed S3 GET and cleanup."""

import asyncio
import json
import subprocess
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from httpx2 import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from cliphunter.domain.entities import Highlight
from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork
from cliphunter.infrastructure.storage import S3ObjectStorage, create_storage


async def seed_highlight(sessions: async_sessionmaker, project_id: UUID) -> UUID:
    async with SqlAlchemyUnitOfWork(sessions) as uow:
        project = await uow.projects.get(project_id, for_update=True)
        assert project is not None
        project.start_processing()
        project.complete_processing(has_highlights=True)
        highlight = Highlight(
            project_id=project_id,
            start_time=0.5,
            end_time=2.0,
            score=94,
            category="reaction",
            title="Тест нарезки",
            description="Синтетическая реплика",
            reason="Проверка очереди",
        )
        await uow.projects.save(project)
        await uow.highlights.add_many([highlight])
        await uow.commit()
    return highlight.id


async def check_download(
    client: AsyncClient, clip_id: str, directory: Path, settings: Settings
) -> None:
    result = await client.get(f"/api/v1/clips/{clip_id}/download")
    assert result.status_code == 200
    signed = result.json()
    expires_at = datetime.fromisoformat(signed["expires_at"])
    assert expires_at > datetime.now(UTC) + timedelta(hours=1)
    url = urlsplit(signed["url"])
    assert settings.s3_public_endpoint_url is not None and settings.s3_endpoint_url is not None
    assert url.netloc == urlsplit(settings.s3_public_endpoint_url).netloc

    # Reach MinIO on the Compose network while preserving the host covered by the signature.
    internal = urlsplit(settings.s3_endpoint_url)
    internal_url = urlunsplit((internal.scheme, internal.netloc, url.path, url.query, ""))
    response = await client.get(internal_url, headers={"Host": url.netloc})
    assert response.status_code == 200, response.status_code
    assert response.headers["Content-Type"] == "video/mp4"
    assert response.headers["Content-Disposition"] == f'attachment; filename="clip-{clip_id}.mp4"'
    path = directory / "download.mp4"
    path.write_bytes(response.content)
    probe = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "stream=codec_name:format=format_name,duration",
                "-of",
                "json",
                str(path),
            ],
            timeout=10,
        )
    )
    assert "mp4" in probe["format"]["format_name"].split(",")
    assert 1.4 < float(probe["format"]["duration"]) < 1.7
    assert {stream["codec_name"] for stream in probe["streams"]} == {"h264", "aac"}


async def verify_cleanup(storage: S3ObjectStorage, project_id: UUID) -> None:
    async with asyncio.timeout(15):
        while storage.client.list_objects_v2(
            Bucket=storage.bucket, Prefix=f"projects/{project_id}/"
        ).get("KeyCount", 0):
            await asyncio.sleep(0.2)


async def main() -> None:
    settings = Settings()
    assert settings.s3_endpoint_url == "http://minio:9000", "Use local Compose MinIO"
    assert settings.database_url is not None
    engine = create_async_engine(settings.database_url.get_secret_value())
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    storage = create_storage(settings)
    assert storage is not None
    try:
        async with AsyncClient(base_url=f"http://127.0.0.1:{settings.app_port}", timeout=30) as api:
            response = await api.post("/api/v1/projects", json={"title": "Clip smoke"})
            assert response.status_code == 201
            project_id = UUID(response.json()["id"])
            project_path = f"/api/v1/projects/{project_id}"
            try:
                with tempfile.TemporaryDirectory() as name:
                    directory = Path(name)
                    source = directory / "source.webm"
                    subprocess.run(
                        [
                            "ffmpeg",
                            "-v",
                            "error",
                            "-f",
                            "lavfi",
                            "-i",
                            "testsrc2=s=64x64:r=25",
                            "-f",
                            "lavfi",
                            "-i",
                            "sine=frequency=500:sample_rate=48000",
                            "-t",
                            "3",
                            "-c:v",
                            "libvpx-vp9",
                            "-c:a",
                            "libopus",
                            str(source),
                        ],
                        check=True,
                        timeout=20,
                    )
                    uploaded = await api.post(
                        project_path + "/upload",
                        params={"filename": source.name},
                        headers={"Content-Type": "video/webm"},
                        content=source.read_bytes(),
                    )
                    assert uploaded.status_code == 200 and uploaded.json()["status"] == "uploaded"
                    highlight_id = await seed_highlight(sessions, project_id)
                    generate = f"/api/v1/highlights/{highlight_id}/generate"
                    requested = await api.post(generate)
                    assert requested.status_code == 202 and requested.json()["status"] == "pending"
                    clip_id = requested.json()["id"]
                    assert (await api.post(generate)).json()["id"] == clip_id
                    clip_path = f"/api/v1/clips/{clip_id}"
                    async with asyncio.timeout(15):
                        while True:
                            state = (await api.get(clip_path)).json()
                            assert state["status"] != "failed", state
                            if state["status"] == "completed":
                                break
                            await asyncio.sleep(0.2)
                    await check_download(api, clip_id, directory, settings)
                    assert (await api.post(generate)).json() == state
                    assert (await api.delete(project_path)).status_code == 204
                    assert (await api.get(project_path)).status_code == 404
                    assert (await api.get(clip_path)).status_code == 404
                    await verify_cleanup(storage, project_id)
            finally:
                await api.delete(project_path)
        print("OK: clip worker, WebM to MP4, duplicate generate, signed GET, file cleanup")
    finally:
        storage.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
