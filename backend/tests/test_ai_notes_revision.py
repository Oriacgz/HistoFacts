"""
Tests for Phase 1: AI revision flow and guardrail functions.
"""

from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient


# ── Unit tests for guardrail helpers ──────────────────────────────────────────

def test_strip_thinking_removes_think_tags():
    from app.ai_notes.llm_client import strip_thinking

    raw = "<think>This is chain-of-thought reasoning.</think>Here is the actual answer."
    assert strip_thinking(raw) == "Here is the actual answer."


def test_strip_thinking_multiline():
    from app.ai_notes.llm_client import strip_thinking

    raw = "<think>\nLine one of reasoning\nLine two\n</think>\n\nFinal output."
    assert strip_thinking(raw) == "Final output."


def test_strip_thinking_no_tag_unchanged():
    from app.ai_notes.llm_client import strip_thinking

    text = "Clean note content with no thinking trace."
    assert strip_thinking(text) == text


def test_scrub_identity_leak_qwen():
    from app.ai_notes.llm_client import scrub_identity_leak, IDENTITY_REDIRECT

    assert scrub_identity_leak("I am powered by Qwen.") == IDENTITY_REDIRECT


def test_scrub_identity_leak_alibaba():
    from app.ai_notes.llm_client import scrub_identity_leak, IDENTITY_REDIRECT

    assert scrub_identity_leak("This model was built by Alibaba Cloud.") == IDENTITY_REDIRECT


def test_scrub_identity_leak_lm_studio():
    from app.ai_notes.llm_client import scrub_identity_leak, IDENTITY_REDIRECT

    assert scrub_identity_leak("You are running in LM Studio.") == IDENTITY_REDIRECT


def test_scrub_identity_leak_language_model_phrase():
    from app.ai_notes.llm_client import scrub_identity_leak, IDENTITY_REDIRECT

    assert scrub_identity_leak("I am a language model developed by...") == IDENTITY_REDIRECT


def test_scrub_identity_leak_clean_text_unchanged():
    from app.ai_notes.llm_client import scrub_identity_leak

    text = "The Battle of Waterloo took place in 1815."
    assert scrub_identity_leak(text) == text


# ── Unit tests for pre-classification guardrail ───────────────────────────────

@pytest.mark.asyncio
async def test_is_history_related_classifies_history(monkeypatch):
    from app.ai_notes.llm_client import is_history_related

    mock_msg = MagicMock()
    mock_msg.content = "HISTORY"
    mock_msg.reasoning_content = "This is about the French Revolution, a historical event."
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=mock_msg)]

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    monkeypatch.setattr("app.ai_notes.llm_client.AsyncOpenAI", lambda **kwargs: mock_client)

    assert await is_history_related("French revolution causes") is True


@pytest.mark.asyncio
async def test_is_history_related_classifies_off_topic_via_content(monkeypatch):
    from app.ai_notes.llm_client import is_history_related

    mock_msg = MagicMock()
    mock_msg.content = "OFF_TOPIC"
    mock_msg.reasoning_content = "The user asked about baking a cake."
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=mock_msg)]

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    monkeypatch.setattr("app.ai_notes.llm_client.AsyncOpenAI", lambda **kwargs: mock_client)

    assert await is_history_related("how to bake a cake") is False


@pytest.mark.asyncio
async def test_is_history_related_classifies_off_topic_with_thinking(monkeypatch):
    """Qwen reasoning model: content is empty (budget exhausted), answer is in reasoning_content."""
    from app.ai_notes.llm_client import is_history_related

    mock_msg = MagicMock()
    mock_msg.content = ""  # exhausted token budget mid-think
    mock_msg.reasoning_content = "User asks about baking a cake... Conclusion: OFF_TOPIC"
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=mock_msg)]

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    monkeypatch.setattr("app.ai_notes.llm_client.AsyncOpenAI", lambda **kwargs: mock_client)

    assert await is_history_related("how to bake a cake") is False


@pytest.mark.asyncio
async def test_is_history_related_fallback_on_network_error(monkeypatch):
    from app.ai_notes.llm_client import is_history_related

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(side_effect=ConnectionError("offline"))

    monkeypatch.setattr("app.ai_notes.llm_client.AsyncOpenAI", lambda **kwargs: mock_client)

    # Defaults to True so legitimate requests are not blocked when offline
    assert await is_history_related("anything") is True


