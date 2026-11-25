"""Clip idempotency, worker fencing and media cleanup on PostgreSQL."""

import asyncio
import os
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import delete, func, update
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from cliphunter.application.clip_worker import ClipGenerationWorker
from cliphunter.application.clips import DownloadClip, GenerateClip, GetClip
from cliphunter.application.leases import LEASE
from cliphunter.application.projects import DeleteVideoProject
from cliphunter.application.storage_cleanup import StorageCleanupWorker
from cliphunter.domain.entities import ClipStatus, Highlight, VideoProject
from cliphunter.domain.errors import Conflict, NotFound, ServiceUnavailable
from cliphunter.infrastructure.database.models import (
    GeneratedClipModel,
    StorageDeletionModel,
    VideoProjectModel,
)
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork

pytestmark = [pytest.mark.integration, pytest.mark.anyio]
Database = tuple[AsyncEngine, Callable[[], SqlAlchemyUnitOfWork], VideoProject, Highlight]


@pytest.fixture
async def database() -> AsyncIterator[Database]:
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a migrated disposable PostgreSQL database")
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    def new_uow() -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(sessions)

    project = VideoProject(title="Clip integration")
    project.attach_video(
        filename="original.webm", storage_key=f"projects/{project.id}/source", size=4, duration=20
    )
    project.start_processing()
    project.complete_processing(has_highlights=True)
    highlight = Highlight(
        project_id=project.id,
        start_time=1.5,
        end_time=3.25,
        score=90,
        category="surprise",
        title="Смена темы",
        description="Ответ",
        reason="Реплика",
    )
    try:
        async with new_uow() as uow:
            await uow.projects.add(project)
            await uow.highlights.add_many([highlight])
            await uow.commit()
        yield engine, new_uow, project, highlight
    finally:
        async with engine.begin() as connection:
            await connection.execute(
                delete(VideoProjectModel).where(VideoProjectModel.id == project.id)
            )
            await connection.execute(
                delete(StorageDeletionModel).where(
                    StorageDeletionModel.storage_key.startswith(f"projects/{project.id}/")
                )
            )
        await engine.dispose()


class MemoryStorage:
    def __init__(self, source: str) -> None:
        self.objects = {source: b"webm"}
        self.uploads: list[tuple[str, str, str | None]] = []
        self.fail_upload = False
        self.fail_delete = False

    async def download(self, key: str, path: Path) -> None:
        path.write_bytes(self.objects[key])

    async def upload(
        self, path: Path, key: str, content_type: str, *, filename: str | None = None
    ) -> None:
        self.uploads.append((key, content_type, filename))
        self.objects[key] = path.read_bytes()
        if self.fail_upload:
            raise ServiceUnavailable("Storage temporary failure")

    async def delete(self, key: str) -> None:
        if self.fail_delete:
            raise ServiceUnavailable("Storage temporary failure")
        self.objects.pop(key, None)

    def sign_download(self, key: str, filename: str, *, expires_in: int) -> str:
        assert key in self.objects and key.endswith(filename) and expires_in >= 3600
        return "https://minio.example/clip.mp4"


class Renderer:
    output: Path

    async def render(self, source: Path, output: Path, start: float, end: float) -> None:
        assert source.read_bytes() == b"webm"
        assert (start, end) == (1.5, 3.25)
        self.output = output
        output.write_bytes(b"mp4")


