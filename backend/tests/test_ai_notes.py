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

    # 6. List my notes
    list_resp = await client.get("/api/notes/me", headers=headers)
    assert list_resp.status_code == 200
    notes_list = list_resp.json()
    assert len(notes_list) >= 2


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