# ── Integration: AI revision flow ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_revise_note_creates_linked_copy(client: AsyncClient, monkeypatch):
    """Revision creates a new note; original content is unmodified."""
    monkeypatch.setattr("app.ai_notes.service.is_history_related", AsyncMock(return_value=True))

    # 1. Register user
    reg = await client.post(
        "/api/auth/register",
        json={"username": "RevisionTester", "email": "revision@example.com", "password": "Password123!"},
    )
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 2. Generate an original note
    gen = await client.post(
        "/api/notes/generate",
        json={"topic": "The French Revolution", "curriculum": "AP World History"},
        headers=headers,
    )
    assert gen.status_code == 201
    original = gen.json()
    original_id = original["id"]
    original_content = original["content"]

    # 3. Revise the note
    revise = await client.post(
        f"/api/notes/{original_id}/revise",
        json={"instruction": "Focus on economic causes and add more dates"},
        headers=headers,
    )
    assert revise.status_code == 201
    revised = revise.json()

    # 4. New note is linked and distinct from original
    assert revised["id"] != original_id
    assert revised["source_note_id"] == original_id
    assert revised["is_ai_generated"] is True
    assert "Revised" in revised["title"] or revised["content"] != ""

    # 5. Original note is completely untouched
    notes_list = await client.get("/api/notes", headers=headers)
    all_notes = {n["id"]: n for n in notes_list.json()}
    assert all_notes[original_id]["content"] == original_content


@pytest.mark.asyncio
async def test_revise_note_404_on_wrong_user(client: AsyncClient, monkeypatch):
    """Cannot revise another user's note — must 404."""
    monkeypatch.setattr("app.ai_notes.service.is_history_related", AsyncMock(return_value=True))

    # Register two users
    reg_a = await client.post(
        "/api/auth/register",
        json={"username": "UserA_Rev", "email": "usera_rev@example.com", "password": "Password123!"},
    )
    reg_b = await client.post(
        "/api/auth/register",
        json={"username": "UserB_Rev", "email": "userb_rev@example.com", "password": "Password123!"},
    )
    headers_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}
    headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

    # User A creates a note
    gen = await client.post(
        "/api/notes/generate",
        json={"topic": "Roman Empire", "curriculum": "GCSE History"},
        headers=headers_a,
    )
    note_id = gen.json()["id"]

    # User B tries to revise User A's note
    resp = await client.post(
        f"/api/notes/{note_id}/revise",
        json={"instruction": "Add more detail about the fall"},
        headers=headers_b,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_off_topic_revision_rejected_zero_tokens(client: AsyncClient, monkeypatch):
    """Off-topic revision instructions are rejected before generation; wallet balance unchanged."""
    from app.ai_notes import service

    async def mock_is_history(text: str) -> bool:
        if "poem about cats" in text:
            return False
        return True

    monkeypatch.setattr(service, "is_history_related", mock_is_history)

    reg = await client.post(
        "/api/auth/register",
        json={"username": "GuardrailTester", "email": "guardrail@example.com", "password": "Password123!"},
    )
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Create a note to revise
    gen = await client.post(
        "/api/notes/generate",
        json={"topic": "World War I", "curriculum": "NCERT Class 10"},
        headers=headers,
    )
    assert gen.status_code == 201
    note_id = gen.json()["id"]

    # Snapshot wallet after note generation
    wallet_before = (await client.get("/api/wallet/me", headers=headers)).json()["token_balance"]

    # Attempt off-topic revision (should be rejected by is_history_related)
    resp = await client.post(
        f"/api/notes/{note_id}/revise",
        json={"instruction": "write me a poem about cats"},
        headers=headers,
    )
    # Expect 400 refusal
    assert resp.status_code == 400
    assert resp.json()["detail"] == service.REFUSAL_MESSAGE

    # Wallet balance must be unchanged — 0 tokens charged for rejected request
    wallet_after = (await client.get("/api/wallet/me", headers=headers)).json()["token_balance"]
    assert wallet_after == wallet_before


@pytest.mark.asyncio
async def test_off_topic_note_generation_rejected(client: AsyncClient, monkeypatch):
    """Off-topic note generation is rejected with 400 and 0 tokens charged."""
    from app.ai_notes import service

    async def mock_is_history(text: str) -> bool:
        if "poem about cats" in text:
            return False
        return True

    monkeypatch.setattr(service, "is_history_related", mock_is_history)

    reg = await client.post(
        "/api/auth/register",
        json={"username": "OffTopicTester", "email": "offtopic@example.com", "password": "Password123!"},
    )
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    wallet_before = (await client.get("/api/wallet/me", headers=headers)).json()["token_balance"]

    resp = await client.post(
        "/api/notes/generate",
        json={"topic": "write me a poem about cats", "curriculum": "NCERT Class 10"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == service.REFUSAL_MESSAGE

    wallet_after = (await client.get("/api/wallet/me", headers=headers)).json()["token_balance"]
    assert wallet_after == wallet_before
