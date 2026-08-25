"""
Test Alembic migration upgrade and downgrade consistency.
"""

import pytest
import os
from alembic.config import Config
from alembic import command
from sqlalchemy import inspect
from app.core.config import settings


def test_alembic_migrations():
    alembic_cfg = Config(os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini"))
    # Use in-memory or test SQLite database
    test_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "test_migrations.db")
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{test_db_path}")

    try:
        # Run upgrade to head
        command.upgrade(alembic_cfg, "head")

        # Verify all tables exist
        from sqlalchemy import create_engine
        engine = create_engine(f"sqlite:///{test_db_path}")
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        expected_tables = {
            "historical_events",
            "users",
            "bookmarks",
            "friends",
            "groups",
            "notes",
            "quiz_questions",
            "group_members",
            "group_shared_notes",
            "posts",
            "quiz_attempts",
            "comments",
            "likes",
            "quiz_sessions",
            "user_token_wallets",
            "token_ledger",
            "histoin_wallets",
            "histoin_ledger",
            "token_packs",
            "alembic_version",
        }

        assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"

        # Run downgrade to base
        command.downgrade(alembic_cfg, "base")
        inspector = inspect(engine)
        remaining_tables = set(inspector.get_table_names()) - {"alembic_version"}
        assert len(remaining_tables) == 0, f"Tables not dropped on downgrade: {remaining_tables}"
        engine.dispose()

    finally:
        try:
            if os.path.exists(test_db_path):
                os.remove(test_db_path)
        except Exception:
            pass
