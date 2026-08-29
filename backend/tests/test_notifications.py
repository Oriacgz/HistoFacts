"""
Tests for Notification Microservice and Inter-Service Event Notifications.
"""

import pytest
from httpx import AsyncClient

from app.core.inter_service import notify


@pytest.mark.asyncio
async def test_internal_notification_creation(client: AsyncClient):
    # 1. Register a user
    u_resp = await client.post(
        "/api/auth/register",
        json={"username": "NotifUser1", "email": "notif1@example.com", "password": "Password123!"},
    )
    assert u_resp.status_code == 201
    user_id = u_resp.json()["user"]["id"]

    # 2. Internal creation of notification
    create_resp = await client.post(
        "/internal/notifications",
        json={
            "user_id": user_id,
            "type": "note_ready",
            "payload": {"note_id": "note-123", "title": "French Revolution"},
        },
    )
    assert create_resp.status_code == 201
    notif = create_resp.json()
    assert notif["user_id"] == user_id
    assert notif["type"] == "note_ready"
    assert notif["payload"]["title"] == "French Revolution"
    assert notif["is_read"] is False

    # 3. Invalid notification type should be rejected with 422
    invalid_resp = await client.post(
        "/internal/notifications",
        json={
            "user_id": user_id,
            "type": "invalid_type_name",
            "payload": {},
        },
    )
    assert invalid_resp.status_code == 422


@pytest.mark.asyncio
async def test_unread_count_and_list_endpoints(client: AsyncClient):
    # 1. Register user
    u_resp = await client.post(
        "/api/auth/register",
        json={"username": "NotifUser2", "email": "notif2@example.com", "password": "Password123!"},
    )
    token = u_resp.json()["access_token"]
    user_id = u_resp.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Initial unread count should be 0
    count_resp = await client.get("/api/notifications/unread-count", headers=headers)
    assert count_resp.status_code == 200
    assert count_resp.json()["unread_count"] == 0

    # 3. Create 3 notifications
    for i in range(3):
        await client.post(
            "/internal/notifications",
            json={
                "user_id": user_id,
                "type": "comment_reply",
                "payload": {"comment_id": f"comm-{i}", "from_user": f"User{i}"},
            },
        )

    # 4. Check unread count is 3
    count_resp = await client.get("/api/notifications/unread-count", headers=headers)
    assert count_resp.json()["unread_count"] == 3

    # 5. List notifications
    list_resp = await client.get("/api/notifications", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 3

    # 6. Mark first notification read
    first_id = items[0]["id"]
    read_resp = await client.post(f"/api/notifications/{first_id}/read", headers=headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # 7. Check unread count is now 2
    count_resp = await client.get("/api/notifications/unread-count", headers=headers)
    assert count_resp.json()["unread_count"] == 2

    # 8. Filter unread_only=true returns 2 items
    unread_list_resp = await client.get("/api/notifications?unread_only=true", headers=headers)
    assert len(unread_list_resp.json()) == 2

    # 9. Mark all read
    read_all_resp = await client.post("/api/notifications/read-all", headers=headers)
    assert read_all_resp.status_code == 200
    assert read_all_resp.json()["updated_count"] == 2

    # 10. Check unread count is 0
    count_resp = await client.get("/api/notifications/unread-count", headers=headers)
    assert count_resp.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_notify_fire_and_forget_resilience():
    """
    Ensure that notify() never raises an exception even if the destination service
    is completely unreachable (e.g. port down / connection error).
    """
    # Calling notify with a dummy/unreachable port must not throw
    try:
        await notify(
            user_id="dummy-user-id",
            type="comment_reply",
            payload={"msg": "test"},
        )
    except Exception as e:
        pytest.fail(f"notify() raised an exception during unreachable network call: {e}")
