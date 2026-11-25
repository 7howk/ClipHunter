"""Project use cases depend on transaction/repository interfaces only."""

import logging
from uuid import UUID

from cliphunter.application.dto import (
    CreateProjectInput,
    ProjectOutput,
    ProjectPage,
    ProjectStatusOutput,
)
from cliphunter.application.interfaces import UnitOfWork
from cliphunter.application.storage_cleanup import clip_storage_keys
from cliphunter.domain.entities import VideoProject
from cliphunter.domain.errors import InvalidInput, NotFound

logger = logging.getLogger(__name__)


class CreateVideoProject:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, data: CreateProjectInput) -> ProjectOutput:
        project = VideoProject(title=data.title)
        async with self.uow:
            await self.uow.projects.add(project)
            await self.uow.commit()
        logger.info("Project created: %s", project.id)
        return ProjectOutput.model_validate(project)


class GetVideoProject:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, project_id: UUID) -> ProjectOutput:
        async with self.uow:
            project = await self.uow.projects.get(project_id)
            if project is None:
                raise NotFound("Проект не найден")
        return ProjectOutput.model_validate(project)


class GetVideoProjectStatus:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, project_id: UUID) -> ProjectStatusOutput:
        async with self.uow:
            project = await self.uow.projects.get(project_id)
            if project is None:
                raise NotFound("Проект не найден")
        return ProjectStatusOutput.model_validate(project)


class DeleteVideoProject:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, project_id: UUID) -> None:
        async with self.uow:
            project = await self.uow.projects.get(project_id, for_update=True)
            if project is None:
                raise NotFound("Проект не найден")
            keys = clip_storage_keys(await self.uow.clips.list_for_project(project_id))
            if project.storage_key is not None:
                keys.append(project.storage_key)
            await self.uow.storage_cleanup.enqueue(keys)
            await self.uow.projects.delete(project_id)
            await self.uow.commit()


class ListVideoProjects:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, *, limit: int = 20, offset: int = 0) -> ProjectPage:
        if not 1 <= limit <= 100 or offset < 0:
            raise InvalidInput("Некорректные параметры пагинации")
        async with self.uow:
            projects, total = await self.uow.projects.list(limit=limit, offset=offset)
        return ProjectPage(
            items=[ProjectOutput.model_validate(p) for p in projects],
            total=total,
            limit=limit,
            offset=offset,
        )
