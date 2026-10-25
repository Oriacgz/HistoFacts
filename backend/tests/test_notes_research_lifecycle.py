import json
import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select, func

from app.ai_notes.models import NoteResearchRun, TokenLedger
from app.ai_notes.research import lifecycle
from app.core.config import settings


async def account(client, suffix="one"):
    response = await client.post("/api/auth/register", json={"email": f"research-{suffix}@example.com", "username": f"research{suffix}", "password": "ResearchQA2026!"})
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.mark.asyncio
async def test_missing_key_no_generation_no_charge(client, monkeypatch, db_session):
    headers = await account(client)
    monkeypatch.setattr(settings, "tavily_api_key", "")
    response = await client.post("/api/notes/generate/stream", headers=headers, json={"topic": "Ashoka", "curriculum": "General History", "research_mode": "web"})
    assert response.status_code == 503
    assert await db_session.scalar(select(func.count()).select_from(NoteResearchRun)) == 0


@pytest.mark.asyncio
async def test_saved_sources_reopen_idempotency_owner_and_delete(client, monkeypatch, db_session):
    monkeypatch.setattr('app.ai_notes.router.is_history_related',AsyncMock(return_value=True))
    monkeypatch.setattr('app.ai_notes.service.is_history_related',AsyncMock(return_value=True))
    headers = await account(client)
    second = await account(client, "two")
    monkeypatch.setattr(settings, "tavily_api_key", "fixture-not-live")
    sources = [{"id": "S1", "fixture": True, "title": "Museum", "url": "https://museum.example/ashoka", "retrieved_at": "2026-10-23", "passages": [{"id": "S1P1", "text": "Ashoka supported Buddhism."}]}]
    mocked = AsyncMock(return_value=("Ashoka supported Buddhism. [S1]\n\n### Sources\nhttps://museum.example/ashoka", sources, 120))
    monkeypatch.setattr(lifecycle, "research_answer", mocked)
    request_id = str(uuid.uuid4())
    payload = {"topic": "Ashoka", "curriculum": "General History", "research_mode": "web", "research_request_id": request_id}
    response = await client.post("/api/notes/generate/stream", headers=headers, json=payload)
    assert response.status_code == 200
    events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: {")]
    saved = next(event["note"] for event in events if "note" in event)
    assert saved["research"]["sources"] == sources
    note_id = saved["id"]
    follow = await client.post(f"/api/notes/{note_id}/continue/stream", headers=headers,
                              json={"message": "Why did Ashoka support Buddhism?", "research_mode": "web", "think": True})
    assert follow.status_code == 200 and '"note":' in follow.text
    assert mocked.call_args.kwargs["think"] is True
    assert mocked.call_args.kwargs["root_topic"] == "Ashoka"
    reopened = await client.get(f"/api/notes/{note_id}/thread", headers=headers)
    assert reopened.json()[0]["research"]["sources"] == sources
    assert (await client.get(f"/api/notes/research/runs/{request_id}", headers=second)).status_code == 404
    assert (await client.get(f"/api/notes/{note_id}/thread", headers=second)).status_code == 404
    repeat = await client.post("/api/notes/generate/stream", headers=headers, json=payload)
    assert note_id in repeat.text and mocked.await_count == 2
    assert await db_session.scalar(select(func.count()).select_from(TokenLedger).where(TokenLedger.reason == "ai_generation")) == 2
    wrong = await client.post("/api/notes/generate/stream", headers=second, json=payload)
    assert wrong.status_code == 409
    from app.ai_notes.research.providers import ResearchUnavailable
    monkeypatch.setattr("app.ai_notes.research.transform.answer_from_sources", AsyncMock(side_effect=ResearchUnavailable("unsupported fixture rewrite")))
    rewritten = await client.post(f"/api/notes/{note_id}/revise", headers=headers, json={"instruction": "Shorten Ashoka notes"})
    assert rewritten.status_code == 422
    await client.delete(f"/api/notes/{note_id}", headers=headers)
    assert await db_session.scalar(select(func.count()).select_from(NoteResearchRun)) == 0


@pytest.mark.asyncio
async def test_failed_research_does_not_save_or_charge(client, monkeypatch, db_session):
    headers = await account(client)
    monkeypatch.setattr(settings, "tavily_api_key", "fixture")
    from app.ai_notes.research.providers import ResearchUnavailable
    monkeypatch.setattr(lifecycle, "research_answer", AsyncMock(side_effect=ResearchUnavailable("No useful evidence")))
    response = await client.post("/api/notes/generate/stream", headers=headers, json={"topic": "Ashoka", "curriculum": "General History", "research_mode": "web"})
    assert '"error": "No useful evidence"' in response.text
    assert '"note":' not in response.text
    assert await db_session.scalar(select(func.count()).select_from(TokenLedger).where(TokenLedger.reason == "ai_generation")) == 0
    assert (await db_session.scalar(select(NoteResearchRun))).state == "failed"


@pytest.mark.asyncio
async def test_nonstream_research_uses_same_saved_contract(client, monkeypatch):
    headers = await account(client)
    monkeypatch.setattr(settings, "tavily_api_key", "fixture")
    monkeypatch.setattr(lifecycle, "research_answer", AsyncMock(return_value=("Ashoka. Sources: https://museum.example/", [], 90)))
    response = await client.post("/api/notes/generate", headers=headers,
                                json={"topic":"Ashoka", "curriculum":"General History", "research_mode":"web"})
    assert response.status_code == 201, response.text
    assert response.json()["research"]["state"] == "complete"


@pytest.mark.asyncio
async def test_cancel_stops_operation_and_does_not_save(client, monkeypatch, db_session):
    import asyncio
    from app.ai_notes.schemas import GenerateNoteRequest
    cancelled = asyncio.Event()
    async def slow_answer(*args, progress, **kwargs):
        await progress({"stage": "searching"})
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()
    monkeypatch.setattr(lifecycle, "research_answer", slow_answer)
    request_id = str(uuid.uuid4())
    db_session.add(NoteResearchRun(id=request_id, user_id="cancel-owner", fingerprint="test", state="running", sources=[]))
    await db_session.commit()
    response = lifecycle.research_stream(GenerateNoteRequest(topic="Ashoka", curriculum="History", research_mode="web"), "cancel-owner", request_id)
    iterator = response.body_iterator
    await anext(iterator)
    await anext(iterator)
    await iterator.aclose()
    assert cancelled.is_set()
    await db_session.refresh(await db_session.get(NoteResearchRun, request_id))
    assert (await db_session.get(NoteResearchRun, request_id)).state == "failed"


@pytest.mark.asyncio
async def test_preferences_merge_and_retention(client, db_session):
    from datetime import datetime, timedelta, timezone
    from app.ai_notes.models import Note
    from app.ai_notes.research.retention import expire_research_records
    headers = await account(client)
    await client.patch("/api/auth/users/me/preferences", headers=headers, json={"theme": "dark", "language": "hi"})
    updated = await client.patch("/api/auth/users/me/preferences", headers=headers, json={"web_research_default": True, "web_research_depth": "concise"})
    assert updated.json()["preferences"]["theme"] == "dark"
    assert updated.json()["preferences"]["language"] == "hi"
    assert updated.json()["preferences"]["web_research_default"] is True
    assert updated.json()["preferences"]["web_research_depth"] == "concise"
    invalid = await client.patch("/api/auth/users/me/preferences", headers=headers, json={"web_research_depth": "unlimited"})
    assert invalid.status_code == 422
    note = Note(user_id="retention-owner", title="Ashoka", content="Ashoka")
    db_session.add(note)
    await db_session.flush()
    run = NoteResearchRun(id=str(uuid.uuid4()), user_id="retention-owner", fingerprint="test", state="complete", note_id=note.id,
                          sources=[{"url":"https://museum.example/", "passages":[{"text":"excerpt"}], "citations":[{"quote":"excerpt"}]}],
                          created_at=datetime.now(timezone.utc)-timedelta(days=31))
    db_session.add(run)
    await db_session.commit()
    await expire_research_records(db_session)
    await db_session.refresh(run)
    assert run.sources[0]["passages"] == [] and run.sources[0]["citations"] == []
    assert run.sources[0]["url"] == "https://museum.example/" and run.state == "excerpts_expired"


@pytest.mark.asyncio
async def test_status_recovers_saved_note_and_cancel_is_owner_scoped(client, monkeypatch):
    headers = await account(client)
    other = await account(client,"other")
    monkeypatch.setattr(settings,"tavily_api_key","fixture")
    monkeypatch.setattr(lifecycle,"research_answer",AsyncMock(return_value=("Ashoka supported Buddhism.",[],80)))
    run_id = str(uuid.uuid4())
    response = await client.post('/api/notes/generate/stream',headers=headers,json={
        "topic":"Ashoka","curriculum":"History","research_mode":"web","research_request_id":run_id})
    assert response.status_code == 200
    status = (await client.get(f'/api/notes/research/runs/{run_id}',headers=headers)).json()
    assert status['note']['id'] == status['note_id'] and status['outcome'] == 'limited'
    assert (await client.post(f'/api/notes/research/runs/{run_id}/cancel',headers=other)).status_code == 404
    cancelled = await client.post(f'/api/notes/research/runs/{run_id}/cancel',headers=headers)
    assert cancelled.json()['state'] == 'complete'  # Cancellation cannot undo a committed answer.


@pytest.mark.asyncio
async def test_researched_revision_rechecks_and_retains_sources(client, monkeypatch, db_session):
    monkeypatch.setattr('app.ai_notes.service.is_history_related',AsyncMock(return_value=True))
    headers = await account(client)
    monkeypatch.setattr(settings,'tavily_api_key','fixture')
    evidence=[{'id':'S1','title':'Museum','url':'https://museum.example/','retrieved_at':'2026-10-24',
               'passages':[{'id':'S1P1','text':'Ashoka supported Buddhism throughout his empire.'}]}]
    monkeypatch.setattr(lifecycle,'research_answer',AsyncMock(return_value=('Ashoka supported Buddhism.',evidence,80)))
    first = await client.post('/api/notes/generate',headers=headers,json={'topic':'Ashoka','curriculum':'History','research_mode':'web'})
    original = first.json()['id']
    grounded = AsyncMock(return_value=('Ashoka supported Buddhism. [S1]',evidence,70))
    monkeypatch.setattr('app.ai_notes.research.transform.answer_from_sources',grounded)
    revised = await client.post(f'/api/notes/{original}/revise',headers=headers,json={'instruction':'Shorten Ashoka notes'})
    assert revised.status_code == 201, revised.text
    assert revised.json()['research']['retrieval_mode'] == 'saved_evidence'
    assert revised.json()['research']['sources'] == evidence
    assert grounded.call_args.kwargs['instruction'] == 'Shorten Ashoka notes'
    root = (await client.get(f'/api/notes/{original}/thread',headers=headers)).json()[0]
    assert root['content'] == 'Ashoka supported Buddhism.'


@pytest.mark.asyncio
async def test_shared_research_redaction_export_and_purge(client,monkeypatch,db_session):
    # This gate exercises the unified-app fallback, never a developer's live services.
    for name in ('history_service_url','social_service_url','groups_service_url','quiz_service_url','notes_service_url','notification_service_url'):
        monkeypatch.setattr(settings,name,'http://127.0.0.1:1')
    from datetime import datetime,timezone
    from app.core.security import decode_token
    from app.chat.models import UserSummaryCache
    owner = await account(client)
    recipient = await account(client,'recipient')
    outsider = await account(client,'outsider')
    owner_id=decode_token(owner['Authorization'].split()[1])['sub']
    recipient_id=decode_token(recipient['Authorization'].split()[1])['sub']
    for uid,name in [(owner_id,'Owner'),(recipient_id,'Recipient')]:
        db_session.add(UserSummaryCache(user_id=uid,username=name,tag='1234',is_banned=False,synced_at=datetime.now(timezone.utc)))
    await db_session.commit()
    conversation=(await client.post(f'/api/chat/conversations/direct/{recipient_id}',headers=owner)).json()['id']
    monkeypatch.setattr(settings,'tavily_api_key','fixture')
    evidence=[{'id':'S1','title':'Museum','url':'https://museum.example/','retrieved_at':'2026-10-24',
               'passages':[{'id':'S1P1','text':'Supporting public excerpt'}], 'citations':[{'quote':'Supporting public excerpt'}]}]
    monkeypatch.setattr(lifecycle,'research_answer',AsyncMock(return_value=('Ashoka supported Buddhism. Sources: https://museum.example/',evidence,60)))
    response=await client.post('/api/notes/generate',headers=owner,json={'topic':'Ashoka','curriculum':'History','research_mode':'web'})
    note=response.json()['id']
    assert (await client.post(f'/api/notes/{note}/share',headers=owner,json={'conversation_ids':[conversation]})).status_code == 200
    shared=await client.get(f'/api/notes/{note}/shared',headers=recipient)
    assert shared.status_code == 200
    public=shared.json()
    assert 'prompt' not in public and 'user_id' not in public and 'source_note_id' not in public
    assert 'passages' not in public['research']['sources'][0] and 'citations' not in public['research']['sources'][0]
    assert public['shared_read_only'] and 'https://museum.example/' in public['content']
    assert (await client.get(f'/api/notes/{note}/shared',headers=outsider)).status_code == 404
    assert (await client.get(f'/api/notes/{note}/thread',headers=recipient)).status_code == 404
    import io,zipfile
    exported=await client.get('/api/auth/users/me/export',headers=owner)
    assert exported.status_code == 200
    with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
        exported_notes=json.loads(archive.read('ai_notes.json'))
        assert exported_notes['notes'][0]['research']['sources'] == evidence
    from app.auth.service import _in_process_purge
    await _in_process_purge(db_session,owner_id)
    await db_session.commit()
    assert await db_session.scalar(select(func.count()).select_from(NoteResearchRun).where(NoteResearchRun.user_id==owner_id)) == 0
    assert (await client.get(f'/api/notes/{note}/shared',headers=recipient)).status_code == 404
