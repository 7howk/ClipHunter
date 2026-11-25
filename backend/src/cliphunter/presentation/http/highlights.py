"""Highlight HTTP routes."""

from uuid import UUID

from fastapi import APIRouter

from cliphunter.application.clips import GenerateClip
from cliphunter.application.dto import ClipOutput, HighlightOutput
from cliphunter.application.highlights import GetHighlight
from cliphunter.presentation.http.dependencies import Transaction

router = APIRouter(prefix="/highlights", tags=["highlights"])


@router.get("/{highlight_id}", response_model=HighlightOutput, summary="Получить хайлайт")
async def get_highlight(highlight_id: UUID, uow: Transaction) -> HighlightOutput:
    return await GetHighlight(uow).execute(highlight_id)


@router.post(
    "/{highlight_id}/generate",
    response_model=ClipOutput,
    status_code=202,
    summary="Поставить клип в очередь или получить существующий",
)
async def generate_clip(highlight_id: UUID, uow: Transaction) -> ClipOutput:
    return await GenerateClip(uow).execute(highlight_id)
