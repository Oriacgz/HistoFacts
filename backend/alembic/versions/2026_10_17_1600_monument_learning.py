"""Add account-owned monument favorites and versioned tour completions."""
from alembic import op
import sqlalchemy as sa

revision = "monument_learning"
down_revision = "quiz_user_cache"
branch_labels = None
depends_on = None


def upgrade():
    # The monolithic startup may already have created these exact ORM tables.
    if not sa.inspect(op.get_bind()).has_table("monument_favorites"):
        op.create_table("monument_favorites",
            sa.Column("user_id", sa.String(), primary_key=True),
            sa.Column("monument_id", sa.String(64), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    if not sa.inspect(op.get_bind()).has_table("monument_tour_completions"):
        op.create_table("monument_tour_completions",
            sa.Column("user_id", sa.String(), primary_key=True),
            sa.Column("monument_id", sa.String(64), primary_key=True),
            sa.Column("tour_revision", sa.Integer(), primary_key=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade():
    # Drops only this feature's records. Export them before a non-test rollback.
    op.drop_table("monument_tour_completions")
    op.drop_table("monument_favorites")
