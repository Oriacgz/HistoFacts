"""Add profile fields to users (country_code, pronouns, timezone, show_online_status)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-06 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("country_code", sa.String(length=2), nullable=True))
    op.add_column("users", sa.Column("pronouns", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"))
    op.add_column("users", sa.Column("show_online_status", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("users", "show_online_status")
    op.drop_column("users", "timezone")
    op.drop_column("users", "pronouns")
    op.drop_column("users", "country_code")
