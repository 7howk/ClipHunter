"""PostgreSQL queue using project rows and expiring ownership tokens."""

from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import ColumnElement, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from cliphunter.domain.entities import ProjectStatus, VideoProject
from cliphunter.domain.repositories import ProcessingClaim
from cliphunter.infrastructure.database.models import VideoProjectModel
from cliphunter.infrastructure.database.repositories import to_entity


def owned_by(claim: ProcessingClaim) -> ColumnElement[bool]:
    return (
        (VideoProjectModel.id == claim.project.id)
        & (VideoProjectModel.status == ProjectStatus.PROCESSING)
        & (VideoProjectModel.processing_lease_token == claim.token)
        & (VideoProjectModel.processing_lease_until > func.now())
    )


class SqlAlchemyProcessingQueue:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim(self, lease: timedelta) -> ProcessingClaim | None:
        stmt = (
            select(VideoProjectModel, func.now())
            .where(
                VideoProjectModel.status == ProjectStatus.PROCESSING,
                or_(
                    VideoProjectModel.processing_lease_until.is_(None),
                    VideoProjectModel.processing_lease_until <= func.now(),
                ),
            )
            .order_by(VideoProjectModel.updated_at, VideoProjectModel.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        row = (await self.session.execute(stmt)).one_or_none()
        if row is None:
            return None
        model, now = row
        token = uuid4()
        model.processing_lease_token = token
        model.processing_lease_until = now + lease
        model.processing_attempts += 1
        await self.session.flush()
        return ProcessingClaim(to_entity(model), token, model.processing_attempts)

    async def renew(self, claim: ProcessingClaim, lease: timedelta) -> bool:
        stmt = (
            update(VideoProjectModel)
            .where(owned_by(claim))
            .values(processing_lease_until=func.now() + lease)
            .returning(VideoProjectModel.id)
        )
        return await self.session.scalar(stmt) is not None

    async def lock_claimed_project(self, claim: ProcessingClaim) -> VideoProject | None:
        stmt = select(VideoProjectModel).where(owned_by(claim)).with_for_update()
        model = await self.session.scalar(stmt)
        return None if model is None else to_entity(model)

    async def reset(self, project_id: UUID) -> None:
        await self.session.execute(
            update(VideoProjectModel)
            .where(VideoProjectModel.id == project_id)
            .values(processing_lease_token=None, processing_lease_until=None, processing_attempts=0)
        )
