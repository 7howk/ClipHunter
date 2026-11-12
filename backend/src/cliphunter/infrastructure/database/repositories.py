"""SQLAlchemy implementation of the project repository port."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from cliphunter.domain.entities import ProjectStatus, VideoProject
from cliphunter.infrastructure.database.models import VideoProjectModel


def to_entity(model: VideoProjectModel) -> VideoProject:
    return VideoProject(
        id=model.id,
        title=model.title,
        original_filename=model.original_filename,
        storage_key=model.storage_key,
        file_size=model.file_size,
        duration=model.duration,
        status=ProjectStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SqlAlchemyProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, project: VideoProject) -> None:
        self.session.add(VideoProjectModel(**vars(project)))
        await self.session.flush()

    async def get(self, project_id: UUID, *, for_update: bool = False) -> VideoProject | None:
        stmt = select(VideoProjectModel).where(VideoProjectModel.id == project_id)
        if for_update:
            stmt = stmt.with_for_update()
        model = await self.session.scalar(stmt)
        return None if model is None else to_entity(model)

    async def list(self, *, limit: int, offset: int) -> tuple[list[VideoProject], int]:
        total = await self.session.scalar(select(func.count()).select_from(VideoProjectModel))
        stmt = (
            select(VideoProjectModel)
            .order_by(VideoProjectModel.created_at.desc(), VideoProjectModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        models = await self.session.scalars(stmt)
        return [to_entity(model) for model in models], int(total or 0)

    async def save(self, project: VideoProject) -> None:
        model = await self.session.get(VideoProjectModel, project.id)
        if model is None:
            raise RuntimeError("Cannot save a project that was not loaded")
        for name, value in vars(project).items():
            setattr(model, name, value)
        await self.session.flush()
