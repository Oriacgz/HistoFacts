"""add_ai_hook_to_historical_events

Revision ID: 3fe808b90038
Revises: a7b8c9d0e1f2
Create Date: 2026-09-15 04:14:02.265864

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fe808b90038'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('historical_events', sa.Column('ai_hook', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('historical_events', 'ai_hook')
