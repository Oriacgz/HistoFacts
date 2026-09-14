"""
Comprehensive test suite for Personal & Group Chat module.
"""

import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from app.chat.models import UserSummaryCache


@pytest.mark.asyncio
async def test_direct_and_group_chat_flow(client: AsyncClient, db_session):
    # Populate UserSummaryCache for all test users after they are created
    async def add_user_to_cache(user_id: str, username: str, tag: str):
        cache = UserSummaryCache(
            user_id=user_id,
            username=username,
            tag=tag,
            avatar_url=None,
            bio=None,
            is_banned=False,
            synced_at=datetime.now(timezone.utc),
        )
        db_session.add(cache)
        await db_session.commit()

    # 1. Register User A, User B, and User C
    # 1. Register User A, User B, and User C
    u1_resp = await client.post(
        "/api/auth/register",
        json={"username": "AliceScholar", "email": "alice@example.com", "password": "Password123!"},
    )
    t1 = u1_resp.json()["access_token"]
    u1_id = u1_resp.json()["user"]["id"]
    u1_tag = u1_resp.json()["user"]["tag"]
    h1 = {"Authorization": f"Bearer {t1}"}
    await add_user_to_cache(u1_id, "AliceScholar", u1_tag)

    u2_resp = await client.post(
        "/api/auth/register",
        json={"username": "BobHistorian", "email": "bob@example.com", "password": "Password123!"},
    )
    t2 = u2_resp.json()["access_token"]
    u2_id = u2_resp.json()["user"]["id"]
    u2_tag = u2_resp.json()["user"]["tag"]
    h2 = {"Authorization": f"Bearer {t2}"}
    await add_user_to_cache(u2_id, "BobHistorian", u2_tag)

    u3_resp = await client.post(
        "/api/auth/register",
        json={"username": "CharlieExplorer", "email": "charlie@example.com", "password": "Password123!"},
    )
    t3 = u3_resp.json()["access_token"]
    u3_id = u3_resp.json()["user"]["id"]
    u3_tag = u3_resp.json()["user"]["tag"]
    h3 = {"Authorization": f"Bearer {t3}"}
    await add_user_to_cache(u3_id, "CharlieExplorer", u3_tag)

    # 2. Test Get-or-Create Direct Conversation (Idempotence & Canonical Ordering)
    create_d1 = await client.post(f"/api/chat/conversations/direct/{u2_id}", headers=h1)
    assert create_d1.status_code == 200
    conv1 = create_d1.json()
    conv1_id = conv1["id"]
    assert conv1["type"] == "direct"
    assert len(conv1["participants"]) == 2

    # Bob opens chat with Alice -> Must return the EXACT same conversation ID
    create_d2 = await client.post(f"/api/chat/conversations/direct/{u1_id}", headers=h2)
    assert create_d2.status_code == 200
    assert create_d2.json()["id"] == conv1_id

    # Cannot create conversation with oneself
    self_chat = await client.post(f"/api/chat/conversations/direct/{u1_id}", headers=h1)
    assert self_chat.status_code == 400

    # 3. Send Messages (text, note_share, quiz_share)
    msg1_resp = await client.post(
        f"/api/chat/conversations/{conv1_id}/messages",
        json={"message_type": "text", "content": "Hello Bob! Did you see the Rome chronicle?"},
        headers=h1,
    )
    assert msg1_resp.status_code == 201
    msg1 = msg1_resp.json()
    assert msg1["content"] == "Hello Bob! Did you see the Rome chronicle?"
    assert msg1["sender_username"] == "AliceScholar"

    msg2_resp = await client.post(
        f"/api/chat/conversations/{conv1_id}/messages",
        json={"message_type": "note_share", "content": "Summary of Fall of Rome", "shared_ref_id": "fake-note-uuid"},
        headers=h1,
    )
    assert msg2_resp.status_code == 201
    msg2 = msg2_resp.json()
    assert msg2["message_type"] == "note_share"

    msg3_resp = await client.post(
        f"/api/chat/conversations/{conv1_id}/messages",
        json={"message_type": "quiz_share", "content": "Code: 482019", "shared_ref_id": "fake-lobby-uuid"},
        headers=h2,
    )
    assert msg3_resp.status_code == 201
    msg3 = msg3_resp.json()
    assert msg3["sender_username"] == "BobHistorian"

    # 4. Access Control: Charlie (u3) cannot access Alice & Bob's conversation
    charlie_get = await client.get(f"/api/chat/conversations/{conv1_id}/messages", headers=h3)
    assert charlie_get.status_code == 200
    assert charlie_get.json() == []  # Not a participant -> empty

    charlie_send = await client.post(
        f"/api/chat/conversations/{conv1_id}/messages",
        json={"message_type": "text", "content": "Intruder message"},
        headers=h3,
    )
    assert charlie_send.status_code == 403

    # 5. List Messages & Pagination
    all_msgs_resp = await client.get(f"/api/chat/conversations/{conv1_id}/messages", headers=h1)
    assert all_msgs_resp.status_code == 200
    all_msgs = all_msgs_resp.json()
    assert len(all_msgs) == 3

    # Pagination: before msg3
    paged_resp = await client.get(f"/api/chat/conversations/{conv1_id}/messages?before={msg3['id']}", headers=h1)
    assert paged_resp.status_code == 200
    paged = paged_resp.json()
    assert len(paged) == 2
    assert paged[0]["id"] == msg1["id"]
    assert paged[1]["id"] == msg2["id"]

    # 6. Polling: New messages after msg2
    polled_resp = await client.get(f"/api/chat/conversations/{conv1_id}/messages/new?after={msg2['id']}", headers=h1)
    assert polled_resp.status_code == 200
    polled = polled_resp.json()
    assert len(polled) == 1
    assert polled[0]["id"] == msg3["id"]

    # 7. Unread counts & Read Receipts
    # Alice sent 2, Bob sent 1. Bob's unread should be 2 (from Alice). Alice's unread should be 1 (from Bob).
    convs_alice = await client.get("/api/chat/conversations", headers=h1)
    assert convs_alice.status_code == 200
    alice_c = next(c for c in convs_alice.json() if c["id"] == conv1_id)
    assert alice_c["unread_count"] == 1
    assert alice_c["last_message"]["id"] == msg3["id"]

    # Alice marks conversation as read
    read_resp = await client.post(f"/api/chat/conversations/{conv1_id}/read", headers=h1)
    assert read_resp.status_code == 200

    convs_alice_after = await client.get("/api/chat/conversations", headers=h1)
    alice_c_after = next(c for c in convs_alice_after.json() if c["id"] == conv1_id)
    assert alice_c_after["unread_count"] == 0

    # 8. Group Chat Flow
    grp_resp = await client.post(
        "/api/groups",
        json={
            "name": "Renaissance Guild",
            "description": "Italian Renaissance studies",
            "member_ids": [u2_id, u3_id],
        },
        headers=h1,
    )
    grp_id = grp_resp.json()["id"]

    # Get or create group chat
    grp_chat_resp = await client.post(f"/api/chat/conversations/group/{grp_id}", headers=h1)
    assert grp_chat_resp.status_code == 200
    grp_conv = grp_chat_resp.json()
    assert grp_conv["type"] == "group"
    assert grp_conv["group_id"] == grp_id
    assert grp_conv["group_name"] == "Renaissance Guild"

    # Send message in group chat
    grp_msg_resp = await client.post(
        f"/api/chat/conversations/{grp_conv['id']}/messages",
        json={"message_type": "text", "content": "Welcome to Renaissance Guild chat!"},
        headers=h1,
    )
    assert grp_msg_resp.status_code == 201

    # Bob can see group conversation in his conversation list
    bob_convs = await client.get("/api/chat/conversations", headers=h2)
    assert bob_convs.status_code == 200
    assert any(c["id"] == grp_conv["id"] and c["group_name"] == "Renaissance Guild" for c in bob_convs.json())
