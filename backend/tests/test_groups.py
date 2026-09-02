"""
Tests for Groups module (group creation with minimum 3 members, membership, group feed).
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_groups_flow(client: AsyncClient):
    # 1. Register 3 users (leader, member1, member2)
    owner_resp = await client.post(
        "/api/auth/register",
        json={"username": "GroupLeader", "email": "leader@example.com", "password": "Password123!"},
    )
    t1 = owner_resp.json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}

    member1_resp = await client.post(
        "/api/auth/register",
        json={"username": "GroupMember1", "email": "member1@example.com", "password": "Password123!"},
    )
    t2 = member1_resp.json()["access_token"]
    u2_id = member1_resp.json()["user"]["id"]
    h2 = {"Authorization": f"Bearer {t2}"}

    member2_resp = await client.post(
        "/api/auth/register",
        json={"username": "GroupMember2", "email": "member2@example.com", "password": "Password123!"},
    )
    u3_id = member2_resp.json()["user"]["id"]

    member3_resp = await client.post(
        "/api/auth/register",
        json={"username": "GroupMember3", "email": "member3@example.com", "password": "Password123!"},
    )
    t4 = member3_resp.json()["access_token"]
    h4 = {"Authorization": f"Bearer {t4}"}

    # 2. Rejection when fewer than 2 initial members provided (total < 3)
    fail_payload = {
        "name": "WWII Study Circle",
        "description": "Deep dive into 20th century European theater.",
        "member_ids": [u2_id],  # only 1 invited -> total 2 -> must fail
    }
    fail_resp = await client.post("/api/groups", json=fail_payload, headers=h1)
    assert fail_resp.status_code == 400

    # 3. Leader creates a group with 2 invited members (total 3)
    grp_payload = {
        "name": "WWII Study Circle",
        "description": "Deep dive into 20th century European theater and Pacific operations.",
        "member_ids": [u2_id, u3_id],
    }
    grp_resp = await client.post("/api/groups", json=grp_payload, headers=h1)
    assert grp_resp.status_code == 201
    grp = grp_resp.json()
    grp_id = grp["id"]
    assert grp["name"] == "WWII Study Circle"
    assert grp["member_count"] == 3

    # 4. Leader lists groups
    list_resp = await client.get("/api/groups", headers=h1)
    assert list_resp.status_code == 200
    all_grps = list_resp.json()
    assert any(g["id"] == grp_id for g in all_grps)

    # 5. Member 1 (already invited) can see group
    member_grps_resp = await client.get("/api/groups", headers=h2)
    assert member_grps_resp.status_code == 200
    assert any(g["id"] == grp_id for g in member_grps_resp.json())

    # 6. Member 3 joins group
    join_resp = await client.post(f"/api/groups/{grp_id}/join", headers=h4)
    assert join_resp.status_code == 200

    # 7. Member posts inside group
    grp_post_resp = await client.post(
        "/api/social/posts",
        json={"content": "Welcome everyone to the WWII circle!", "group_id": grp_id},
        headers=h2,
    )
    assert grp_post_resp.status_code == 201
    assert grp_post_resp.json()["group_id"] == grp_id
