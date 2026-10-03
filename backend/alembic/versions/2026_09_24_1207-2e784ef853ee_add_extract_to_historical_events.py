"""add_extract_to_historical_events

Revision ID: 2e784ef853ee
Revises: 'f4b5c6d7e8f9'
Create Date: 2026-09-24 12:07:47.995233

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e784ef853ee'
down_revision: Union[str, None] = 'f4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(item["name"] == column for item in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("historical_events") and not _has_column(inspector, "historical_events", "extract"):
        op.add_column("historical_events", sa.Column("extract", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("historical_events") and _has_column(inspector, "historical_events", "extract"):
        op.drop_column("historical_events", "extract")

