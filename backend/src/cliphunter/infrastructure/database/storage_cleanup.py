"""Persist S3 deletes independently of project and clip rows."""

from collections.abc import Sequence
from datetime import timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from cliphunter.infrastructure.database.models import StorageDeletionModel


class SqlAlchemyStorageCleanup:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def enqueue(self, keys: Sequence[str]) -> None:
        if keys:
            await self.session.execute(
                insert(StorageDeletionModel)
                .values([{"storage_key": key} for key in sorted(set(keys))])
                .on_conflict_do_nothing()
            )

    async def claim(self) -> str | None:
        stmt = (
            select(StorageDeletionModel.storage_key)
            .where(StorageDeletionModel.available_at <= func.now())
            .order_by(StorageDeletionModel.available_at, StorageDeletionModel.storage_key)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        return (await self.session.scalars(stmt)).one_or_none()

    async def complete(self, key: str) -> None:
        await self.session.execute(
            delete(StorageDeletionModel).where(StorageDeletionModel.storage_key == key)
        )

    async def postpone(self, key: str) -> None:
        await self.session.execute(
            update(StorageDeletionModel)
            .where(StorageDeletionModel.storage_key == key)
            .values(available_at=func.clock_timestamp() + timedelta(seconds=15))
        )
