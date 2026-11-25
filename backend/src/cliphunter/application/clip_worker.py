"""Render and upload a clip only in the separate worker process."""

import asyncio
import logging
from collections.abc import Callable
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Protocol

from cliphunter.application.interfaces import ObjectStorage, UnitOfWork
from cliphunter.application.leases import LEASE, MAX_ATTEMPTS, LeaseLost, run_with_lease
from cliphunter.application.processing import AnalysisFailed
from cliphunter.application.storage_cleanup import clip_storage_keys
from cliphunter.domain.repositories import ClipClaim

logger = logging.getLogger(__name__)


class ClipRenderer(Protocol):
    async def render(self, source: Path, output: Path, start: float, end: float) -> None: ...


class ClipGenerationWorker:
    def __init__(
        self,
        uow_factory: Callable[[], UnitOfWork],
        storage: ObjectStorage | None,
        renderer: ClipRenderer,
        *,
        timeout: float,
    ) -> None:
        self.uow_factory = uow_factory
        self.storage = storage
        self.renderer = renderer
        self.timeout = timeout

    async def run_once(self) -> bool:
        async with self.uow_factory() as uow:
            claim = await uow.clip_queue.claim(LEASE)
            if claim is None:
                return False
            await uow.commit()
        if claim.attempt > MAX_ATTEMPTS or self.storage is None:
            await self._fail(claim)
            return True

        try:
            with TemporaryDirectory(prefix="cliphunter-clip-") as directory:
                path = Path(directory)
                output = path / "clip.mp4"
                async with asyncio.timeout(self.timeout):
                    await run_with_lease(
                        self._render(claim, self.storage, path / "source", output),
                        partial(self._renew, claim),
                    )
                    await self._publish(claim, self.storage, output)
        except LeaseLost:
            pass
        except Exception as exc:
            logger.warning("Clip generation failed for %s: %s", claim.clip.id, type(exc).__name__)
            await self._fail(claim)
        return True

    async def _renew(self, claim: ClipClaim) -> bool:
        async with self.uow_factory() as uow:
            renewed = await uow.clip_queue.renew(claim, LEASE)
            await uow.commit()
        return renewed

    async def _render(
        self, claim: ClipClaim, storage: ObjectStorage, source: Path, output: Path
    ) -> None:
        async with self.uow_factory() as uow:
            project = await uow.projects.get(claim.clip.project_id)
            highlight = await uow.highlights.get(claim.clip.highlight_id)
        if project is None or highlight is None or project.storage_key is None:
            raise AnalysisFailed("Исходное видео или хайлайт недоступны")
        await storage.download(project.storage_key, source)
        await self.renderer.render(source, output, highlight.start_time, highlight.end_time)

    async def _publish(self, claim: ClipClaim, storage: ObjectStorage, output: Path) -> None:
        async with self.uow_factory() as uow:
            clip = await uow.clip_queue.lock_claimed_clip(claim)
            if clip is None:
                return
            await storage.upload(output, clip.output_key, "video/mp4", filename=clip.filename)
            clip.complete()
            await uow.clips.save(clip)
            await uow.commit()

    async def _fail(self, claim: ClipClaim) -> None:
        async with self.uow_factory() as uow:
            clip = await uow.clip_queue.lock_claimed_clip(claim)
            if clip is None:
                return
            clip.fail()
            await uow.storage_cleanup.enqueue(clip_storage_keys([clip]))
            await uow.clips.save(clip)
            await uow.commit()