async def test_generate_is_concurrent_safe_and_cleanup_retries(database: Database) -> None:
    engine, new_uow, project, highlight = database
    assert project.storage_key is not None
    storage, renderer = MemoryStorage(project.storage_key), Renderer()
    worker = ClipGenerationWorker(new_uow, storage, renderer, timeout=5)
    clips = await asyncio.wait_for(
        asyncio.gather(*[GenerateClip(new_uow()).execute(highlight.id) for _ in range(8)]),
        timeout=5,
    )
    assert len({clip.id for clip in clips}) == 1
    clip = clips[0]
    assert (await GetClip(new_uow()).execute(clip.id)).status == ClipStatus.PENDING
    with pytest.raises(Conflict):
        await DownloadClip(new_uow(), storage).execute(clip.id)
    assert await worker.run_once()
    assert not await worker.run_once()
    assert not renderer.output.parent.exists()
    ready = await GenerateClip(new_uow()).execute(highlight.id)
    assert ready.id == clip.id and ready.status == ClipStatus.COMPLETED
    assert len(storage.uploads) == 1
    assert storage.uploads[0][1:] == ("video/mp4", f"clip-{clip.id}.mp4")
    download = await DownloadClip(new_uow(), storage).execute(clip.id)
    assert download.expires_at > datetime.now(UTC) + timedelta(hours=1)

    await DeleteVideoProject(new_uow()).execute(project.id)
    with pytest.raises(NotFound):
        await GetClip(new_uow()).execute(clip.id)
    with pytest.raises(NotFound):
        await GenerateClip(new_uow()).execute(highlight.id)
    cleanup = StorageCleanupWorker(new_uow, storage)
    storage.fail_delete = True
    assert await cleanup.run_once() and await cleanup.run_once()
    assert not await cleanup.run_once()
    assert len(storage.objects) == 2
    storage.fail_delete = False
    async with engine.begin() as connection:
        await connection.execute(
            update(StorageDeletionModel)
            .where(StorageDeletionModel.storage_key.startswith(f"projects/{project.id}/"))
            .values(available_at=func.now())
        )
    assert await cleanup.run_once() and await cleanup.run_once()
    assert not await cleanup.run_once()
    assert not storage.objects


async def test_failed_clip_can_be_regenerated(database: Database) -> None:
    _, new_uow, project, highlight = database
    assert project.storage_key is not None
    storage, renderer = MemoryStorage(project.storage_key), Renderer()
    storage.fail_upload = True
    worker = ClipGenerationWorker(new_uow, storage, renderer, timeout=5)
    first = await GenerateClip(new_uow()).execute(highlight.id)
    assert await worker.run_once()
    assert not renderer.output.parent.exists()
    assert (await GetClip(new_uow()).execute(first.id)).status == ClipStatus.FAILED
    assert await StorageCleanupWorker(new_uow, storage).run_once()
    assert list(storage.objects) == [project.storage_key]
    storage.fail_upload = False
    second = await GenerateClip(new_uow()).execute(highlight.id)
    assert second.id != first.id and second.status == ClipStatus.PENDING
    assert await worker.run_once()
    assert (await GetClip(new_uow()).execute(second.id)).status == ClipStatus.COMPLETED


async def test_expired_claim_is_recovered_and_fenced(database: Database) -> None:
    engine, new_uow, _, highlight = database
    first = await GenerateClip(new_uow()).execute(highlight.id)
    async with new_uow() as uow:
        claim = await uow.clip_queue.claim(LEASE)
        assert claim is not None and claim.clip.id == first.id
        async with new_uow() as other:
            assert await asyncio.wait_for(other.clip_queue.claim(LEASE), timeout=2) is None
        await uow.commit()
    async with engine.begin() as connection:
        await connection.execute(
            update(GeneratedClipModel)
            .where(GeneratedClipModel.id == first.id)
            .values(processing_lease_until=func.now())
        )
    async with new_uow() as uow:
        new_claim = await uow.clip_queue.claim(LEASE)
        assert new_claim is not None and new_claim.token != claim.token and new_claim.attempt == 2
        await uow.commit()
    async with new_uow() as uow:
        assert await uow.clip_queue.lock_claimed_clip(claim) is None
        assert not await uow.clip_queue.renew(claim, LEASE)
        assert await uow.clip_queue.lock_claimed_clip(new_claim) is not None
        existing = await asyncio.wait_for(GenerateClip(new_uow()).execute(highlight.id), timeout=2)
        assert existing.id == first.id and existing.status == ClipStatus.PROCESSING
