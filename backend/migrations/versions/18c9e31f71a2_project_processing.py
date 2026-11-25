"""Add project processing stage, error and queue lease.

Revision ID: 18c9e31f71a2
Revises: 72e66f0a0e51
"""

import sqlalchemy as sa
from alembic import op

revision = "18c9e31f71a2"
down_revision = "72e66f0a0e51"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("video_projects", sa.Column("stage", sa.String(32)))
    op.add_column("video_projects", sa.Column("error", sa.Text()))
    op.add_column("video_projects", sa.Column("processing_lease_token", sa.Uuid()))
    op.add_column("video_projects", sa.Column("processing_lease_until", sa.DateTime(timezone=True)))
    op.add_column(
        "video_projects",
        sa.Column("processing_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        op.f("ck_video_projects_processing_stage"),
        "video_projects",
        "stage IS NULL OR stage IN ('extracting_audio','transcribing','analyzing')",
    )
    op.create_index(
        "ix_video_projects_processing_queue",
        "video_projects",
        ["updated_at", "id"],
        postgresql_where=sa.text("status = 'processing'"),
    )


def downgrade() -> None:
    op.drop_index("ix_video_projects_processing_queue", table_name="video_projects")
    op.drop_constraint(op.f("ck_video_projects_processing_stage"), "video_projects", type_="check")
    op.drop_column("video_projects", "processing_attempts")
    op.drop_column("video_projects", "processing_lease_until")
    op.drop_column("video_projects", "processing_lease_token")
    op.drop_column("video_projects", "error")
    op.drop_column("video_projects", "stage")
