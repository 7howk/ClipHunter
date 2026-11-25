"""Composition root for the separate PostgreSQL processing worker."""

import asyncio
import logging
import signal

from httpx2 import AsyncClient
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from cliphunter.application.pipeline import AnalyzeVideo
from cliphunter.application.processing import (
    AnalysisFailed,
    ProcessingResult,
    ProjectProcessingWorker,
    StageReporter,
)
from cliphunter.domain.entities import VideoProject
from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork
from cliphunter.infrastructure.groq import GroqAnalysis
from cliphunter.infrastructure.media import FFmpegAudio
from cliphunter.infrastructure.storage import create_storage

logger = logging.getLogger(__name__)


async def unavailable_analysis(_: VideoProject, __: StageReporter) -> ProcessingResult:
    raise AnalysisFailed("Сервис обработки не настроен. Обратитесь к администратору.")


async def run(settings: Settings) -> None:
    if settings.database_url is None:
        raise SystemExit("Для worker требуется DATABASE_URL")
    engine = create_async_engine(settings.database_url.get_secret_value(), pool_pre_ping=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    storage = create_storage(settings)
    key = settings.groq_api_key.get_secret_value().strip() if settings.groq_api_key else ""
    try:
        async with AsyncClient(
            base_url="https://api.groq.com/openai/v1/",
            headers={"Authorization": f"Bearer {key}"} if key else {},
            timeout=settings.groq_timeout_seconds,
        ) as client:
            groq = GroqAnalysis(
                client, stt_model=settings.groq_stt_model, llm_model=settings.groq_llm_model
            )
            analyze = (
                AnalyzeVideo(storage, FFmpegAudio(), groq, groq).execute
                if key and storage is not None
                else unavailable_analysis
            )
            worker = ProjectProcessingWorker(
                lambda: SqlAlchemyUnitOfWork(sessions),
                analyze,
                min_score=settings.highlight_min_score,
                timeout=settings.processing_timeout_seconds,
            )
            while True:
                try:
                    if await worker.run_once():
                        continue
                except (OSError, SQLAlchemyError) as exc:
                    logger.warning("Worker database operation failed: %s", type(exc).__name__)
                await asyncio.sleep(1)
    finally:
        await engine.dispose()
        if storage is not None:
            storage.close()


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
