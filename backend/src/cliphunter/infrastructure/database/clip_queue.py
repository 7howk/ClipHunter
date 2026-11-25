"""PostgreSQL queue for clip jobs, with a fence at the publish boundary."""

from datetime import timedelta
from uuid import uuid4

from sqlalchemy import ColumnElement, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from cliphunter.domain.entities import ClipStatus, GeneratedClip
from cliphunter.domain.repositories import ClipClaim
from cliphunter.infrastructure.database.models import GeneratedClipModel, VideoProjectModel
from cliphunter.infrastructure.database.repositories import to_clip


def owned_by(claim: ClipClaim) -> ColumnElement[bool]:
    return (
        (GeneratedClipModel.id == claim.clip.id)
        & (GeneratedClipModel.status == ClipStatus.PROCESSING)
        & (GeneratedClipModel.processing_lease_token == claim.token)
        & (GeneratedClipModel.processing_lease_until > func.now())
    )


class SqlAlchemyClipQueue:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim(self, lease: timedelta) -> ClipClaim | None:
        stmt = (
            select(GeneratedClipModel, func.now())
            .where(
                GeneratedClipModel.status.in_((ClipStatus.PENDING, ClipStatus.PROCESSING)),
                or_(
                    GeneratedClipModel.processing_lease_until.is_(None),
                    GeneratedClipModel.processing_lease_until <= func.now(),
                ),
            )
            .order_by(GeneratedClipModel.created_at, GeneratedClipModel.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        row = (await self.session.execute(stmt)).one_or_none()
        if row is None:
            return None
        model, now = row
        token = uuid4()
        model.status = ClipStatus.PROCESSING
        model.processing_lease_token = token
        model.processing_lease_until = now + lease
        model.processing_attempts += 1
        await self.session.flush()
        return ClipClaim(to_clip(model), token, model.processing_attempts)

    async def renew(self, claim: ClipClaim, lease: timedelta) -> bool:
        stmt = (
            update(GeneratedClipModel)
            .where(owned_by(claim))
            .values(processing_lease_until=func.now() + lease)
            .returning(GeneratedClipModel.id)
        )
        return await self.session.scalar(stmt) is not None

    async def lock_claimed_clip(self, claim: ClipClaim) -> GeneratedClip | None:
        # Deleting a project locks the project before cascading to its clips.
        project = await self.session.scalar(
            select(VideoProjectModel.id)
            .where(VideoProjectModel.id == claim.clip.project_id)
            .with_for_update(read=True, key_share=True)
        )
        if project is None:
            return None
        stmt = select(GeneratedClipModel).where(owned_by(claim)).with_for_update()
        model = await self.session.scalar(stmt)
        return None if model is None else to_clip(model)
