"""Consistent errors without credentials or raw database/validation input."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from cliphunter.domain.errors import (
    AppError,
    Conflict,
    InvalidInput,
    NotFound,
    ServiceUnavailable,
)

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def register_error_handlers(app: FastAPI) -> None:
    async def app_error(request: Request, exc: AppError) -> JSONResponse:
        statuses = {NotFound: 404, Conflict: 409, InvalidInput: 422, ServiceUnavailable: 503}
        return error_response(statuses.get(type(exc), 500), exc.code, str(exc))

    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "validation_error", "Некорректные параметры запроса")

    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        response = error_response(exc.status_code, "http_error", str(exc.detail))
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    async def database_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.error("Database request failed: %s", type(exc).__name__)
        return error_response(503, "database_unavailable", "База данных временно недоступна")

    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Request failed: %s", type(exc).__name__)
        return error_response(500, "internal_error", "Внутренняя ошибка сервера")

    app.add_exception_handler(AppError, app_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(HTTPException, http_error)  # type: ignore[arg-type]
    app.add_exception_handler(SQLAlchemyError, database_error)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unexpected_error)
