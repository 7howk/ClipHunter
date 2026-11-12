"""Thin project HTTP routes; use cases own application behavior."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from cliphunter.application.dto import (
    CreateProjectInput,
    ProjectOutput,
    ProjectPage,
    ProjectStatusOutput,
)
from cliphunter.application.interfaces import UnitOfWork
from cliphunter.application.projects import CreateVideoProject, GetVideoProject, ListVideoProjects
from cliphunter.application.upload import UploadInput, UploadVideo
from cliphunter.presentation.http.dependencies import get_uow, get_upload_video

router = APIRouter(prefix="/projects", tags=["projects"])
Transaction = Annotated[UnitOfWork, Depends(get_uow)]


@router.post("", response_model=ProjectOutput, status_code=201, summary="Создать проект")
async def create_project(
    data: CreateProjectInput, uow: Transaction, response: Response
) -> ProjectOutput:
    result = await CreateVideoProject(uow).execute(data)
    response.headers["Location"] = f"/api/v1/projects/{result.id}"
    return result


@router.get("", response_model=ProjectPage, summary="Получить список проектов")
async def list_projects(
    uow: Transaction,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProjectPage:
    return await ListVideoProjects(uow).execute(limit=limit, offset=offset)


@router.get("/{project_id}", response_model=ProjectOutput, summary="Получить проект")
async def get_project(project_id: UUID, uow: Transaction) -> ProjectOutput:
    return await GetVideoProject(uow).execute(project_id)


@router.get("/{project_id}/status", response_model=ProjectStatusOutput, summary="Получить статус")
async def get_project_status(project_id: UUID, uow: Transaction) -> ProjectStatusOutput:
    project = await GetVideoProject(uow).execute(project_id)
    return ProjectStatusOutput(id=project.id, status=project.status, updated_at=project.updated_at)


@router.post(
    "/{project_id}/upload",
    response_model=ProjectOutput,
    summary="Загрузить исходное видео",
    description=(
        "Тело — двоичные данные видео (не multipart). Имя передаётся в filename; "
        "Content-Type должен соответствовать расширению."
    ),
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                mime: {"schema": {"type": "string", "format": "binary"}}
                for mime in (
                    "video/mp4",
                    "video/x-m4v",
                    "video/quicktime",
                    "video/x-matroska",
                    "video/webm",
                )
            },
        }
    },
)
async def upload_video(
    project_id: UUID,
    request: Request,
    use_case: Annotated[UploadVideo, Depends(get_upload_video)],
    filename: Annotated[str, Query(min_length=1, max_length=255)],
    content_type: Annotated[str, Header()] = "application/octet-stream",
    content_length: Annotated[int | None, Header(ge=0)] = None,
) -> ProjectOutput:
    data = UploadInput(
        filename=filename,
        content_type=content_type.split(";", 1)[0].strip().lower(),
        expected_size=content_length,
    )
    return await use_case.execute(project_id, data, request.stream())
