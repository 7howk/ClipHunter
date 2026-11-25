"""Schedule project processing and publish results from a dedicated worker."""

import asyncio
import logging
from collections.abc import Awaitable, Callable, Coroutine
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any
from uuid import UUID

from cliphunter.application.dto import ProjectOutput
from cliphunter.application.interfaces import UnitOfWork
from cliphunter.domain.entities import Highlight, ProcessingStage, TranscriptSegment, VideoProject
from cliphunter.domain.errors import NotFound
from cliphunter.domain.repositories import ProcessingClaim

logger = logging.getLogger(__name__)
LEASE = timedelta(seconds=30)
MAX_ATTEMPTS = 3
StageReporter = Callable[[ProcessingStage], Awaitable[None]]


class AnalysisFailed(Exception):
    """A user-facing processing failure with a safe Russian message."""


class LeaseLost(Exception):
    """Processing ownership changed while the worker was running."""


class StartProjectProcessing:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, project_id: UUID) -> ProjectOutput:
        async with self.uow:
            project = await self.uow.projects.get(project_id, for_update=True)
            if project is None:
                raise NotFound("Проект не найден")
            project.start_processing()
            await self.uow.highlights.delete_for_project(project.id)
            await self.uow.transcripts.delete_for_project(project.id)
            await self.uow.processing_queue.reset(project.id)
            await self.uow.projects.save(project)
            await self.uow.commit()
        return ProjectOutput.model_validate(project)


@dataclass(frozen=True)
class ProcessingResult:
    segments: list[TranscriptSegment] = field(default_factory=list)
    highlights: list[Highlight] = field(default_factory=list)


class ProjectProcessingWorker:
    def __init__(
        self,
        uow_factory: Callable[[], UnitOfWork],
        analyze: Callable[[VideoProject, StageReporter], Coroutine[Any, Any, ProcessingResult]],
        *,
        min_score: int,
        timeout: float,
    ) -> None:
        self.uow_factory = uow_factory
        self.analyze = analyze
        self.min_score = min_score
        self.timeout = timeout

    async def run_once(self) -> bool:
        async with self.uow_factory() as uow:
            claim = await uow.processing_queue.claim(LEASE)
            if claim is None:
                return False
            project = claim.project
            if claim.attempt > MAX_ATTEMPTS:
                project.fail_processing("Обработка прерывалась несколько раз. Запустите её снова.")
                await uow.processing_queue.reset(project.id)
            else:
                project.set_processing_stage(ProcessingStage.EXTRACTING_AUDIO)
            await uow.projects.save(project)
            await uow.commit()
        if claim.attempt <= MAX_ATTEMPTS:
            await self._process(claim)
        return True

    async def _process(self, claim: ProcessingClaim) -> None:
        try:
            async with asyncio.timeout(self.timeout):
                result = await self._analyze_with_lease(claim)
        except TimeoutError:
            await self._finish(
                claim, error="Обработка заняла слишком много времени. Попробуйте снова."
            )
        except AnalysisFailed as exc:
            await self._finish(claim, error=str(exc))
        except LeaseLost:
            return
        else:
            if result is not None:
                await self._finish(claim, result=result)

    async def _analyze_with_lease(self, claim: ProcessingClaim) -> ProcessingResult | None:
        task = asyncio.create_task(self._run_analysis(claim))
        try:
            while True:
                done, _ = await asyncio.wait({task}, timeout=LEASE.total_seconds() / 3)
                if done:
                    return task.result()
                async with self.uow_factory() as uow:
                    if not await uow.processing_queue.renew(claim, LEASE):
                        return None
                    await uow.commit()
        finally:
            if not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    async def _run_analysis(self, claim: ProcessingClaim) -> ProcessingResult:
        async def report_stage(stage: ProcessingStage) -> None:
            async with self.uow_factory() as uow:
                project = await uow.processing_queue.lock_claimed_project(claim)
                if project is None:
                    raise LeaseLost
                project.set_processing_stage(stage)
                await uow.projects.save(project)
                await uow.commit()

        try:
            return await self.analyze(claim.project, report_stage)
        except (AnalysisFailed, LeaseLost, TimeoutError):
            raise
        except Exception as exc:
            logger.warning(
                "Project processing failed for %s: %s", claim.project.id, type(exc).__name__
            )
            raise AnalysisFailed("Не удалось обработать видео. Попробуйте снова.") from None

    async def _finish(
        self,
        claim: ProcessingClaim,
        *,
        result: ProcessingResult | None = None,
        error: str = "",
    ) -> None:
        async with self.uow_factory() as uow:
            project = await uow.processing_queue.lock_claimed_project(claim)
            if project is None:
                return
            if result is None:
                project.fail_processing(error)
            else:
                highlights = [item for item in result.highlights if item.score >= self.min_score]
                await uow.transcripts.add_many(result.segments)
                await uow.highlights.add_many(highlights)
                project.complete_processing(has_highlights=bool(highlights))
            await uow.projects.save(project)
            await uow.processing_queue.reset(project.id)
            await uow.commit()
