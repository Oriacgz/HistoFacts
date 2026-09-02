"""add chat tables (conversations, direct_participants, messages, conversation_reads)

Revision ID: c7d8e9f0a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-08-28 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('group_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # 2. direct_participants table
    op.create_table(
        'direct_participants',
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('conversation_id', 'user_id'),
    )

    # 3. messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('sender_id', sa.String(), nullable=False),
        sa.Column('message_type', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('shared_ref_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_messages_conv_created', 'messages', ['conversation_id', 'created_at'])
    op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])

    # 4. conversation_reads table
    op.create_table(
        'conversation_reads',
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('last_read_message_id', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['last_read_message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('conversation_id', 'user_id'),
    )


def downgrade() -> None:
    op.drop_table('conversation_reads')
    op.drop_index('ix_messages_conversation_id', table_name='messages')
    op.drop_index('ix_messages_conv_created', table_name='messages')
    op.drop_table('messages')
    op.drop_table('direct_participants')
    op.drop_table('conversations')
