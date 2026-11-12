"""Thin project HTTP routes; use cases own application behavior."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from cliphunter.application.dto import (
    CreateProjectInput,
    ProjectOutput,
    ProjectPage,
    ProjectStatusOutput,
)
from cliphunter.application.interfaces import UnitOfWork
from cliphunter.application.projects import CreateVideoProject, GetVideoProject, ListVideoProjects
from cliphunter.presentation.http.dependencies import get_uow

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
