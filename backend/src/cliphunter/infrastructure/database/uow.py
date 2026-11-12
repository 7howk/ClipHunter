"""One SQLAlchemy session per application transaction."""

from types import TracebackType
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from cliphunter.infrastructure.database.repositories import SqlAlchemyProjectRepository


class SqlAlchemyUnitOfWork:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def __aenter__(self) -> Self:
        self.session = self.sessions()
        self.projects = SqlAlchemyProjectRepository(self.session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self.session.close()

    async def commit(self) -> None:
        await self.session.commit()
