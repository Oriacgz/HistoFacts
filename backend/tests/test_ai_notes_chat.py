"""
Unit and integration tests for AI Notes Chat-Style UI, Streaming, Thinking Filter, and Threading.
"""

from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient


# ── Unit tests: stream_and_filter_thinking ────────────────────────────────────

@pytest.mark.asyncio
async def test_filter_thinking_clean_stream():
    from app.ai_notes.llm_client import stream_and_filter_thinking

    async def raw_gen():
        for chunk in ["The ", "Battle of ", "Waterloo."]:
            yield chunk

    result = []
    async for token in stream_and_filter_thinking(raw_gen()):
        result.append(token)
    assert "".join(result) == "The Battle of Waterloo."


@pytest.mark.asyncio
async def test_filter_thinking_single_chunk_block():
    from app.ai_notes.llm_client import stream_and_filter_thinking

    async def raw_gen():
        yield "<think>pondering the dates</think>Historical answer."

    result = []
    async for token in stream_and_filter_thinking(raw_gen()):
        result.append(token)
    assert "".join(result) == "Historical answer."


@pytest.mark.asyncio
async def test_filter_thinking_tag_split_across_chunks():
    from app.ai_notes.llm_client import stream_and_filter_thinking

    async def raw_gen():
        yield "Intro text. <th"
        yield "ink>hidden reasoning here</th"
        yield "ink>Visible conclusion."

    result = []
    async for token in stream_and_filter_thinking(raw_gen()):
        result.append(token)
    output = "".join(result)
    assert "<think>" not in output
    assert "</think>" not in output
    assert "hidden reasoning" not in output
    assert output == "Intro text. Visible conclusion."


@pytest.mark.asyncio
async def test_filter_thinking_nested_or_multiple_blocks():
    from app.ai_notes.llm_client import stream_and_filter_thinking

    async def raw_gen():
        yield "<think>first thought</think>Part 1. "
        yield "<think>second thought</think>Part 2."

    result = []
    async for token in stream_and_filter_thinking(raw_gen()):
        result.append(token)
    assert "".join(result) == "Part 1. Part 2."


# ── Unit tests: build_conversation_messages ───────────────────────────────────

def test_build_conversation_messages():
    from app.ai_notes.service import build_conversation_messages
    from app.ai_notes.models import Note

    n1 = Note(
        id="n1",
        title="Study Notes: French Revolution",
        prompt="Tell me about the French Revolution",
        content="The French Revolution began in 1789.",
    )
    n2 = Note(
        id="n2",
        title="Follow-up",
        prompt="Why did it start?",
        content="Economic hardship and unequal estates.",
    )

    messages = build_conversation_messages([n1, n2])
    assert len(messages) == 5  # system + (user, assistant) * 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "Tell me about the French Revolution"
    assert messages[2]["role"] == "assistant"
    assert messages[3]["role"] == "user"
    assert messages[3]["content"] == "Why did it start?"
    assert messages[4]["role"] == "assistant"


# ── Integration tests: Chat Streaming & Thread Endpoints ──────────────────────

@pytest.mark.asyncio
async def test_chat_stream_and_thread_flow(client: AsyncClient, monkeypatch):
    # Mock LLM calls so tests don't depend on live LM Studio
    monkeypatch.setattr("app.ai_notes.service.is_history_related", AsyncMock(return_value=True))
    monkeypatch.setattr("app.ai_notes.router.is_history_related", AsyncMock(return_value=True))

    # 1. Register test user
    reg = await client.post(
        "/api/auth/register",
        json={
            "username": "ChatHistorian",
            "email": "chathistorian@example.com",
            "password": "Password123!",
        },
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create initial root note via /api/notes/generate
    gen_res = await client.post(
        "/api/notes/generate",
        json={
            "topic": "The Mughal Empire Administration",
            "curriculum": "NCERT Class 11",
        },
        headers=headers,
    )
    assert gen_res.status_code == 201
    root_note = gen_res.json()
    assert root_note["prompt"] == "The Mughal Empire Administration"
    root_id = root_note["id"]

    # 3. Test continue streaming endpoint: /api/notes/{id}/continue/stream
    cont_res = await client.post(
        f"/api/notes/{root_id}/continue/stream",
        json={"message": "What was the Mansabdari system?"},
        headers=headers,
    )
    assert cont_res.status_code == 200
    assert "text/event-stream" in cont_res.headers.get("content-type", "")

    stream_text = cont_res.text
    assert "data: " in stream_text
    assert "[DONE]" in stream_text
    assert "data: {\"note\":" in stream_text

    # 4. Fetch the full conversation thread
    thread_res = await client.get(f"/api/notes/{root_id}/thread", headers=headers)
    assert thread_res.status_code == 200
    thread = thread_res.json()
    assert len(thread) == 2
    assert thread[0]["id"] == root_id
    assert thread[0]["prompt"] == "The Mughal Empire Administration"
    assert thread[1]["prompt"] == "What was the Mansabdari system?"
    assert thread[1]["source_note_id"] == root_id

    # 5. Non-root note rejected on /thread endpoint
    child_id = thread[1]["id"]
    bad_thread = await client.get(f"/api/notes/{child_id}/thread", headers=headers)
    assert bad_thread.status_code == 400
    assert "Not a root note" in bad_thread.json()["detail"]

    # 6. Library list contains ONLY root note
    library_res = await client.get("/api/notes", headers=headers)
    assert library_res.status_code == 200
    lib_notes = library_res.json()
    assert len(lib_notes) == 1
    assert lib_notes[0]["id"] == root_id


@pytest.mark.asyncio
async def test_continue_stream_refuses_off_topic(client: AsyncClient, monkeypatch):
    # Mock is_history_related to refuse
    monkeypatch.setattr("app.ai_notes.router.is_history_related", AsyncMock(return_value=False))

    reg = await client.post(
        "/api/auth/register",
        json={
            "username": "OffTopicTester",
            "email": "offtopic@example.com",
            "password": "Password123!",
        },
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Generate initial note
    monkeypatch.setattr("app.ai_notes.service.is_history_related", AsyncMock(return_value=True))
    gen_res = await client.post(
        "/api/notes/generate",
        json={"topic": "Roman Empire", "curriculum": "World History"},
        headers=headers,
    )
    root_id = gen_res.json()["id"]

    # Send off-topic continue request
    monkeypatch.setattr("app.ai_notes.router.is_history_related", AsyncMock(return_value=False))
    cont_res = await client.post(
        f"/api/notes/{root_id}/continue/stream",
        json={"message": "Can you solve 2x + 5 = 15?"},
        headers=headers,
    )
    assert cont_res.status_code == 200
    stream_text = cont_res.text
    assert "History Unfolded AI Notes assistant" in stream_text
    assert "[DONE]" in stream_text
