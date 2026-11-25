"""Clip scheduling, status and signed-download use cases."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from cliphunter.application.dto import ClipDownload, ClipOutput
from cliphunter.application.interfaces import ObjectStorage, UnitOfWork
from cliphunter.domain.entities import ClipStatus, GeneratedClip
from cliphunter.domain.errors import Conflict, NotFound, ServiceUnavailable

DOWNLOAD_TTL_SECONDS = 7200


class GenerateClip:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, highlight_id: UUID) -> ClipOutput:
        async with self.uow:
            highlight = await self.uow.highlights.get(highlight_id)
            if highlight is None:
                raise NotFound("Хайлайт не найден")
            clip = await self.uow.clips.add_or_get_active(
                GeneratedClip(project_id=highlight.project_id, highlight_id=highlight_id)
            )
            await self.uow.commit()
        return ClipOutput.model_validate(clip)


class GetClip:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, clip_id: UUID) -> ClipOutput:
        return ClipOutput.model_validate(await get_clip(self.uow, clip_id))


class DownloadClip:
    def __init__(self, uow: UnitOfWork, storage: ObjectStorage | None) -> None:
        self.uow = uow
        self.storage = storage

    async def execute(self, clip_id: UUID) -> ClipDownload:
        clip = await get_clip(self.uow, clip_id)
        if clip.status != ClipStatus.COMPLETED or clip.storage_key is None:
            raise Conflict("Клип ещё не готов к скачиванию")
        if self.storage is None:
            raise ServiceUnavailable("Объектное хранилище не настроено")
        expires_at = datetime.now(UTC) + timedelta(seconds=DOWNLOAD_TTL_SECONDS)
        url = self.storage.sign_download(
            clip.storage_key, clip.filename, expires_in=DOWNLOAD_TTL_SECONDS
        )
        return ClipDownload(url=url, expires_at=expires_at)


async def get_clip(uow: UnitOfWork, clip_id: UUID) -> GeneratedClip:
    async with uow:
        clip = await uow.clips.get(clip_id)
        if clip is None:
            raise NotFound("Клип не найден")
    return clip
