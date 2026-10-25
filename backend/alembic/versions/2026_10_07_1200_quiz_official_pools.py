"""Add official quiz pools and server-owned session state."""
from alembic import op
import sqlalchemy as sa

revision = "quiz_official_pools"
down_revision = "2e784ef853ee"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("quiz_questions", sa.Column("is_global_pool", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("quiz_questions", sa.Column("global_period", sa.String(), nullable=True))
    op.create_index("ix_quiz_questions_global_period", "quiz_questions", ["global_period"])
    op.add_column("quiz_sessions", sa.Column("question_ids", sa.JSON(), nullable=True))
    op.add_column("quiz_sessions", sa.Column("global_period", sa.String(), nullable=True))
    op.add_column("quiz_sessions", sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_index("ix_quiz_sessions_global_period", "quiz_sessions", ["global_period"])
    with op.batch_alter_table("quiz_sessions") as batch:
        batch.create_unique_constraint("uq_quiz_user_period", ["user_id", "global_period"])
    op.create_table("quiz_global_pools", sa.Column("period", sa.String(), primary_key=True))


def downgrade():
    op.drop_table("quiz_global_pools")
    with op.batch_alter_table("quiz_sessions") as batch:
        batch.drop_constraint("uq_quiz_user_period", type_="unique")
    op.drop_index("ix_quiz_sessions_global_period", table_name="quiz_sessions")
    op.drop_column("quiz_sessions", "completed")
    op.drop_column("quiz_sessions", "global_period")
    op.drop_column("quiz_sessions", "question_ids")
    op.drop_index("ix_quiz_questions_global_period", table_name="quiz_questions")
    op.drop_column("quiz_questions", "global_period")
    op.drop_column("quiz_questions", "is_global_pool")
