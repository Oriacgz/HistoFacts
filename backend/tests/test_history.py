"""
Tests for History Content module (events, search, bookmarks).
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_events_and_search(client: AsyncClient):
    # 1. Get events for date
    resp = await client.get("/api/events/date/3/17")
    assert resp.status_code == 200
    events = resp.json()
    assert isinstance(events, list)
    assert len(events) > 0

    # 2. Search events
    search_resp = await client.get("/api/events/search?q=Patrick")
    assert search_resp.status_code == 200
    search_results = search_resp.json()
    assert len(search_results) > 0
    assert any("Patrick" in e["title"] or "Patrick" in e["description"] for e in search_results)


@pytest.mark.asyncio
async def test_bookmarks_flow(client: AsyncClient):
    # 1. Register a user for bookmark testing
    reg_resp = await client.post(
        "/api/auth/register",
        json={
            "username": "BookmarkUser",
            "email": "bookmark@example.com",
            "password": "Password123!",
        },
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get an event ID
    events_resp = await client.get("/api/events/date/3/17")
    event_id = events_resp.json()[0]["id"]

    # 3. Create bookmark
    bm_resp = await client.post(f"/api/events/bookmarks/{event_id}", headers=headers)
    assert bm_resp.status_code == 201
    assert bm_resp.json()["event_id"] == event_id

    # 4. List my bookmarks
    my_bm_resp = await client.get("/api/events/bookmarks/me", headers=headers)
    assert my_bm_resp.status_code == 200
    bookmarks = my_bm_resp.json()
    assert len(bookmarks) == 1
    assert bookmarks[0]["event"]["id"] == event_id

    # 5. Delete bookmark
    del_resp = await client.delete(f"/api/events/bookmarks/{event_id}", headers=headers)
    assert del_resp.status_code == 204
