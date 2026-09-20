"""Add avatar_seed to social_user_summary_cache

Revision ID: f3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-09-20 18:30:00.000000

Idempotent: service startup's create_all may have created the table with the
column already present (fresh installs), while pre-existing tables need the ADD.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if not _has_column(inspector, "social_user_summary_cache", "avatar_seed"):
        op.add_column("social_user_summary_cache", sa.Column("avatar_seed", sa.String(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if _has_column(inspector, "social_user_summary_cache", "avatar_seed"):
        op.drop_column("social_user_summary_cache", "avatar_seed")
