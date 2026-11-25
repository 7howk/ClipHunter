"""Project processing against a migrated disposable PostgreSQL database."""

import asyncio
import os
from collections.abc import AsyncIterator, Callable
from datetime import timedelta
from uuid import UUID

import pytest
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from cliphunter.application.highlights import GetHighlight, ListProjectHighlights
from cliphunter.application.processing import (
    MAX_ATTEMPTS,
    ProcessingResult,
    ProjectProcessingWorker,
    StartProjectProcessing,
)
from cliphunter.application.projects import GetVideoProjectStatus
from cliphunter.domain.entities import GeneratedClip, TranscriptSegment, VideoProject
from cliphunter.domain.errors import Conflict, NotFound
from cliphunter.infrastructure.database.models import TranscriptSegmentModel, VideoProjectModel
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork
from cliphunter.infrastructure.demo_analysis import analyze_demo

pytestmark = [pytest.mark.anyio, pytest.mark.integration]


@pytest.fixture
async def database() -> AsyncIterator[
    tuple[AsyncEngine, Callable[[], SqlAlchemyUnitOfWork], VideoProject]
]:
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a migrated disposable PostgreSQL database")
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    def new_uow() -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(sessions)

    project = VideoProject(title="Processing integration")
    project.attach_video(
        filename="demo.mp4", storage_key=f"test/{project.id}", size=10, duration=40
    )
    try:
        async with new_uow() as uow:
            await uow.projects.add(project)
            await uow.commit()
        yield engine, new_uow, project
    finally:
        async with engine.begin() as connection:
            await connection.execute(
                delete(VideoProjectModel).where(VideoProjectModel.id == project.id)
            )
        await engine.dispose()


Database = tuple[AsyncEngine, Callable[[], SqlAlchemyUnitOfWork], VideoProject]


@pytest.mark.parametrize(("min_score", "expected_scores"), [(60, [86, 72]), (86, [86]), (100, [])])
async def test_retry_clears_results_and_publishes_filtered_highlights(
    database: Database, min_score: int, expected_scores: list[int]
) -> None:
    engine, new_uow, project = database
    old_result = await analyze_demo(project)
    stale_highlight = old_result.highlights[0]
    stale_clip = GeneratedClip(project_id=project.id, highlight_id=stale_highlight.id)
    stale_segment = TranscriptSegment(project_id=project.id, start_time=0, end_time=1, text="Old")
    project.start_processing()
    project.fail_processing("Старая ошибка")
    async with new_uow() as uow:
        await uow.projects.save(project)
        await uow.transcripts.add_many([stale_segment])
        await uow.highlights.add_many([stale_highlight])
        await uow.clips.add(stale_clip)
        await uow.commit()
    async with new_uow() as uow:
        assert await uow.clips.get(stale_clip.id) == stale_clip

    assert (await StartProjectProcessing(new_uow()).execute(project.id)).status == "processing"
    status = await GetVideoProjectStatus(new_uow()).execute(project.id)
    assert status.error is None and status.stage is None
    with pytest.raises(Conflict):
        await StartProjectProcessing(new_uow()).execute(project.id)
    with pytest.raises(NotFound):
        await GetHighlight(new_uow()).execute(stale_highlight.id)
    async with engine.connect() as connection:
        assert (
            await connection.scalar(
                select(TranscriptSegmentModel.id).where(
                    TranscriptSegmentModel.id == stale_segment.id
                )
            )
            is None
        )
    assert (await ListProjectHighlights(new_uow(), min_score).execute(project.id)).items == []

    async def analyze(claimed: VideoProject) -> ProcessingResult:
        status = await GetVideoProjectStatus(new_uow()).execute(claimed.id)
        assert status.status == "processing" and status.stage == "analyzing"
        return await analyze_demo(claimed)

    worker = ProjectProcessingWorker(new_uow, analyze, min_score=min_score, timeout=10)
    assert await worker.run_once()
    status = await GetVideoProjectStatus(new_uow()).execute(project.id)
    assert status.status == ("completed" if expected_scores else "no_highlights")
    assert status.stage is None and status.error is None
    highlights = await ListProjectHighlights(new_uow(), min_score).execute(project.id)
    assert highlights.min_score == min_score
    assert [item.score for item in highlights.items] == expected_scores
    for item in highlights.items:
        assert item == await GetHighlight(new_uow()).execute(item.id)
    with pytest.raises(Conflict):
        await StartProjectProcessing(new_uow()).execute(project.id)


async def expire_project_lease(engine: AsyncEngine, project_id: UUID, **values: int) -> None:
    async with engine.begin() as connection:
        await connection.execute(
            update(VideoProjectModel)
            .where(VideoProjectModel.id == project_id)
            .values(processing_lease_until=func.now(), **values)
        )


async def test_worker_claim_is_exclusive_and_recovers_after_expiry(database: Database) -> None:
    engine, new_uow, project = database
    await StartProjectProcessing(new_uow()).execute(project.id)
    lease = timedelta(seconds=30)
    async with new_uow() as first:
        claim = await first.processing_queue.claim(lease)
        assert claim is not None and claim.project.id == project.id and claim.attempt == 1
        async with new_uow() as second:
            assert await asyncio.wait_for(second.processing_queue.claim(lease), timeout=2) is None
        await first.commit()
    async with new_uow() as uow:
        assert await uow.processing_queue.claim(lease) is None
        assert await uow.processing_queue.renew(claim, lease)
        await uow.commit()

    await expire_project_lease(engine, project.id)
    async with new_uow() as uow:
        reclaimed = await uow.processing_queue.claim(lease)
        assert reclaimed is not None and reclaimed.attempt == 2 and reclaimed.token != claim.token
        await uow.commit()
    async with new_uow() as uow:
        assert await uow.processing_queue.lock_claimed_project(claim) is None
        assert not await uow.processing_queue.renew(claim, lease)
        assert await uow.processing_queue.lock_claimed_project(reclaimed) is not None

    await expire_project_lease(engine, project.id, processing_attempts=MAX_ATTEMPTS)

    async def unexpected_analysis(_: VideoProject) -> ProcessingResult:
        pytest.fail("A project with no attempts left must not be analyzed")

    worker = ProjectProcessingWorker(new_uow, unexpected_analysis, min_score=60, timeout=10)
    assert await worker.run_once()
    state = await GetVideoProjectStatus(new_uow()).execute(project.id)
    assert state.status == "failed" and state.error == (
        "Обработка прерывалась несколько раз. Запустите её снова."
    )
    assert not await worker.run_once()


@pytest.mark.parametrize("timed_out", [False, True])
async def test_worker_saves_safe_errors(database: Database, timed_out: bool) -> None:
    _, new_uow, project = database
    await StartProjectProcessing(new_uow()).execute(project.id)

    async def broken_analysis(_: VideoProject) -> ProcessingResult:
        if timed_out:
            await asyncio.sleep(60)
        raise RuntimeError("Leaked internal error /var/private/debug.txt")

    worker = ProjectProcessingWorker(new_uow, broken_analysis, min_score=60, timeout=0.1)
    assert await worker.run_once()
    state = await GetVideoProjectStatus(new_uow()).execute(project.id)
    expected = (
        "Обработка заняла слишком много времени. Попробуйте снова."
        if timed_out
        else "Не удалось обработать видео. Попробуйте снова."
    )
    assert state.status == "failed" and state.error == expected and state.stage is None
