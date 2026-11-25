"""Read clip status and issue a time-limited download URL."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from cliphunter.application.clips import DownloadClip, GetClip
from cliphunter.application.dto import ClipDownload, ClipOutput
from cliphunter.application.interfaces import ObjectStorage
from cliphunter.presentation.http.dependencies import Transaction, get_storage

router = APIRouter(prefix="/clips", tags=["clips"])


@router.get("/{clip_id}", response_model=ClipOutput, summary="Получить статус клипа")
async def get_clip(clip_id: UUID, uow: Transaction) -> ClipOutput:
    return await GetClip(uow).execute(clip_id)


@router.get("/{clip_id}/download", response_model=ClipDownload, summary="Скачать готовый клип")
async def download_clip(
    clip_id: UUID, uow: Transaction, storage: Annotated[ObjectStorage | None, Depends(get_storage)]
) -> ClipDownload:
    return await DownloadClip(uow, storage).execute(clip_id)
