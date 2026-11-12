"""SQLAlchemy 2.0 mappings; domain entities do not inherit ORM classes."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class VideoProjectModel(Base):
    __tablename__ = "video_projects"
    __table_args__ = (
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="title"),
        CheckConstraint(
            "status IN ('created','uploaded','processing','completed','no_highlights','failed')",
            name="status",
        ),
        CheckConstraint("file_size IS NULL OR file_size > 0", name="file_size"),
        CheckConstraint(
            "duration IS NULL OR (duration > 0 AND duration < 'Infinity'::float8)", name="duration"
        ),
        CheckConstraint(
            (
                "(original_filename IS NULL AND storage_key IS NULL "
                "AND file_size IS NULL AND duration IS NULL) OR "
                "(original_filename IS NOT NULL AND storage_key IS NOT NULL "
                "AND file_size IS NOT NULL AND duration IS NOT NULL)"
            ),
            name="media_metadata",
        ),
        CheckConstraint("status = 'created' OR storage_key IS NOT NULL", name="status_media"),
        Index("ix_video_projects_created_at_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    original_filename: Mapped[str | None] = mapped_column(String(255))
    storage_key: Mapped[str | None] = mapped_column(String(1024), unique=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    duration: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(32), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TranscriptSegmentModel(Base):
    __tablename__ = "transcript_segments"
    __table_args__ = (
        CheckConstraint(
            "start_time >= 0 AND end_time > start_time AND end_time < 'Infinity'::float8",
            name="interval",
        ),
        CheckConstraint("length(trim(text)) > 0", name="text"),
        Index("ix_transcript_segments_project_start", "project_id", "start_time"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("video_projects.id", ondelete="CASCADE"))
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    text: Mapped[str] = mapped_column(Text)


class HighlightModel(Base):
    __tablename__ = "highlights"
    __table_args__ = (
        UniqueConstraint("id", "project_id", name="uq_highlights_id_project_id"),
        CheckConstraint(
            "start_time >= 0 AND end_time > start_time AND end_time < 'Infinity'::float8",
            name="interval",
        ),
        CheckConstraint("score BETWEEN 0 AND 100", name="score"),
        CheckConstraint("length(trim(category)) > 0 AND length(trim(title)) > 0", name="labels"),
        Index("ix_highlights_project_score", "project_id", "score"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("video_projects.id", ondelete="CASCADE"))
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    score: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)


class GeneratedClipModel(Base):
    __tablename__ = "generated_clips"
    __table_args__ = (
        ForeignKeyConstraint(
            ["highlight_id", "project_id"],
            ["highlights.id", "highlights.project_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("status IN ('pending','processing','completed','failed')", name="status"),
        CheckConstraint(
            "status != 'completed' OR storage_key IS NOT NULL", name="completed_storage"
        ),
        Index("ix_generated_clips_project_id", "project_id"),
        Index("ix_generated_clips_highlight_id", "highlight_id"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("video_projects.id", ondelete="CASCADE"))
    highlight_id: Mapped[UUID] = mapped_column(Uuid)
    storage_key: Mapped[str | None] = mapped_column(String(1024), unique=True)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
