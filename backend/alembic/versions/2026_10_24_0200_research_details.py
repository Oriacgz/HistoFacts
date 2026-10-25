"""Research outcome and measured usage, preserving existing saved sources."""
from alembic import op
import sqlalchemy as sa

revision = "research_details"
down_revision = "notes_research"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("note_research_runs")}
    if "details" not in columns:
        op.add_column("note_research_runs", sa.Column("details", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))


def downgrade():
    op.drop_column("note_research_runs", "details")
