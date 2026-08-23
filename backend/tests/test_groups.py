"""
Tests for Groups module (group creation, membership, group feed).
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_groups_flow(client: AsyncClient):
    # 1. Register users
    owner_resp = await client.post(
        "/api/auth/register",
        json={"username": "GroupLeader", "email": "leader@example.com", "password": "Password123!"},
    )
    t1 = owner_resp.json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}

    member_resp = await client.post(
        "/api/auth/register",
        json={"username": "GroupMember", "email": "member@example.com", "password": "Password123!"},
    )
    t2 = member_resp.json()["access_token"]
    h2 = {"Authorization": f"Bearer {t2}"}

    # 2. Leader creates a group
    grp_payload = {
        "name": "WWII Study Circle",
        "description": "Deep dive into 20th century European theater and Pacific operations.",
    }
    grp_resp = await client.post("/api/groups", json=grp_payload, headers=h1)
    assert grp_resp.status_code == 201
    grp = grp_resp.json()
    grp_id = grp["id"]
    assert grp["name"] == "WWII Study Circle"

    # 3. Leader lists groups
    list_resp = await client.get("/api/groups", headers=h1)
    assert list_resp.status_code == 200
    all_grps = list_resp.json()
    assert any(g["id"] == grp_id for g in all_grps)

    # 4. Member joins group
    join_resp = await client.post(f"/api/groups/{grp_id}/join", headers=h2)
    assert join_resp.status_code == 200

    # Member can now see the group in their groups list
    member_grps_resp = await client.get("/api/groups", headers=h2)
    assert member_grps_resp.status_code == 200
    assert any(g["id"] == grp_id for g in member_grps_resp.json())

    # 5. Member posts inside group
    grp_post_resp = await client.post(
        "/api/social/posts",
        json={"content": "Welcome everyone to the WWII circle!", "group_id": grp_id},
        headers=h2,
    )
    assert grp_post_resp.status_code == 201
    assert grp_post_resp.json()["group_id"] == grp_id
