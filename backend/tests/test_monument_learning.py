import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, func, inspect, select, text

from app.core.security import create_access_token
from app.history.monuments.models import MonumentFavorite, MonumentTourCompletion
from app.ai_notes.models import HistoinLedger


def auth(user_id):
    return {"Authorization": f"Bearer {create_access_token({'sub': user_id})}"}


@pytest.mark.asyncio
async def test_learning_requires_authentication(client):
    for method, path, body in [
        ("GET", "/favorites", None), ("GET", "/progress", None),
        ("PUT", "/favorites/taj-mahal", None), ("DELETE", "/favorites/taj-mahal", None),
        ("PUT", "/progress/taj-mahal", {"tour_revision": 1}),
    ]:
        response = await client.request(method, f"/api/monuments{path}", json=body)
        assert response.status_code in {401, 403}
    response = await client.get("/api/monuments/favorites", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_favorites_are_idempotent_and_owned(client, db_session):
    a, b = auth("monument-owner-a"), auth("monument-owner-b")
    first = await client.put("/api/monuments/favorites/taj-mahal", headers=a)
    again = await client.put("/api/monuments/favorites/taj-mahal", headers=a)
    assert first.status_code == again.status_code == 200
    assert first.json() == again.json()
    assert (await client.get("/api/monuments/favorites", headers=b)).json() == []
    # Supplying another subject in a query cannot change the owner inferred from JWT.
    mine = await client.get("/api/monuments/favorites?user_id=monument-owner-b", headers=a)
    assert [row["monument_id"] for row in mine.json()] == ["taj-mahal"]
    await client.delete("/api/monuments/favorites/taj-mahal", headers=b)
    assert len((await client.get("/api/monuments/favorites", headers=a)).json()) == 1
    assert (await db_session.scalar(select(func.count()).select_from(MonumentFavorite))) == 1
    for _ in range(2):
        assert (await client.delete("/api/monuments/favorites/taj-mahal", headers=a)).status_code == 200
    assert (await client.get("/api/monuments/favorites", headers=a)).json() == []


@pytest.mark.asyncio
async def test_completion_is_owned_versioned_idempotent_and_has_no_rewards(client, db_session):
    headers = auth("tour-owner")
    first = await client.put("/api/monuments/progress/taj-mahal", headers=headers, json={"tour_revision": 1})
    again = await client.put("/api/monuments/progress/taj-mahal", headers=headers, json={"tour_revision": 1})
    assert first.status_code == again.status_code == 200
    assert first.json() == again.json()
    assert first.json()["tour_revision"] == 1
    assert (await client.get("/api/monuments/progress", headers=auth("other-owner"))).json() == []
    assert len((await client.get("/api/monuments/progress", headers=headers)).json()) == 1
    assert (await db_session.scalar(select(func.count()).select_from(MonumentTourCompletion))) == 1
    assert (await db_session.scalar(select(func.count()).select_from(HistoinLedger))) == 0


@pytest.mark.asyncio
async def test_registry_and_request_validation(client):
    headers = auth("validation-owner")
    for route in ["favorites", "progress"]:
        response = await client.put(f"/api/monuments/{route}/unknown", headers=headers, json={"tour_revision": 1})
        assert response.status_code == 404
    for body, status in [({"tour_revision": 2}, 409), ({"tour_revision": 0}, 422),
                         ({"tour_revision": True}, 422), ({"tour_revision": 1, "user_id": "someone-else"}, 422)]:
        response = await client.put("/api/monuments/progress/taj-mahal", headers=headers, json=body)
        assert response.status_code == status


@pytest.mark.asyncio
async def test_history_service_mounts_learning_routes_and_gateway_targets_history(client, db_session):
    from app.history.main import app as history_app
    from app.gateway.main import resolve_target_service
    from app.core.config import settings
    from app.core.database import get_async_session

    async def sessions():
        yield db_session

    history_app.dependency_overrides[get_async_session] = sessions
    try:
        async with AsyncClient(transport=ASGITransport(app=history_app), base_url="http://history") as service:
            response = await service.put("/api/monuments/favorites/qutub-minar", headers=auth("service-owner"))
            assert response.status_code == 200
            assert (await client.get("/api/monuments/favorites", headers=auth("service-owner"))).json()[0]["monument_id"] == "qutub-minar"
            assert (await service.get("/internal/users/service-owner/export")).status_code == 403
            internal = {"X-Internal-Secret": settings.secret_key}
            exported = await service.get("/internal/users/service-owner/export", headers=internal)
            assert len(exported.json()["favorites"]) == 1
            assert (await service.post("/internal/users/service-owner/purge", headers=internal)).status_code == 200
            assert (await client.get("/api/monuments/favorites", headers=auth("service-owner"))).json() == []
    finally:
        history_app.dependency_overrides.clear()
    assert resolve_target_service("/api/monuments/favorites")[0] == settings.history_service_url


def test_monument_migration_upgrade_downgrade_preserves_legacy_data():
    path = Path(__file__).parents[1] / "alembic/versions/2026_10_17_1600_monument_learning.py"
    spec = importlib.util.spec_from_file_location("monument_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///:memory:")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE legacy_probe (id INTEGER PRIMARY KEY, value TEXT)"))
            connection.execute(text("INSERT INTO legacy_probe VALUES (1, 'preserved')"))
            migration.op = Operations(MigrationContext.configure(connection))
            migration.upgrade()
            connection.execute(text("INSERT INTO monument_favorites (user_id,monument_id) VALUES ('owner','taj-mahal')"))
            migration.upgrade()
            assert connection.scalar(text("SELECT COUNT(*) FROM monument_favorites")) == 1
            assert inspect(connection).get_pk_constraint("monument_favorites")["constrained_columns"] == ["user_id", "monument_id"]
            assert inspect(connection).get_pk_constraint("monument_tour_completions")["constrained_columns"] == ["user_id", "monument_id", "tour_revision"]
            migration.downgrade()
            assert not inspect(connection).has_table("monument_favorites")
            assert connection.scalar(text("SELECT value FROM legacy_probe WHERE id=1")) == "preserved"
            migration.upgrade()
            assert inspect(connection).has_table("monument_tour_completions")
    finally:
        engine.dispose()


@pytest.mark.asyncio
async def test_learning_export_and_purge_preserve_other_accounts(client, db_session):
    from app.auth.service import _in_process_export, _in_process_purge
    for user_id in ["export-owner", "retained-owner"]:
        await client.put("/api/monuments/favorites/taj-mahal", headers=auth(user_id))
        await client.put("/api/monuments/progress/taj-mahal", headers=auth(user_id), json={"tour_revision": 1})
    exported = await _in_process_export(db_session, "export-owner", "monuments.json")
    assert len(exported["favorites"]) == len(exported["completed_tours"]) == 1
    await _in_process_purge(db_session, "export-owner")
    await db_session.commit()
    assert (await client.get("/api/monuments/favorites", headers=auth("export-owner"))).json() == []
    assert len((await client.get("/api/monuments/favorites", headers=auth("retained-owner"))).json()) == 1
