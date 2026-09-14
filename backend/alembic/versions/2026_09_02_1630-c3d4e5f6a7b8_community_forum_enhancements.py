"""community forum enhancements (posts, comments, polymorphic likes, shares, user moderation)

Revision ID: c3d4e5f6a7b8
Revises: f1e2d3c4b5a6
Create Date: 2026-09-02 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. USERS TABLE
    # -------------------------------------------------------------
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("post_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("is_banned", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("users", sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True))

    # -------------------------------------------------------------
    # 2. POSTS TABLE
    # -------------------------------------------------------------
    op.add_column("posts", sa.Column("title", sa.String(), nullable=True))
    op.add_column("posts", sa.Column("comment_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("posts", sa.Column("share_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("posts", sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("posts", sa.Column("is_locked", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("posts", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    # Feed Partial Indexes
    op.create_index(
        "idx_posts_feed",
        "posts",
        [sa.text("created_at DESC"), "id"],
        unique=False,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )
    op.create_index(
        "idx_posts_group_feed",
        "posts",
        ["group_id", sa.text("created_at DESC")],
        unique=False,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )

    # -------------------------------------------------------------
    # 3. COMMENTS TABLE
    # -------------------------------------------------------------
    op.add_column("comments", sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("comments", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index(
        "idx_comments_post",
        "comments",
        ["post_id", "created_at"],
        unique=False,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )
    op.create_index(
        "idx_comments_parent",
        "comments",
        ["parent_comment_id"],
        unique=False,
        postgresql_where=sa.text("parent_comment_id IS NOT NULL"),
    )

    # -------------------------------------------------------------
    # 4. LIKES TABLE (Polymorphic target migration & backfill)
    # -------------------------------------------------------------
    op.add_column("likes", sa.Column("target_type", sa.String(), nullable=True))
    op.add_column("likes", sa.Column("target_id", sa.String(), nullable=True))

    # Data backfill
    op.execute("UPDATE likes SET target_type = 'post', target_id = post_id WHERE post_id IS NOT NULL")
    op.execute("UPDATE likes SET target_type = 'comment', target_id = comment_id WHERE comment_id IS NOT NULL")

    op.alter_column("likes", "target_type", nullable=False)
    op.alter_column("likes", "target_id", nullable=False)

    # Drop old constraints & columns
    op.drop_constraint("uq_user_post_like", "likes", type_="unique")
    op.drop_constraint("uq_user_comment_like", "likes", type_="unique")
    op.drop_constraint("likes_post_id_fkey", "likes", type_="foreignkey")
    op.drop_constraint("likes_comment_id_fkey", "likes", type_="foreignkey")
    op.drop_index(op.f("ix_likes_post_id"), table_name="likes")
    op.drop_index(op.f("ix_likes_comment_id"), table_name="likes")
    op.drop_column("likes", "post_id")
    op.drop_column("likes", "comment_id")

    # Add new polymorphic constraint & index
    op.create_unique_constraint("uq_user_target_like", "likes", ["user_id", "target_type", "target_id"])
    op.create_index("idx_likes_target", "likes", ["target_type", "target_id"], unique=False)

    # -------------------------------------------------------------
    # 5. SHARES TABLE
    # -------------------------------------------------------------
    inspector = sa.inspect(op.get_bind())
    if "shares" not in inspector.get_table_names():
        op.create_table(
            "shares",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("target_type", sa.String(), nullable=False),
            sa.Column("target_id", sa.String(), nullable=False),
            sa.Column("share_channel", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("shares")}
    if "idx_shares_target" not in existing_indexes:
        op.create_index("idx_shares_target", "shares", ["target_type", "target_id"], unique=False)
    if op.f("ix_shares_user_id") not in existing_indexes:
        op.create_index(op.f("ix_shares_user_id"), "shares", ["user_id"], unique=False)


def downgrade() -> None:
    # 1. Shares
    op.drop_index(op.f("ix_shares_user_id"), table_name="shares")
    op.drop_index("idx_shares_target", table_name="shares")
    op.drop_table("shares")

    # 2. Likes
    op.drop_index("idx_likes_target", table_name="likes")
    op.drop_constraint("uq_user_target_like", "likes", type_="unique")
    op.add_column("likes", sa.Column("comment_id", sa.VARCHAR(), nullable=True))
    op.add_column("likes", sa.Column("post_id", sa.VARCHAR(), nullable=True))
    op.create_index(op.f("ix_likes_comment_id"), "likes", ["comment_id"], unique=False)
    op.create_index(op.f("ix_likes_post_id"), "likes", ["post_id"], unique=False)
    op.create_foreign_key("likes_comment_id_fkey", "likes", "comments", ["comment_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("likes_post_id_fkey", "likes", "posts", ["post_id"], ["id"], ondelete="CASCADE")
    op.create_unique_constraint("uq_user_post_like", "likes", ["user_id", "post_id"])
    op.create_unique_constraint("uq_user_comment_like", "likes", ["user_id", "comment_id"])
    op.drop_column("likes", "target_id")
    op.drop_column("likes", "target_type")

    # 3. Comments
    op.drop_index("idx_comments_parent", table_name="comments")
    op.drop_index("idx_comments_post", table_name="comments")
    op.drop_column("comments", "updated_at")
    op.drop_column("comments", "is_deleted")

    # 4. Posts
    op.drop_index("idx_posts_group_feed", table_name="posts")
    op.drop_index("idx_posts_feed", table_name="posts")
    op.drop_column("posts", "updated_at")
    op.drop_column("posts", "is_locked")
    op.drop_column("posts", "is_deleted")
    op.drop_column("posts", "share_count")
    op.drop_column("posts", "comment_count")
    op.drop_column("posts", "title")

    # 5. Users
    op.drop_column("users", "banned_at")
    op.drop_column("users", "is_banned")
    op.drop_column("users", "post_count")
    op.drop_column("users", "bio")
