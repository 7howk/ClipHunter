"""Run against a migrated disposable PostgreSQL database, never SQLite."""

import os
from uuid import uuid4

import pytest
from sqlalchemy import delete, insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from cliphunter.domain.entities import VideoProject
from cliphunter.infrastructure.database.models import HighlightModel, VideoProjectModel
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork

pytestmark = [pytest.mark.anyio, pytest.mark.integration]


@pytest.fixture
def database_url() -> str:
    value = os.getenv("TEST_DATABASE_URL")
    if not value:
        pytest.skip("Set TEST_DATABASE_URL to a migrated disposable PostgreSQL database")
    return value


async def test_repository_commit_reload_and_rollback(database_url: str) -> None:
    engine = create_async_engine(database_url)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        sessions = async_sessionmaker(
            connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        project = VideoProject(title="Repository integration")
        async with SqlAlchemyUnitOfWork(sessions) as uow:
            await uow.projects.add(project)
            await uow.commit()
        async with SqlAlchemyUnitOfWork(sessions) as uow:
            loaded = await uow.projects.get(project.id)
            assert loaded == project
            projects, total = await uow.projects.list(limit=100, offset=0)
            assert project.id in [p.id for p in projects] and total >= 1
        uncommitted = VideoProject(title="Must roll back")
        async with SqlAlchemyUnitOfWork(sessions) as uow:
            await uow.projects.add(uncommitted)
        async with SqlAlchemyUnitOfWork(sessions) as uow:
            assert await uow.projects.get(uncommitted.id) is None
        await transaction.rollback()
    await engine.dispose()


async def test_constraints_and_cascading_delete(database_url: str) -> None:
    engine = create_async_engine(database_url)
    project = VideoProject(title="Constraint integration")
    async with engine.connect() as connection:
        transaction = await connection.begin()
        await connection.execute(insert(VideoProjectModel).values(**vars(project)))
        async with connection.begin_nested() as savepoint:
            with pytest.raises(IntegrityError):
                await connection.execute(
                    insert(HighlightModel).values(
                        id=uuid4(),
                        project_id=project.id,
                        start_time=0,
                        end_time=1,
                        score=101,
                        category="test",
                        title="test",
                        description="",
                        reason="",
                    )
                )
            await savepoint.rollback()
        highlight_id = uuid4()
        await connection.execute(
            insert(HighlightModel).values(
                id=highlight_id,
                project_id=project.id,
                start_time=0,
                end_time=1,
                score=80,
                category="test",
                title="test",
                description="",
                reason="",
            )
        )
        await connection.execute(
            delete(VideoProjectModel).where(VideoProjectModel.id == project.id)
        )
        from sqlalchemy import select

        assert (
            await connection.execute(
                select(HighlightModel.id).where(HighlightModel.id == highlight_id)
            )
        ).first() is None
        await transaction.rollback()
    await engine.dispose()
