"""Validated inputs and outputs at the application boundary."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from cliphunter.domain.entities import ProjectStatus


class CreateProjectInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Название не должно быть пустым")
        return value


class ProjectOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    original_filename: str | None
    file_size: int | None
    duration: float | None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class ProjectPage(BaseModel):
    items: list[ProjectOutput]
    total: int
    limit: int
    offset: int


class ProjectStatusOutput(BaseModel):
    id: UUID
    status: ProjectStatus
    updated_at: datetime
