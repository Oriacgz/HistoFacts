import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from app.ai_notes import llm_client
from app.ai_notes.router import require_attachment_mode
from app.ai_notes.schemas import GenerateNoteRequest, ContinueConversationRequest


@pytest.fixture
def routed_clients(monkeypatch):
    monkeypatch.setattr(llm_client.settings,'notes_llm_base_url','http://127.0.0.1:11434/v1')
    monkeypatch.setattr(llm_client.settings,'notes_llm_model','llama3.2:3b')
    monkeypatch.setattr(llm_client.settings,'notes_thinking_llm_base_url','http://127.0.0.1:1234/v1')
    monkeypatch.setattr(llm_client.settings,'notes_thinking_llm_model','qwen3-vl-4b-thinking')
    requests=[]
    http_clients=[]
    def factory(**config):
        http_clients.append(config['http_client'])
        async def create(**payload):
            requests.append((config['base_url'],payload))
            await asyncio.sleep(.001)
            if payload.get('stream'):
                async def chunks():
                    for text in ['<think>hidden</think>','Historical answer.']:
                        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])
                return chunks()
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='Historical answer.'))],usage=SimpleNamespace(total_tokens=12))
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm_client,'AsyncOpenAI',factory)
    yield requests,http_clients


@pytest.mark.asyncio
async def test_stream_routing_is_per_request_and_filters_reasoning(routed_clients):
    requests,clients=routed_clients
    async def collect(think):
        return ''.join([part async for part in llm_client.stream_and_filter_thinking(llm_client.stream_chat([{'role':'user','content':'History'}],think=think))])
    try:
        assert await asyncio.gather(collect(False),collect(True))==['Historical answer.','Historical answer.']
        assert {base for base,_ in requests}=={'http://127.0.0.1:11434/v1','http://127.0.0.1:1234/v1'}
        assert {payload['model'] for _,payload in requests}=={'llama3.2:3b','qwen3-vl-4b-thinking'}
        assert all('extra_body' not in payload for _,payload in requests)
    finally:
        for client in clients:await client.aclose()


@pytest.mark.asyncio
async def test_nonstreaming_and_followup_messages_use_same_selection(routed_clients):
    requests,clients=routed_clients
    messages=[{'role':'user','content':'Earlier question'},{'role':'assistant','content':'Earlier answer'},{'role':'user','content':'Explain more'}]
    try:
        await llm_client._chat_complete(messages)
        await llm_client._chat_complete(messages,think=True)
        assert requests[0][1]['model']=='llama3.2:3b'
        assert requests[1][1]['model']=='qwen3-vl-4b-thinking'
        assert all(payload['messages']==messages for _,payload in requests)
    finally:
        for client in clients:await client.aclose()


@pytest.mark.asyncio
async def test_both_streaming_models_receive_same_saved_session(db_session,routed_clients):
    from app.ai_notes.models import Note
    from app.ai_notes.context.service import assemble,release_generation
    root=Note(user_id='owner',title='American Civil War',prompt='Civil war in America',
              content='The American Civil War was fought from 1861 to 1865. '*200)
    db_session.add(root)
    await db_session.commit()
    requests,clients=routed_clients
    try:
        for think in (False,True):
            messages,usage=await assemble(root.id,'owner',db_session,llm_client.SYSTEM_PROMPT,
                                         'give answer with respect to ICSE board')
            _=[part async for part in llm_client.stream_chat(messages,think=think)]
            await release_generation('owner',usage,db_session)
        assert requests[0][1]['messages']==requests[1][1]['messages']
        assert 'Civil war in America' in str(requests[0][1]['messages'])
    finally:
        for client in clients:await client.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize('text,expected',[
    ('what is ssl',False),('Explain TLS',False),
    ('what is SSL',False),('history of SSL',True),
    ('give answer with respect to ICSE board',True),('Why did it start?',True)])
async def test_history_scope_does_not_inherit_permission_for_ssl(text,expected,monkeypatch):
    result=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='HISTORY'))])
    monkeypatch.setattr(llm_client,'AsyncOpenAI',lambda **kwargs:SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=result)))))
    assert await llm_client.is_history_related(text,thread_topic='American Civil War') is expected


def test_board_instruction_does_not_substitute_ncert_for_icse():
    _,instruction=llm_client.detect_task_intent('give answer with respect to ICSE board')
    assert 'Keep ICSE, CBSE, and NCERT distinct' in instruction


@pytest.mark.asyncio
async def test_restylers_forward_think_selection(monkeypatch):
    complete=AsyncMock(return_value=('Historical answer.',12))
    monkeypatch.setattr(llm_client,'_chat_complete',complete)
    await llm_client.generate_handwritten_note('Title','History',think=True)
    assert complete.call_args.kwargs['think'] is True
    await llm_client.generate_revision_note('Title','History','Shorten it',think=False)
    assert complete.call_args.kwargs['think'] is False


@pytest.mark.parametrize('request_type',[GenerateNoteRequest,ContinueConversationRequest])
def test_image_requires_think_without_silently_switching(request_type):
    fields={'topic':'History','curriculum':'General History'} if request_type is GenerateNoteRequest else {'message':'Explain this'}
    request=request_type(**fields,attachment_data='data:image/png;base64,AA')
    with pytest.raises(HTTPException) as exc:require_attachment_mode(request)
    assert exc.value.status_code==422
    request.think=True
    require_attachment_mode(request)
