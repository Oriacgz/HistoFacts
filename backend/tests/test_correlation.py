import asyncio
import pytest
from app.core.correlation import CorrelationIdMiddleware, get_request_id


@pytest.mark.asyncio
async def test_request_id_propagates_without_hiding_disconnect():
    messages=[]
    async def receive(): return {'type':'http.disconnect'}
    async def send(message): messages.append(message)
    async def endpoint(scope,incoming,outgoing):
        assert scope['state']['request_id']=='quiz-audit'
        assert get_request_id()=='quiz-audit'
        assert (await incoming())['type']=='http.disconnect'
        await outgoing({'type':'http.response.start','status':200,'headers':[]})
        await outgoing({'type':'http.response.body','body':b'ok'})
    await CorrelationIdMiddleware(endpoint)({'type':'http','headers':[(b'x-request-id',b'quiz-audit')]},receive,send)
    assert (b'x-request-id',b'quiz-audit') in messages[0]['headers']
    assert get_request_id()==''


@pytest.mark.asyncio
async def test_concurrent_request_contexts_stay_separate():
    async def endpoint(scope,receive,send):
        before=get_request_id()
        await asyncio.sleep(.01)
        assert get_request_id()==before
    async def ignored(message): pass
    middleware=CorrelationIdMiddleware(endpoint)
    await asyncio.gather(*(middleware({'type':'http','headers':[(b'x-request-id',str(i).encode())]},ignored,ignored) for i in range(3)))
    assert get_request_id()==''
