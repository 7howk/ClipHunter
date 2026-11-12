"""Framework-independent project, transcript, highlight and clip entities."""

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from cliphunter.domain.errors import Conflict, InvalidInput


class ProjectStatus(StrEnum):
    CREATED = "created"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    NO_HIGHLIGHTS = "no_highlights"
    FAILED = "failed"


class ClipStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def validate_interval(start: float, end: float) -> None:
    if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end):
        raise InvalidInput("Таймкоды должны быть конечными числами: 0 <= start < end")


@dataclass(kw_only=True)
class VideoProject:
    title: str
    id: UUID = field(default_factory=uuid4)
    original_filename: str | None = None
    storage_key: str | None = None
    file_size: int | None = None
    duration: float | None = None
    status: ProjectStatus = ProjectStatus.CREATED
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        self.title = self.title.strip()
        if not 1 <= len(self.title) <= 200:
            raise InvalidInput("Название должно содержать от 1 до 200 символов")
        values = (self.original_filename, self.storage_key, self.file_size, self.duration)
        if any(v is not None for v in values) and any(v is None for v in values):
            raise InvalidInput("Метаданные видео должны быть заполнены вместе")
        if self.file_size is not None and self.file_size <= 0:
            raise InvalidInput("Размер видео должен быть положительным")
        if self.duration is not None and (not math.isfinite(self.duration) or self.duration <= 0):
            raise InvalidInput("Длительность видео должна быть положительным конечным числом")
        if self.status != ProjectStatus.CREATED and self.storage_key is None:
            raise InvalidInput("Проект в этом статусе должен содержать видео")

    def attach_video(self, *, filename: str, storage_key: str, size: int, duration: float) -> None:
        if self.status != ProjectStatus.CREATED:
            raise Conflict("В проект уже загружено видео")
        if size <= 0 or not math.isfinite(duration) or duration <= 0:
            raise InvalidInput("Некорректные метаданные видео")
        self.original_filename = filename
        self.storage_key = storage_key
        self.file_size = size
        self.duration = duration
        self.status = ProjectStatus.UPLOADED
        self.updated_at = datetime.now(UTC)


@dataclass(kw_only=True)
class TranscriptSegment:
    project_id: UUID
    start_time: float
    end_time: float
    text: str
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        validate_interval(self.start_time, self.end_time)
        if not self.text.strip():
            raise InvalidInput("Текст сегмента не должен быть пустым")


@dataclass(kw_only=True)
class Highlight:
    project_id: UUID
    start_time: float
    end_time: float
    score: int
    category: str
    title: str
    description: str
    reason: str
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        validate_interval(self.start_time, self.end_time)
        if not 0 <= self.score <= 100:
            raise InvalidInput("Оценка хайлайта должна быть от 0 до 100")
        if not self.category.strip() or not self.title.strip():
            raise InvalidInput("Категория и название хайлайта обязательны")


@dataclass(kw_only=True)
class GeneratedClip:
    project_id: UUID
    highlight_id: UUID
    id: UUID = field(default_factory=uuid4)
    storage_key: str | None = None
    status: ClipStatus = ClipStatus.PENDING
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        if self.status == ClipStatus.COMPLETED and not self.storage_key:
            raise InvalidInput("Готовый клип должен содержать ключ хранилища")
