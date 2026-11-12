"""Resolve application ports from the composition root."""

from fastapi import Request

from cliphunter.application.interfaces import UnitOfWork
from cliphunter.application.upload import UploadVideo
from cliphunter.domain.errors import ServiceUnavailable


def get_uow(request: Request) -> UnitOfWork:
    factory = request.app.state.uow_factory
    if factory is None:
        raise ServiceUnavailable("База данных не настроена")
    result: UnitOfWork = factory()
    return result


def get_upload_video(request: Request) -> UploadVideo:
    storage = request.app.state.storage
    if storage is None:
        raise ServiceUnavailable("Объектное хранилище не настроено")
    return UploadVideo(
        get_uow(request),
        request.app.state.upload_buffer,
        request.app.state.video_inspector,
        storage,
        timeout=request.app.state.settings.upload_timeout_seconds,
    )
