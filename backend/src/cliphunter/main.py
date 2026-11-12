"""Composition root for the HTTP application."""

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from cliphunter.application.interfaces import (
    ObjectStorage,
    UnitOfWork,
    UploadBuffer,
    VideoInspector,
)
from cliphunter.infrastructure.config import Settings
from cliphunter.infrastructure.database.uow import SqlAlchemyUnitOfWork
from cliphunter.infrastructure.storage import create_storage
from cliphunter.infrastructure.uploads import FFprobeVideoInspector, TemporaryUploadBuffer
from cliphunter.presentation.http.errors import ErrorResponse, register_error_handlers
from cliphunter.presentation.http.health import router
from cliphunter.presentation.http.projects import router as projects_router


def create_app(
    settings: Settings | None = None,
    uow_factory: Callable[[], UnitOfWork] | None = None,
    *,
    storage: ObjectStorage | None = None,
    upload_buffer: UploadBuffer | None = None,
    video_inspector: VideoInspector | None = None,
) -> FastAPI:
    settings = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = None
        app.state.uow_factory = uow_factory
        owned_storage = create_storage(settings) if storage is None else None
        app.state.storage = storage if storage is not None else owned_storage
        app.state.upload_buffer = upload_buffer or TemporaryUploadBuffer(
            settings.upload_temp_dir,
            settings.max_upload_size_mb * 1024 * 1024,
            settings.upload_disk_reserve_mb * 1024 * 1024,
            concurrency=settings.max_concurrent_uploads,
        )
        app.state.video_inspector = video_inspector or FFprobeVideoInspector(
            settings.max_video_duration_seconds,
            timeout=settings.ffprobe_timeout_seconds,
        )
        if uow_factory is None and settings.database_url is not None:
            engine = create_async_engine(
                settings.database_url.get_secret_value(), pool_pre_ping=True
            )
            sessions = async_sessionmaker(engine, expire_on_commit=False)
            app.state.uow_factory = lambda: SqlAlchemyUnitOfWork(sessions)
        try:
            yield
        finally:
            if engine is not None:
                await engine.dispose()
            if owned_storage is not None:
                owned_storage.close()

    app = FastAPI(
        title="ClipHunter API",
        version="0.1.0",
        description="Проекты ClipHunter. Обработка видео появится на следующих этапах.",
        lifespan=lifespan,
        responses={
            status: {"model": ErrorResponse} for status in (404, 408, 409, 413, 415, 422, 503, 507)
        },
    )
    app.state.settings = settings
    app.include_router(router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    register_error_handlers(app)
    return app
