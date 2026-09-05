"""Index created_at on token_ledger, histoin_ledger, and messages

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-05 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. token_ledger.created_at index
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_ledger_created_at ON token_ledger (created_at);")

    # 2. histoin_ledger.created_at index
    op.execute("CREATE INDEX IF NOT EXISTS ix_histoin_ledger_created_at ON histoin_ledger (created_at);")

    # 3. messages.created_at index
    op.execute("CREATE INDEX IF NOT EXISTS ix_messages_created_at ON messages (created_at);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_messages_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_histoin_ledger_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_token_ledger_created_at;")
