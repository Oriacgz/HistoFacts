"""add wallets, ledgers, token packs, and quiz sessions

Revision ID: a1b2c3d4e5f6
Revises: 745133cf15c6
Create Date: 2026-08-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '745133cf15c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. quiz_sessions
    op.create_table(
        'quiz_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('quiz_type', sa.String(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('difficulty', sa.String(), server_default='medium', nullable=True),
        sa.Column('score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_score', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('correct_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('wrong_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_time_seconds', sa.Integer(), server_default='0', nullable=True),
        sa.Column('rank', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_quiz_sessions_user_id'), 'quiz_sessions', ['user_id'], unique=False)
    op.create_index(op.f('ix_quiz_sessions_quiz_type'), 'quiz_sessions', ['quiz_type'], unique=False)

    # 2. user_token_wallets
    op.create_table(
        'user_token_wallets',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('token_balance', sa.Integer(), nullable=False, server_default='350000'),
        sa.Column('last_refresh_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('user_id'),
    )

    # 3. token_ledger
    op.create_table(
        'token_ledger',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('delta', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_token_ledger_user_id'), 'token_ledger', ['user_id'], unique=False)

    # 4. histoin_wallets
    op.create_table(
        'histoin_wallets',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('balance', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('user_id'),
    )

    # 5. histoin_ledger
    op.create_table(
        'histoin_ledger',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('delta', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_histoin_ledger_user_id'), 'histoin_ledger', ['user_id'], unique=False)

    # 6. token_packs
    op.create_table(
        'token_packs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('token_amount', sa.Integer(), nullable=False),
        sa.Column('histoin_cost', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('token_packs')
    op.drop_index(op.f('ix_histoin_ledger_user_id'), table_name='histoin_ledger')
    op.drop_table('histoin_ledger')
    op.drop_table('histoin_wallets')
    op.drop_index(op.f('ix_token_ledger_user_id'), table_name='token_ledger')
    op.drop_table('token_ledger')
    op.drop_table('user_token_wallets')
    op.drop_index(op.f('ix_quiz_sessions_quiz_type'), table_name='quiz_sessions')
    op.drop_index(op.f('ix_quiz_sessions_user_id'), table_name='quiz_sessions')
    op.drop_table('quiz_sessions')
