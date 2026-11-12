"""Resolve application ports from the composition root."""

from fastapi import Request

from cliphunter.application.interfaces import UnitOfWork
from cliphunter.domain.errors import ServiceUnavailable


def get_uow(request: Request) -> UnitOfWork:
    factory = request.app.state.uow_factory
    if factory is None:
        raise ServiceUnavailable("База данных не настроена")
    result: UnitOfWork = factory()
    return result
