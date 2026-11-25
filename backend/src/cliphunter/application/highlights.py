"""Read highlights through the application's project and highlight repositories."""

from uuid import UUID

from cliphunter.application.dto import HighlightList, HighlightOutput
from cliphunter.application.interfaces import UnitOfWork
from cliphunter.domain.entities import ProjectStatus
from cliphunter.domain.errors import NotFound


class ListProjectHighlights:
    def __init__(self, uow: UnitOfWork, min_score: int) -> None:
        self.uow = uow
        self.min_score = min_score

    async def execute(self, project_id: UUID) -> HighlightList:
        async with self.uow:
            project = await self.uow.projects.get(project_id)
            if project is None:
                raise NotFound("Проект не найден")
            if project.status != ProjectStatus.COMPLETED:
                return HighlightList(items=[], min_score=self.min_score)
            highlights = await self.uow.highlights.list_for_project(
                project_id, min_score=self.min_score
            )
        return HighlightList(
            items=[HighlightOutput.model_validate(item) for item in highlights],
            min_score=self.min_score,
        )


class GetHighlight:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def execute(self, highlight_id: UUID) -> HighlightOutput:
        async with self.uow:
            highlight = await self.uow.highlights.get(highlight_id)
            if highlight is None:
                raise NotFound("Хайлайт не найден")
        return HighlightOutput.model_validate(highlight)
