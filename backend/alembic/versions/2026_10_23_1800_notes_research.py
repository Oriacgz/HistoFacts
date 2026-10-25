"""Add bounded owner-scoped research runs without changing existing notes."""
from alembic import op
import sqlalchemy as sa

revision = "notes_research"
down_revision = "monument_learning"
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table("note_research_runs"):
        return
    op.create_table("note_research_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("root_id", sa.String(), nullable=True),
        sa.Column("note_id", sa.String(), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=True, unique=True),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_note_research_runs_user_id", "note_research_runs", ["user_id"])
    op.create_index("uq_research_running_owner", "note_research_runs", ["user_id"], unique=True,
                    sqlite_where=sa.text("state = 'running'"), postgresql_where=sa.text("state = 'running'"))


def downgrade():
    op.drop_index("uq_research_running_owner", table_name="note_research_runs")
    op.drop_index("ix_note_research_runs_user_id", table_name="note_research_runs")
    op.drop_table("note_research_runs")
