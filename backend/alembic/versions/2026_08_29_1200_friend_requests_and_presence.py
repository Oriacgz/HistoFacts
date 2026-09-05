"""Friend requests and presence tracking

Revision ID: f1e2d3c4b5a6
Revises: c7d8e9f0a1b2
Create Date: 2026-08-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old friends table (had composite PK user_id/friend_id)
    op.drop_table('friends')
    
    # Create new friends table with requester/addressee model
    op.create_table(
        'friends',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('requester_id', sa.String(), nullable=False),
        sa.Column('addressee_id', sa.String(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'accepted', name='friend_status'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['addressee_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('requester_id', 'addressee_id', name='uq_requester_addressee'),
    )
    op.create_index('ix_friends_requester_id', 'friends', ['requester_id'])
    op.create_index('ix_friends_addressee_id', 'friends', ['addressee_id'])
    
    # Create user_presence table
    op.create_table(
        'user_presence',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('user_presence')
    op.drop_index('ix_friends_addressee_id', table_name='friends')
    op.drop_index('ix_friends_requester_id', table_name='friends')
    op.drop_table('friends')
    
    # Recreate old friends table
    op.create_table(
        'friends',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('friend_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['friend_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'friend_id'),
    )