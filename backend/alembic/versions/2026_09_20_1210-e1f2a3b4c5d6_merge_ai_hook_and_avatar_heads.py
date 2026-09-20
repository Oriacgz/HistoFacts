"""Merge the AI hook and avatar seed migration branches.

Revision ID: e1f2a3b4c5d6
Revises: 3fe808b90038, d0e1f2a3b4c5
Create Date: 2026-09-20 12:10:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = ('3fe808b90038', 'd0e1f2a3b4c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass