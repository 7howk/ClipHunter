"""Highlight HTTP routes."""

from uuid import UUID

from fastapi import APIRouter

from cliphunter.application.dto import HighlightOutput
from cliphunter.application.highlights import GetHighlight
from cliphunter.presentation.http.dependencies import Transaction

router = APIRouter(prefix="/highlights", tags=["highlights"])


@router.get("/{highlight_id}", response_model=HighlightOutput, summary="Получить хайлайт")
async def get_highlight(highlight_id: UUID, uow: Transaction) -> HighlightOutput:
    return await GetHighlight(uow).execute(highlight_id)
