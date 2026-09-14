"""Profile settings round 2 (profile_visibility, deletion_scheduled_at, user_sessions, two_factor_auth)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-14 18:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create visibility enum and add profile_visibility column to users
    visibility_enum = sa.Enum("public", "friends_only", "private", name="visibility")
    visibility_enum.create(conn, checkfirst=True)
    op.add_column(
        "users",
        sa.Column(
            "profile_visibility",
            sa.Enum("public", "friends_only", "private", name="visibility"),
            nullable=False,
            server_default="public",
        ),
    )

    # 2. Add deletion_scheduled_at to users
    op.add_column(
        "users",
        sa.Column("deletion_scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. Add 'blocked' to friend_status enum for PostgreSQL
    if conn.dialect.name == "postgresql":
        op.execute("ALTER TYPE friend_status ADD VALUE IF NOT EXISTS 'blocked'")

    # 4. Create user_sessions table
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(), nullable=False),
        sa.Column("device_label", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_refresh_token_hash", "user_sessions", ["refresh_token_hash"])

    # 5. Create two_factor_auth table
    op.create_table(
        "two_factor_auth",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("totp_secret_encrypted", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("backup_codes_hashed", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Drop two_factor_auth table
    op.drop_table("two_factor_auth")

    # 2. Drop user_sessions table
    op.drop_index("ix_user_sessions_refresh_token_hash", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")

    # 3. Drop columns from users
    op.drop_column("users", "deletion_scheduled_at")
    op.drop_column("users", "profile_visibility")

    # 4. Drop visibility enum if postgresql
    if conn.dialect.name == "postgresql":
        sa.Enum(name="visibility").drop(conn, checkfirst=True)
