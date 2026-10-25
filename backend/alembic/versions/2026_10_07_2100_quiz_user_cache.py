"""Create the quiz profile cache for databases provisioned through migrations."""
from alembic import op
import sqlalchemy as sa

revision = "quiz_user_cache"
down_revision = "quiz_official_pools"
branch_labels = None
depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table("quiz_user_summary_cache"):
        op.create_table(
            "quiz_user_summary_cache",
            sa.Column("user_id", sa.String(), primary_key=True),
            sa.Column("username", sa.String(), nullable=False),
            sa.Column("tag", sa.String(), nullable=False),
            sa.Column("avatar_url", sa.String(), nullable=True),
            sa.Column("bio", sa.Text(), nullable=True),
            sa.Column("is_banned", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade():
    if sa.inspect(op.get_bind()).has_table("quiz_user_summary_cache"):
        op.drop_table("quiz_user_summary_cache")
