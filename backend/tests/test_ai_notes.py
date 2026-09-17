"""
Tests for AI Notes module, Token Economy, and Histoins Shop.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_notes_and_wallet_flow(client: AsyncClient):
    # 1. Register a test user (should get 350,000 signup token bonus)
    reg_resp = await client.post(
        "/api/auth/register",
        json={
            "username": "NotesScholar",
            "email": "notes@example.com",
            "password": "Password123!",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check wallet balance
    wallet_resp = await client.get("/api/wallet/me", headers=headers)
    assert wallet_resp.status_code == 200
    w_data = wallet_resp.json()
    assert w_data["token_balance"] == 350_000
    assert w_data["histoin_balance"] >= 0

    # 3. Generate study note
    gen_payload = {
        "topic": "The Industrial Revolution in Britain",
        "curriculum": "NCERT Class 10 History",
    }
    gen_resp = await client.post("/api/notes/generate", json=gen_payload, headers=headers)
    assert gen_resp.status_code == 201
    note = gen_resp.json()
    assert "Industrial Revolution" in note["title"]
    assert note["style"] == "standard"
    assert note["id"] is not None
    note_id = note["id"]

    # 4. Check that tokens were deducted
    wallet_resp2 = await client.get("/api/wallet/me", headers=headers)
    w_data2 = wallet_resp2.json()
    assert w_data2["token_balance"] < 350_000

    # 5. Generate Handwritten Note
    hw_resp = await client.post(f"/api/notes/{note_id}/handwritten", headers=headers)
    assert hw_resp.status_code == 201
    hw_note = hw_resp.json()
    assert hw_note["style"] == "handwritten"
    assert hw_note["source_note_id"] == note_id

    # 6. List my notes - only root notes are returned (session grouping)
    list_resp = await client.get("/api/notes/me", headers=headers)
    assert list_resp.status_code == 200
    notes_list = list_resp.json()
    assert len(notes_list) == 1
    assert notes_list[0]["id"] == note_id
    assert notes_list[0]["prompt"] == "The Industrial Revolution in Britain"

    # 7. Get conversation thread for root note - returns full version chain
    thread_resp = await client.get(f"/api/notes/{note_id}/thread", headers=headers)
    assert thread_resp.status_code == 200
    thread = thread_resp.json()
    assert len(thread) == 2
    assert thread[0]["id"] == note_id
    assert thread[1]["id"] == hw_note["id"]
    assert thread[1]["prompt"] is not None


@pytest.mark.asyncio
async def test_shop_packs_and_purchase(client: AsyncClient):
    # 1. Register user
    reg_resp = await client.post(
        "/api/auth/register",
        json={
            "username": "ShopTester",
            "email": "shoptester@example.com",
            "password": "Password123!",
        },
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get shop packs
    packs_resp = await client.get("/api/shop/packs", headers=headers)
    assert packs_resp.status_code == 200
    packs = packs_resp.json()
    assert len(packs) >= 3

    # 3. Attempt purchase without enough Histoins (should return 402 Insufficient Histoins)
    starter_pack = next(p for p in packs if p["name"] == "Starter Pack")
    buy_resp = await client.post(f"/api/shop/purchase/{starter_pack['id']}", headers=headers)
    assert buy_resp.status_code == 402


@pytest.mark.asyncio
async def test_share_note_to_conversations(client: AsyncClient, db_session):
    from app.chat.models import UserSummaryCache
    from datetime import datetime, timezone

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

    # 1. Register User A (Sharer)
    u1_resp = await client.post(
        "/api/auth/register",
        json={"username": "SharerOne", "email": "sharer@example.com", "password": "Password123!"},
    )
    assert u1_resp.status_code == 201
    t1 = u1_resp.json()["access_token"]
    u1_id = u1_resp.json()["user"]["id"]
    u1_tag = u1_resp.json()["user"]["tag"]
    h1 = {"Authorization": f"Bearer {t1}"}
    await add_user_to_cache(u1_id, "SharerOne", u1_tag)

    # 2. Register User B (Friend)
    u2_resp = await client.post(
        "/api/auth/register",
        json={"username": "FriendTwo", "email": "friend@example.com", "password": "Password123!"},
    )
    assert u2_resp.status_code == 201
    t2 = u2_resp.json()["access_token"]
    u2_id = u2_resp.json()["user"]["id"]
    u2_tag = u2_resp.json()["user"]["tag"]
    h2 = {"Authorization": f"Bearer {t2}"}
    await add_user_to_cache(u2_id, "FriendTwo", u2_tag)

    # 3. Create a Direct Conversation between User A and User B
    conv_resp = await client.post(f"/api/chat/conversations/direct/{u2_id}", headers=h1)
    assert conv_resp.status_code == 200
    conv_id = conv_resp.json()["id"]

    # 4. Generate a Note as User A
    gen_resp = await client.post(
        "/api/notes/generate",
        json={"topic": "The Mughal Empire Architecture", "curriculum": "NCERT Class 10 History"},
        headers=h1,
    )
    assert gen_resp.status_code == 201
    note_id = gen_resp.json()["id"]

    # 5. Share Note to the Conversation
    share_resp = await client.post(
        f"/api/notes/{note_id}/share",
        json={"conversation_ids": [conv_id]},
        headers=h1,
    )
    assert share_resp.status_code == 200
    assert share_resp.json()["shared_to"] == 1

    # 6. Verify User B can see the note_share message in the conversation
    msgs_resp = await client.get(f"/api/chat/conversations/{conv_id}/messages", headers=h2)
    assert msgs_resp.status_code == 200
    msgs = msgs_resp.json()
    assert len(msgs) == 1
    shared_msg = msgs[0]
    assert shared_msg["message_type"] == "note_share"
    assert shared_msg["shared_ref_id"] == note_id
    assert "Mughal Empire" in shared_msg["content"]

