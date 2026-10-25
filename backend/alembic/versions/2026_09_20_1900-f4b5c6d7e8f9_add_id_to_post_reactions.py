"""Ensure post reactions have their model primary key column.

Revision ID: f4b5c6d7e8f9
Revises: f3b4c5d6e7f8
Create Date: 2026-09-20 19:00:00.000000

Some databases were bootstrapped before the reaction model's id column was
present. Add and backfill it without changing the existing post_votes table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4b5c6d7e8f9"
down_revision: Union[str, None] = "f3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(item["name"] == column for item in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not inspector.has_table("post_votes") or _has_column(inspector, "post_votes", "id"):
        return

    op.add_column("post_votes", sa.Column("id", sa.String(), nullable=True))
    op.execute(
        "UPDATE post_votes SET id = md5(random()::text || clock_timestamp()::text) WHERE id IS NULL"
    )
    op.alter_column("post_votes", "id", nullable=False)
    constraints = inspector.get_pk_constraint("post_votes")
    if constraints.get("name"):
        op.drop_constraint(constraints["name"], "post_votes", type_="primary")
    op.create_primary_key("pk_post_votes", "post_votes", ["id"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("post_votes") and _has_column(inspector, "post_votes", "id"):
        op.drop_constraint("pk_post_votes", "post_votes", type_="primary")
        op.drop_column("post_votes", "id")
