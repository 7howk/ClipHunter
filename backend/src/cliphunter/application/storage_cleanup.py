"""Keep file deletion durable when a project or clip disappears from the API."""

import logging
from collections.abc import Callable, Sequence

from cliphunter.application.interfaces import ObjectStorage, UnitOfWork
from cliphunter.domain.entities import GeneratedClip
from cliphunter.domain.errors import ServiceUnavailable

logger = logging.getLogger(__name__)


def clip_storage_keys(clips: Sequence[GeneratedClip]) -> list[str]:
    keys = {clip.output_key for clip in clips}
    keys.update(clip.storage_key for clip in clips if clip.storage_key is not None)
    return sorted(keys)


class StorageCleanupWorker:
    def __init__(self, uow_factory: Callable[[], UnitOfWork], storage: ObjectStorage) -> None:
        self.uow_factory = uow_factory
        self.storage = storage

    async def run_once(self) -> bool:
        async with self.uow_factory() as uow:
            key = await uow.storage_cleanup.claim()
            if key is None:
                return False
            try:
                await self.storage.delete(key)
            except ServiceUnavailable:
                logger.warning("Storage cleanup deferred")
                await uow.storage_cleanup.postpone(key)
            else:
                await uow.storage_cleanup.complete(key)
            await uow.commit()
        return True
