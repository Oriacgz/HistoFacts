"""
Tests for Social module (posts, threaded comments, likes).
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_social_flow(client: AsyncClient):
    # 1. Register two users
    u1_resp = await client.post(
        "/api/auth/register",
        json={"username": "AliceWriter", "email": "alice@example.com", "password": "Password123!"},
    )
    t1 = u1_resp.json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}

    u2_resp = await client.post(
        "/api/auth/register",
        json={"username": "BobReader", "email": "bob@example.com", "password": "Password123!"},
    )
    t2 = u2_resp.json()["access_token"]
    h2 = {"Authorization": f"Bearer {t2}"}

    # 2. Alice creates a post
    post_resp = await client.post(
        "/api/social/posts",
        json={"content": "Did you know that the Library of Alexandria was accidentally burned by Julius Caesar?"},
        headers=h1,
    )
    assert post_resp.status_code == 201
    post = post_resp.json()
    post_id = post["id"]

    # 3. Bob comments on Alice's post
    comm_resp = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={"content": "Fascinating fact! Wasn't it partially destroyed multiple times?"},
        headers=h2,
    )
    assert comm_resp.status_code == 201
    comm = comm_resp.json()
    comm_id = comm["id"]

    # 4. Alice writes a threaded reply to Bob's comment
    reply_resp = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={
            "parent_comment_id": comm_id,
            "content": "Yes, exactly! Several subsequent attacks destroyed the rest.",
        },
        headers=h1,
    )
    assert reply_resp.status_code == 201
    assert reply_resp.json()["parent_comment_id"] == comm_id

    # 5. Bob likes Alice's post
    like_resp = await client.post(f"/api/social/posts/{post_id}/like", headers=h2)
    assert like_resp.status_code == 200
    like_data = like_resp.json()
    assert like_data["liked"] is True
    assert like_data["new_like_count"] >= 1
