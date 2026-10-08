import importlib.util
from pathlib import Path
import subprocess

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


BACKEND = Path(__file__).resolve().parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("existing", [False, True])
def test_avatar_cache_migration_handles_absent_and_existing_tables(monkeypatch, existing):
    migration = load_module("avatar_cache_migration", BACKEND / "alembic/versions/2026_09_20_1830-f3b4c5d6e7f8_add_avatar_seed_to_user_summary_cache.py")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        if existing:
            connection.exec_driver_sql("CREATE TABLE social_user_summary_cache (user_id VARCHAR PRIMARY KEY)")
            connection.exec_driver_sql("INSERT INTO social_user_summary_cache VALUES ('preserved')")
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        migration.upgrade()
        if existing:
            assert "avatar_seed" in {column["name"] for column in sa.inspect(connection).get_columns("social_user_summary_cache")}
            assert connection.exec_driver_sql("SELECT user_id FROM social_user_summary_cache").scalar_one() == "preserved"
        else:
            assert not sa.inspect(connection).has_table("social_user_summary_cache")
        migration.downgrade()
        migration.downgrade()
    engine.dispose()


@pytest.mark.parametrize("failure", [subprocess.CalledProcessError(1, "alembic"), subprocess.TimeoutExpired("alembic", 120)])
def test_supervisor_never_launches_services_after_failed_migrations(monkeypatch, failure):
    supervisor = load_module("microservice_supervisor", BACKEND / "run_microservices.py")
    monkeypatch.setattr(supervisor.sys, "argv", ["run_microservices.py"])
    monkeypatch.setattr(supervisor.signal, "signal", lambda *args: None)
    def fail(*args, **kwargs):
        raise failure
    def unexpected_launch(*args, **kwargs):
        pytest.fail("Service launched before successful migrations")
    monkeypatch.setattr(supervisor.subprocess, "run", fail)
    monkeypatch.setattr(supervisor.subprocess, "Popen", unexpected_launch)
    assert supervisor.main() == 1


def test_quiz_cache_migration_creates_table_and_preserves_existing_rows(monkeypatch):
    migration = load_module("quiz_cache_migration", BACKEND / "alembic/versions/2026_10_07_2100_quiz_user_cache.py")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        connection.exec_driver_sql("INSERT INTO quiz_user_summary_cache (user_id, username, tag) VALUES ('preserved', 'Scholar', '0001')")
        migration.upgrade()
        row = connection.exec_driver_sql("SELECT user_id, is_banned FROM quiz_user_summary_cache").one()
        assert row.user_id == "preserved" and not row.is_banned
        assert {column["name"] for column in sa.inspect(connection).get_columns("quiz_user_summary_cache")} == {
            "user_id", "username", "tag", "avatar_url", "bio", "is_banned", "synced_at"}
        migration.downgrade()
        assert not sa.inspect(connection).has_table("quiz_user_summary_cache")
    engine.dispose()
