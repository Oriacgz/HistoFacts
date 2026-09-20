"""Add post media, comment media_url, and post_votes

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-09-20 16:00:00.000000

Idempotent: service startup also runs Base.metadata.create_all, which may have
already created post_votes (and the media enum) without stamping alembic_version.
Each step checks current schema state so either bootstrap order converges.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _media_type_column() -> sa.Column:
    return sa.Column(
        "media_type",
        sa.Enum("none", "image", "video", name="post_media_type"),
        nullable=False,
        server_default="none",
    )


def _has_column(inspector, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspector.get_columns(table))


def _has_index(inspector, table: str, index: str) -> bool:
    return any(i["name"] == index for i in inspector.get_indexes(table))


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    media_enum = sa.Enum("none", "image", "video", name="post_media_type")
    media_enum.create(conn, checkfirst=True)

    if not _has_column(inspector, "posts", "media_urls"):
        op.add_column("posts", sa.Column("media_urls", sa.JSON(), nullable=True))
    if not _has_column(inspector, "posts", "media_type"):
        op.add_column("posts", _media_type_column())
    if not _has_column(inspector, "comments", "media_url"):
        op.add_column("comments", sa.Column("media_url", sa.String(), nullable=True))

    if not inspector.has_table("post_votes"):
        op.create_table(
            "post_votes",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("post_id", sa.String(), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("value", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("user_id", "post_id", name="uq_user_post_vote"),
        )
        op.create_index("ix_post_votes_user_id", "post_votes", ["user_id"])
        op.create_index("ix_post_votes_post_id", "post_votes", ["post_id"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if inspector.has_table("post_votes"):
        for index_name in ("ix_post_votes_post_id", "ix_post_votes_user_id"):
            if _has_index(inspector, "post_votes", index_name):
                op.drop_index(index_name, table_name="post_votes")
        op.drop_table("post_votes")

    if _has_column(inspector, "comments", "media_url"):
        op.drop_column("comments", "media_url")
    if _has_column(inspector, "posts", "media_type"):
        op.drop_column("posts", "media_type")
    if _has_column(inspector, "posts", "media_urls"):
        op.drop_column("posts", "media_urls")

    if conn.dialect.name == "postgresql":
        sa.Enum(name="post_media_type").drop(conn, checkfirst=True)
