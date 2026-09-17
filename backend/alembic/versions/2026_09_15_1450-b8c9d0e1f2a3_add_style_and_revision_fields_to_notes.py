"""add style, source_note_id, and attachment columns to notes

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-09-15 14:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('notes', sa.Column('style', sa.String(), server_default='standard', nullable=True))
    op.add_column('notes', sa.Column('source_note_id', sa.String(), nullable=True))
    op.add_column('notes', sa.Column('attachment_name', sa.String(), nullable=True))
    op.add_column('notes', sa.Column('attachment_type', sa.String(), nullable=True))

    op.create_foreign_key(
        'fk_notes_source_note_id_notes',
        'notes',
        'notes',
        ['source_note_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_notes_source_note_id_notes', 'notes', type_='foreignkey')
    op.drop_column('notes', 'attachment_type')
    op.drop_column('notes', 'attachment_name')
    op.drop_column('notes', 'source_note_id')
    op.drop_column('notes', 'style')
