import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
import sqlalchemy as sa


def test_session_memory_migration_repeat_and_rollback_preserves_notes():
    path=Path(__file__).parents[1]/'alembic/versions/2026_10_24_1100_session_memory.py'
    spec=importlib.util.spec_from_file_location('session_memory_migration',path)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    engine=sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE notes (id VARCHAR PRIMARY KEY, content TEXT, title VARCHAR, source_note_id VARCHAR)')
        connection.exec_driver_sql("INSERT INTO notes VALUES ('old','Original preserved','History',NULL)")
        migration.op=Operations(MigrationContext.configure(connection))
        migration.upgrade();migration.upgrade()
        assert connection.exec_driver_sql('SELECT kind FROM notes').scalar()=='conversation'
        assert sa.inspect(connection).has_table('note_session_memory')
        migration.downgrade()
        assert connection.exec_driver_sql('SELECT content FROM notes').scalar()=='Original preserved'
    engine.dispose()


def test_research_migration_upgrade_downgrade_keeps_plain_notes():
    path = Path(__file__).parents[1] / "alembic/versions/2026_10_23_1800_notes_research.py"
    spec = importlib.util.spec_from_file_location("research_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE notes (id VARCHAR PRIMARY KEY, content TEXT)")
        connection.exec_driver_sql("INSERT INTO notes VALUES ('old-note', 'Keep this plain note')")
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        migration.upgrade()
        assert sa.inspect(connection).has_table("note_research_runs")
        migration.downgrade()
        assert not sa.inspect(connection).has_table("note_research_runs")
        assert connection.exec_driver_sql("SELECT content FROM notes").scalar() == "Keep this plain note"
    engine.dispose()


def test_details_migration_backfills_and_rolls_back_without_losing_sources():
    path = Path(__file__).parents[1] / 'alembic/versions/2026_10_24_0200_research_details.py'
    spec=importlib.util.spec_from_file_location('details_migration',path)
    migration=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine=sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE note_research_runs (id VARCHAR PRIMARY KEY,sources JSON)')
        connection.exec_driver_sql("INSERT INTO note_research_runs VALUES ('old','[]')")
        migration.op=Operations(MigrationContext.configure(connection))
        migration.upgrade()
        migration.upgrade()
        assert connection.exec_driver_sql('SELECT details FROM note_research_runs').scalar() == '{}'
        migration.downgrade()
        assert connection.exec_driver_sql('SELECT sources FROM note_research_runs').scalar() == '[]'
    engine.dispose()
