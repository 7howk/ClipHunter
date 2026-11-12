"""In-memory transaction/repository doubles for isolated use-case and HTTP tests."""

from copy import deepcopy
from types import TracebackType
from typing import Self
from uuid import UUID

from cliphunter.domain.entities import VideoProject


class MemoryProjectRepository:
    def __init__(self, projects: dict[UUID, VideoProject]) -> None:
        self.data = projects

    async def add(self, project: VideoProject) -> None:
        self.data[project.id] = deepcopy(project)

    async def get(self, project_id: UUID, *, for_update: bool = False) -> VideoProject | None:
        return deepcopy(self.data.get(project_id))

    async def list(self, *, limit: int, offset: int) -> tuple[list[VideoProject], int]:
        items = sorted(self.data.values(), key=lambda p: (p.created_at, p.id), reverse=True)
        return deepcopy(items[offset : offset + limit]), len(items)

    async def save(self, project: VideoProject) -> None:
        self.data[project.id] = deepcopy(project)


class MemoryUnitOfWork:
    def __init__(self, store: dict[UUID, VideoProject]) -> None:
        self.store = store

    async def __aenter__(self) -> Self:
        self.projects = MemoryProjectRepository(deepcopy(self.store))
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None

    async def commit(self) -> None:
        self.store.clear()
        self.store.update(deepcopy(self.projects.data))
