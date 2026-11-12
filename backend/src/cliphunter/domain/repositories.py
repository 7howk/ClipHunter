"""Repository ports implemented by the infrastructure layer."""

from typing import Protocol
from uuid import UUID

from cliphunter.domain.entities import VideoProject


class ProjectRepository(Protocol):
    async def add(self, project: VideoProject) -> None: ...

    async def get(self, project_id: UUID, *, for_update: bool = False) -> VideoProject | None: ...

    async def list(self, *, limit: int, offset: int) -> tuple[list[VideoProject], int]: ...

    async def save(self, project: VideoProject) -> None: ...
