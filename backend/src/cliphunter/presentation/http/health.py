"""Process liveness endpoint; external service readiness is checked by Compose."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


@router.get("/health", response_model=HealthResponse, summary="Check API process liveness")
async def health() -> HealthResponse:
    return HealthResponse()
