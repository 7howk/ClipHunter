"""Composition root for the HTTP application."""

from fastapi import FastAPI

from cliphunter.infrastructure.config import Settings
from cliphunter.presentation.http.health import router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    app = FastAPI(
        title="ClipHunter API",
        version="0.1.0",
        description="Backend foundation. Video processing endpoints are not implemented yet.",
    )
    app.state.settings = settings
    app.include_router(router, prefix="/api/v1")
    return app
