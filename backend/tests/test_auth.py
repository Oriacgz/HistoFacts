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
    user_b = resp_b.json()["user"]

    # 3. Add Friend (User A adds User B)
    add_resp = await client.post(
        "/api/auth/friends",
        json={"friend_id": user_b["id"]},
        headers=headers_a,
    )
    assert add_resp.status_code == 201
    assert add_resp.json()["username"] == "BobScholar"

    # 4. List Friends for User A
    list_resp = await client.get("/api/auth/friends", headers=headers_a)
    assert list_resp.status_code == 200
    friends = list_resp.json()
    assert len(friends) == 1
    assert friends[0]["id"] == user_b["id"]

    # 5. Remove Friend
    del_resp = await client.delete(f"/api/auth/friends/{user_b['id']}", headers=headers_a)
    assert del_resp.status_code == 204

    # 6. Verify empty list
    list_resp2 = await client.get("/api/auth/friends", headers=headers_a)
    assert list_resp2.status_code == 200
    assert len(list_resp2.json()) == 0

