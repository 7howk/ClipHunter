"""Repository ports implemented by the infrastructure layer."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol
from uuid import UUID

from cliphunter.domain.entities import GeneratedClip, Highlight, TranscriptSegment, VideoProject


class ProjectRepository(Protocol):
    async def add(self, project: VideoProject) -> None: ...

    async def get(self, project_id: UUID, *, for_update: bool = False) -> VideoProject | None: ...

    async def list(self, *, limit: int, offset: int) -> tuple[list[VideoProject], int]: ...

    async def save(self, project: VideoProject) -> None: ...

    async def delete(self, project_id: UUID) -> None: ...


class TranscriptRepository(Protocol):
    async def add_many(self, segments: Sequence[TranscriptSegment]) -> None: ...

    async def delete_for_project(self, project_id: UUID) -> None: ...


class HighlightRepository(Protocol):
    async def add_many(self, highlights: Sequence[Highlight]) -> None: ...

    async def get(self, highlight_id: UUID) -> Highlight | None: ...

    async def list_for_project(self, project_id: UUID, *, min_score: int) -> list[Highlight]: ...

    async def delete_for_project(self, project_id: UUID) -> None: ...


class ClipRepository(Protocol):
    async def add(self, clip: GeneratedClip) -> None: ...

    async def get(self, clip_id: UUID) -> GeneratedClip | None: ...

    async def add_or_get_active(self, clip: GeneratedClip) -> GeneratedClip: ...

    async def list_for_project(self, project_id: UUID) -> list[GeneratedClip]: ...

    async def save(self, clip: GeneratedClip) -> None: ...


@dataclass(frozen=True)
class ClipClaim:
    clip: GeneratedClip
    token: UUID
    attempt: int


class ClipQueue(Protocol):
    async def claim(self, lease: timedelta) -> ClipClaim | None: ...

    async def renew(self, claim: ClipClaim, lease: timedelta) -> bool: ...

    async def lock_claimed_clip(self, claim: ClipClaim) -> GeneratedClip | None: ...


class StorageCleanupRepository(Protocol):
    async def enqueue(self, keys: Sequence[str]) -> None: ...

    async def claim(self) -> str | None: ...

    async def complete(self, key: str) -> None: ...

    async def postpone(self, key: str) -> None: ...


@dataclass(frozen=True)
class ProcessingClaim:
    project: VideoProject
    token: UUID
    attempt: int


class ProcessingQueue(Protocol):
    async def claim(self, lease: timedelta) -> ProcessingClaim | None: ...

    async def renew(self, claim: ProcessingClaim, lease: timedelta) -> bool: ...

    async def lock_claimed_project(self, claim: ProcessingClaim) -> VideoProject | None: ...

    async def reset(self, project_id: UUID) -> None: ...
