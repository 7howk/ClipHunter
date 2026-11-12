"""Stream and validate a project's original video through external-service ports."""

import asyncio
import logging
from collections.abc import AsyncIterator
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from cliphunter.application.dto import ProjectOutput
from cliphunter.application.interfaces import (
    ObjectStorage,
    UnitOfWork,
    UploadBuffer,
    VideoInspector,
)
from cliphunter.domain.entities import ProjectStatus
from cliphunter.domain.errors import (
    Conflict,
    InvalidInput,
    NotFound,
    UnsupportedMedia,
    UploadTimedOut,
)

logger = logging.getLogger(__name__)
VIDEO_TYPES = {
    ".mp4": {"video/mp4"},
    ".m4v": {"video/mp4", "video/x-m4v"},
    ".mov": {"video/quicktime"},
    ".mkv": {"video/x-matroska"},
    ".webm": {"video/webm"},
}


class UploadInput(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str
    expected_size: int | None = Field(default=None, ge=0)

    def validate_format(self) -> str:
        if any(ord(char) < 32 or ord(char) == 127 for char in self.filename):
            raise InvalidInput("Имя файла содержит недопустимые символы")
        if "/" in self.filename or "\\" in self.filename:
            raise InvalidInput("Передавайте имя файла без пути")
        extension = PurePosixPath(self.filename).suffix.lower()
        if extension not in VIDEO_TYPES or self.content_type not in VIDEO_TYPES[extension]:
            raise UnsupportedMedia("Расширение и Content-Type должны соответствовать видеоформату")
        return extension


class UploadVideo:
    def __init__(
        self,
        uow: UnitOfWork,
        buffer: UploadBuffer,
        inspector: VideoInspector,
        storage: ObjectStorage,
        *,
        timeout: float = 900,
    ) -> None:
        self.uow = uow
        self.buffer = buffer
        self.inspector = inspector
        self.storage = storage
        self.timeout = timeout

    async def execute(
        self,
        project_id: UUID,
        data: UploadInput,
        chunks: AsyncIterator[bytes],
    ) -> ProjectOutput:
        extension = data.validate_format()
        key = f"projects/{project_id}/original/{uuid4()}{extension}"
        upload_started = False
        commit_started = False
        try:
            async with asyncio.timeout(self.timeout):
                async with self.uow:
                    project = await self.uow.projects.get(project_id, for_update=True)
                    if project is None:
                        raise NotFound("Проект не найден")
                    if project.status != ProjectStatus.CREATED:
                        raise Conflict("В проект уже загружено видео")
                    async with self.buffer.receive(chunks, data.expected_size) as buffered:
                        duration = await self.inspector.inspect(buffered.path, extension)
                        upload_started = True
                        await self.storage.upload(buffered.path, key, data.content_type)
                        project.attach_video(
                            filename=data.filename,
                            storage_key=key,
                            size=buffered.size,
                            duration=duration,
                        )
                        await self.uow.projects.save(project)
                        commit_started = True
                        await self.uow.commit()
                logger.info("Video uploaded for project: %s", project_id)
                return ProjectOutput.model_validate(project)
        except BaseException as exc:
            if upload_started:
                if not commit_started:
                    await self._cleanup(key)
                else:
                    # A lost COMMIT acknowledgement can mean the row was committed.
                    # Verify in a fresh transaction before deleting its object.
                    try:
                        async with self.uow:
                            stored = await self.uow.projects.get(project_id)
                        if stored is not None and stored.storage_key == key:
                            if isinstance(exc, Exception):
                                return ProjectOutput.model_validate(stored)
                        else:
                            await self._cleanup(key)
                    except Exception:
                        logger.error("Upload commit outcome unknown for project: %s", project_id)
            if isinstance(exc, TimeoutError):
                raise UploadTimedOut("Превышено время загрузки") from None
            raise

    async def _cleanup(self, key: str) -> None:
        task = asyncio.create_task(self.storage.delete(key))
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            await task
        except Exception:
            logger.error("Upload object cleanup failed")
