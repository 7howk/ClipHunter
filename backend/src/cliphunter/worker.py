"""Composition root for the separate PostgreSQL processing worker."""

import asyncio
import logging
import signal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from cliphunter.application.processing import ProjectProcessingWorker
from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork
from cliphunter.infrastructure.demo_analysis import analyze_demo

logger = logging.getLogger(__name__)


async def run(settings: Settings) -> None:
    if settings.database_url is None:
        raise SystemExit("Для worker требуется DATABASE_URL")
    engine = create_async_engine(settings.database_url.get_secret_value(), pool_pre_ping=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    worker = ProjectProcessingWorker(
        lambda: SqlAlchemyUnitOfWork(sessions),
        analyze_demo,
        min_score=settings.highlight_min_score,
        timeout=settings.processing_timeout_seconds,
    )
    try:
        while True:
            try:
                if await worker.run_once():
                    continue
            except (OSError, SQLAlchemyError) as exc:
                logger.warning("Worker database operation failed: %s", type(exc).__name__)
            await asyncio.sleep(1)
    finally:
        await engine.dispose()


async def main() -> None:
    task = asyncio.create_task(run(Settings()))
    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, task.cancel)
    try:
        await task
    except asyncio.CancelledError:
        pass
    finally:
        loop.remove_signal_handler(signal.SIGTERM)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
