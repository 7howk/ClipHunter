"""SQLAlchemy implementations of the domain repository ports."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from cliphunter.domain.entities import (
    ClipStatus,
    GeneratedClip,
    Highlight,
    ProcessingStage,
    ProjectStatus,
    TranscriptSegment,
    VideoProject,
)
from cliphunter.domain.errors import Conflict, NotFound
from cliphunter.infrastructure.database.models import (
    GeneratedClipModel,
    HighlightModel,
    TranscriptSegmentModel,
    VideoProjectModel,
)


def to_entity(model: VideoProjectModel) -> VideoProject:
    return VideoProject(
        id=model.id,
        title=model.title,
        original_filename=model.original_filename,
        storage_key=model.storage_key,
        file_size=model.file_size,
        duration=model.duration,
        status=ProjectStatus(model.status),
        stage=ProcessingStage(model.stage) if model.stage is not None else None,
        error=model.error,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SqlAlchemyProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, project: VideoProject) -> None:
        self.session.add(VideoProjectModel(**vars(project)))
        await self.session.flush()

    async def get(self, project_id: UUID, *, for_update: bool = False) -> VideoProject | None:
        stmt = select(VideoProjectModel).where(VideoProjectModel.id == project_id)
        if for_update:
            stmt = stmt.with_for_update(nowait=True)
        try:
            model = await self.session.scalar(stmt)
        except DBAPIError as exc:
            if getattr(exc.orig, "sqlstate", None) == "55P03":
                raise Conflict("С проектом уже выполняется другая операция") from None
            raise
        return None if model is None else to_entity(model)

    async def list(self, *, limit: int, offset: int) -> tuple[list[VideoProject], int]:
        total = await self.session.scalar(select(func.count()).select_from(VideoProjectModel))
        stmt = (
            select(VideoProjectModel)
            .order_by(VideoProjectModel.created_at.desc(), VideoProjectModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        models = await self.session.scalars(stmt)
        return [to_entity(model) for model in models], int(total or 0)

    async def save(self, project: VideoProject) -> None:
        model = await self.session.get(VideoProjectModel, project.id)
        if model is None:
            raise RuntimeError("Cannot save a project that was not loaded")
        for name, value in vars(project).items():
            setattr(model, name, value)
        await self.session.flush()

    async def delete(self, project_id: UUID) -> None:
        await self.session.execute(
            delete(VideoProjectModel).where(VideoProjectModel.id == project_id)
        )


class SqlAlchemyTranscriptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add_many(self, segments: Sequence[TranscriptSegment]) -> None:
        self.session.add_all(TranscriptSegmentModel(**vars(segment)) for segment in segments)
        await self.session.flush()

    async def delete_for_project(self, project_id: UUID) -> None:
        await self.session.execute(
            delete(TranscriptSegmentModel).where(TranscriptSegmentModel.project_id == project_id)
        )


def to_highlight(model: HighlightModel) -> Highlight:
    return Highlight(
        id=model.id,
        project_id=model.project_id,
        start_time=model.start_time,
        end_time=model.end_time,
        score=model.score,
        category=model.category,
        title=model.title,
        description=model.description,
        reason=model.reason,
    )


class SqlAlchemyHighlightRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add_many(self, highlights: Sequence[Highlight]) -> None:
        self.session.add_all(HighlightModel(**vars(highlight)) for highlight in highlights)
        await self.session.flush()

    async def get(self, highlight_id: UUID) -> Highlight | None:
        model = await self.session.get(HighlightModel, highlight_id)
        return None if model is None else to_highlight(model)

    async def list_for_project(self, project_id: UUID, *, min_score: int) -> list[Highlight]:
        stmt = (
            select(HighlightModel)
            .where(HighlightModel.project_id == project_id, HighlightModel.score >= min_score)
            .order_by(HighlightModel.score.desc(), HighlightModel.start_time, HighlightModel.id)
        )
        return [to_highlight(model) for model in await self.session.scalars(stmt)]

    async def delete_for_project(self, project_id: UUID) -> None:
        await self.session.execute(
            delete(HighlightModel).where(HighlightModel.project_id == project_id)
        )


class SqlAlchemyClipRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, clip: GeneratedClip) -> None:
        self.session.add(GeneratedClipModel(**vars(clip)))
        await self.session.flush()

    async def get(self, clip_id: UUID) -> GeneratedClip | None:
        model = await self.session.get(GeneratedClipModel, clip_id)
        return None if model is None else to_clip(model)

    async def add_or_get_active(self, clip: GeneratedClip) -> GeneratedClip:
        existing = await self.session.scalar(
            select(GeneratedClipModel).where(
                GeneratedClipModel.highlight_id == clip.highlight_id,
                GeneratedClipModel.status != ClipStatus.FAILED,
            )
        )
        if existing is not None:
            return to_clip(existing)
        # Deletion locks the project before cascading to the highlight. Take the
        # parent lock first so the two INSERT foreign keys cannot reverse that order.
        if not await lock_clip_project(self.session, clip.project_id):
            raise NotFound("Хайлайт не найден")
        stmt = (
            insert(GeneratedClipModel)
            .values(**vars(clip))
            .on_conflict_do_update(
                index_elements=[GeneratedClipModel.highlight_id],
                index_where=text("status != 'failed'"),
                set_={"id": GeneratedClipModel.id},
            )
            .returning(GeneratedClipModel)
        )
        try:
            model = (await self.session.scalars(stmt)).one()
        except DBAPIError as exc:
            if getattr(exc.orig, "sqlstate", None) == "23503":
                raise NotFound("Хайлайт не найден") from None
            raise
        return to_clip(model)

    async def list_for_project(self, project_id: UUID) -> list[GeneratedClip]:
        stmt = select(GeneratedClipModel).where(GeneratedClipModel.project_id == project_id)
        return [to_clip(model) for model in await self.session.scalars(stmt)]

    async def save(self, clip: GeneratedClip) -> None:
        model = await self.session.get(GeneratedClipModel, clip.id)
        if model is None:
            raise RuntimeError("Cannot save a clip that was not loaded")
        model.status = clip.status
        model.storage_key = clip.storage_key
        model.processing_lease_token = None
        model.processing_lease_until = None
        model.processing_attempts = 0
        await self.session.flush()


def to_clip(model: GeneratedClipModel) -> GeneratedClip:
    return GeneratedClip(
        id=model.id,
        project_id=model.project_id,
        highlight_id=model.highlight_id,
        storage_key=model.storage_key,
        status=ClipStatus(model.status),
        created_at=model.created_at,
    )


async def lock_clip_project(session: AsyncSession, project_id: UUID) -> bool:
    stmt = (
        select(VideoProjectModel.id)
        .where(VideoProjectModel.id == project_id)
        .with_for_update(read=True, key_share=True)
    )
    return await session.scalar(stmt) is not None
