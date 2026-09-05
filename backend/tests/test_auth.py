"""
Tests for Auth & Identity module.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # 1. Register
    reg_payload = {
        "username": "HistoryScholar",
        "email": "scholar@example.com",
        "password": "SecurePassword123!",
    }
    reg_resp = await client.post("/api/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    user = data["user"]
    assert user["username"] == "HistoryScholar"
    assert len(user["tag"]) == 4
    assert user["email"] == "scholar@example.com"

    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # 2. Login
    login_payload = {
        "email": "scholar@example.com",
        "password": "SecurePassword123!",
    }
    login_resp = await client.post("/api/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data

    # 3. Get /me with token
    headers = {"Authorization": f"Bearer {access_token}"}
    me_resp = await client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "HistoryScholar"

    # 4. Refresh token
    refresh_resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.json()


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload1 = {
        "username": "InitialUser",
        "email": "duplicate@example.com",
        "password": "Password123!",
    }
    r1 = await client.post("/api/auth/register", json=payload1)
    assert r1.status_code == 201

    payload2 = {
        "username": "SecondUser",
        "email": "duplicate@example.com",
        "password": "Password456!",
    }
    resp = await client.post("/api/auth/register", json=payload2)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    # Register first
    await client.post(
        "/api/auth/register",
        json={"username": "LoginTester", "email": "logintester@example.com", "password": "CorrectPassword123!"},
    )
    payload = {
        "email": "logintester@example.com",
        "password": "WrongPassword!",
    }
    resp = await client.post("/api/auth/login", json=payload)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_friends_flow(client: AsyncClient):
    # 1. Register User A
    resp_a = await client.post(
        "/api/auth/register",
        json={"username": "AliceScholar", "email": "alice@example.com", "password": "Password123!"},
    )
    assert resp_a.status_code == 201
    token_a = resp_a.json()["access_token"]
    user_a = resp_a.json()["user"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register User B
    resp_b = await client.post(
        "/api/auth/register",
        json={"username": "BobScholar", "email": "bob@example.com", "password": "Password123!"},
    )
    assert resp_b.status_code == 201
    token_b = resp_b.json()["access_token"]
    user_b = resp_b.json()["user"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. User A sends friend request to User B
    add_resp = await client.post(
        "/api/auth/friends/request",
        json={"addressee_id": user_b["id"]},
        headers=headers_a,
    )
    assert add_resp.status_code == 201
    request_data = add_resp.json()
    assert request_data["addressee_id"] == user_b["id"]
    assert request_data["status"] == "pending"
    request_id = request_data["id"]

    # 4. User B sees incoming request
    incoming_resp = await client.get("/api/auth/friends/requests/incoming", headers=headers_b)
    assert incoming_resp.status_code == 200
    incoming = incoming_resp.json()
    assert len(incoming) == 1
    assert incoming[0]["id"] == request_id

    # 5. User B accepts the request
    accept_resp = await client.post(
        f"/api/auth/friends/requests/{request_id}/accept",
        headers=headers_b,
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "accepted"

    # 6. List Friends for User A (with presence)
    list_resp = await client.get("/api/auth/friends", headers=headers_a)
    assert list_resp.status_code == 200
    friends = list_resp.json()
    assert len(friends) == 1
    assert friends[0]["id"] == user_b["id"]
    assert friends[0]["username"] == "BobScholar"
    assert "is_online" in friends[0]
    assert "last_seen_at" in friends[0]

    # 7. List Friends for User B
    list_resp_b = await client.get("/api/auth/friends", headers=headers_b)
    assert list_resp_b.status_code == 200
    friends_b = list_resp_b.json()
    assert len(friends_b) == 1
    assert friends_b[0]["id"] == user_a["id"]

    # 8. Remove Friend (User A unfriends User B)
    del_resp = await client.delete(f"/api/auth/friends/{user_b['id']}", headers=headers_a)
    assert del_resp.status_code == 204

    # 9. Verify empty list
    list_resp2 = await client.get("/api/auth/friends", headers=headers_a)
    assert list_resp2.status_code == 200
    assert len(list_resp2.json()) == 0

