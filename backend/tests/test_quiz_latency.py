import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from app.quiz import generation
from app.core.request_lifetime import until_disconnect


@pytest.mark.asyncio
async def test_thinking_only_configuration_fails_before_inference(monkeypatch):
    monkeypatch.setattr(generation.settings,'quiz_llm_model','qwen3-vl-4b-thinking')
    model=AsyncMock()
    monkeypatch.setattr(generation,'_chat_complete',model)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json('Taj Mahal')
    assert exc.value.status_code==503
    assert 'non-thinking' in exc.value.detail
    model.assert_not_awaited()


def test_prompt_budget_reserves_context_and_rejects_oversized_sources(monkeypatch):
    monkeypatch.setattr(generation.settings,'quiz_context_length',4096)
    assert generation.quiz_output_budget([{'content':'x'*2000}],10)==1072
    with pytest.raises(HTTPException) as exc:
        generation.quiz_output_budget([{'content':'x'*4000}],10)
    assert exc.value.status_code==422


@pytest.mark.asyncio
async def test_generation_deadline_releases_admission_lock(monkeypatch):
    monkeypatch.setattr(generation,'GENERATION_TIMEOUT_SECONDS',.04)
    async def stalled(*args,**kwargs): await asyncio.sleep(10)
    monkeypatch.setattr(generation,'_chat_complete',stalled)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json('History')
    assert exc.value.status_code==504
    assert not generation._generation_lock.locked()


@pytest.mark.asyncio
async def test_concurrent_request_does_not_queue_behind_inference(monkeypatch):
    started=asyncio.Event()
    data=generation.fallback_questions(10)
    async def stalled(*args,**kwargs):
        started.set()
        await asyncio.sleep(10)
    monkeypatch.setattr(generation,'_chat_complete',stalled)
    first=asyncio.create_task(generation.generate_and_parse_quiz_json('History'))
    try:
        await started.wait()
        with pytest.raises(HTTPException) as exc:
            await generation.generate_and_parse_quiz_json('History')
        assert exc.value.status_code==429
    finally:
        first.cancel()
        await asyncio.gather(first,return_exceptions=True)
    monkeypatch.setattr(generation,'_chat_complete',AsyncMock(return_value=(json.dumps(data),900)))
    assert await generation.generate_and_parse_quiz_json('History')==data


@pytest.mark.asyncio
async def test_disconnect_cancels_work_and_releases_lock(monkeypatch):
    disconnected=asyncio.Event()
    started=asyncio.Event()
    cancelled=asyncio.Event()
    async def check(): return disconnected.is_set()
    async def work():
        try:
            started.set()
            await asyncio.sleep(10)
        finally: cancelled.set()
    task=asyncio.create_task(until_disconnect(SimpleNamespace(is_disconnected=check),work()))
    await started.wait()
    disconnected.set()
    with pytest.raises(HTTPException) as exc: await task
    assert exc.value.status_code==499
    assert cancelled.is_set()


@pytest.mark.asyncio
async def test_gateway_timeout_remains_actionable():
    from app.gateway.main import proxy_gateway
    def timeout(request): raise httpx.ReadTimeout('slow model')
    async with httpx.AsyncClient(transport=httpx.MockTransport(timeout)) as client:
        request=SimpleNamespace(method='POST',url=SimpleNamespace(query=''),headers={},
            state=SimpleNamespace(request_id='test'),body=AsyncMock(return_value=b'{}'),
            is_disconnected=AsyncMock(return_value=False),app=SimpleNamespace(state=SimpleNamespace(client=client)))
        with pytest.raises(HTTPException) as exc:
            await proxy_gateway(request,'quiz/personalized/generate')
        assert exc.value.status_code==504


@pytest.mark.asyncio
async def test_disconnect_probe_that_absorbs_cancellation_cannot_hold_response():
    probing=asyncio.Event()
    async def check():
        probing.set()
        try: await asyncio.sleep(10)
        except asyncio.CancelledError: return False
    async def work():
        await probing.wait()
        return 'completed'
    result=await asyncio.wait_for(until_disconnect(SimpleNamespace(is_disconnected=check),work()),1)
    assert result=='completed'
