"""Add clip leases, active-clip uniqueness and durable S3 cleanup.

Revision ID: 325c110ed20f
Revises: 18c9e31f71a2
"""

import sqlalchemy as sa
from alembic import op

revision = "325c110ed20f"
down_revision = "18c9e31f71a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_clips", sa.Column("processing_lease_token", sa.Uuid()))
    op.add_column(
        "generated_clips", sa.Column("processing_lease_until", sa.DateTime(timezone=True))
    )
    op.add_column(
        "generated_clips",
        sa.Column("processing_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    # Enforce one active row for data created before the API as well. Prefer a finished clip.
    op.execute(
        """
        WITH ranked AS (
          SELECT id, row_number() OVER (
            PARTITION BY highlight_id
            ORDER BY CASE status WHEN 'completed' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                     created_at, id
          ) AS position
          FROM generated_clips WHERE status != 'failed'
        )
        UPDATE generated_clips SET status = 'failed'
        FROM ranked WHERE generated_clips.id = ranked.id AND ranked.position > 1
        """
    )
    op.create_index(
        "uq_generated_clips_active_highlight",
        "generated_clips",
        ["highlight_id"],
        unique=True,
        postgresql_where=sa.text("status != 'failed'"),
    )
    op.create_index(
        "ix_generated_clips_queue",
        "generated_clips",
        ["created_at", "id"],
        postgresql_where=sa.text("status IN ('pending', 'processing')"),
    )
    op.create_table(
        "storage_deletions",
        sa.Column("storage_key", sa.String(1024), nullable=False),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("storage_key", name=op.f("pk_storage_deletions")),
    )
    op.create_index("ix_storage_deletions_available_at", "storage_deletions", ["available_at"])


def downgrade() -> None:
    op.drop_index("ix_storage_deletions_available_at", table_name="storage_deletions")
    op.drop_table("storage_deletions")
    op.drop_index("ix_generated_clips_queue", table_name="generated_clips")
    op.drop_index("uq_generated_clips_active_highlight", table_name="generated_clips")
    op.drop_column("generated_clips", "processing_attempts")
    op.drop_column("generated_clips", "processing_lease_until")
    op.drop_column("generated_clips", "processing_lease_token")
