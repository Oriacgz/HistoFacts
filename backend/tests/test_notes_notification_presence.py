import uuid
from unittest.mock import AsyncMock, MagicMock
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from redis.exceptions import RedisError
from app.notification.notes_presence import notes_presence, NotesPresence
from app.notification.service import create_notification_record
from app.notification.schemas import NotificationCreate
from app.auth.models import User
from app.core.security import create_access_token


@pytest_asyncio.fixture
async def presence(monkeypatch):
    redis=FakeRedis(decode_responses=True)
    clock=[1000.0]
    monkeypatch.setattr(notes_presence,'redis',redis)
    monkeypatch.setattr(notes_presence,'now',lambda:clock[0])
    monkeypatch.setattr(notes_presence,'_fallback',{})
    yield notes_presence,clock
    await redis.aclose()


@pytest.mark.asyncio
async def test_notes_ready_suppressed_only_for_active_owner(presence,db_session):
    manager,_=presence
    for uid in ['viewer','away']:
        db_session.add(User(id=uid,username=uid,tag='0000',email=uid+'@test.example',password_hash='disabled'))
    await db_session.commit()
    await manager.update('viewer','tab-a',True)
    assert await create_notification_record(NotificationCreate(user_id='viewer',type='note_ready'),db_session) is None
    assert await create_notification_record(NotificationCreate(user_id='away',type='note_ready'),db_session) is not None
    assert await create_notification_record(NotificationCreate(user_id='viewer',type='friend_request'),db_session) is not None
    await manager.update('viewer','tab-a',False)
    assert await create_notification_record(NotificationCreate(user_id='viewer',type='note_ready'),db_session) is not None


@pytest.mark.asyncio
async def test_one_tab_leaving_does_not_clear_another_active_tab(presence):
    manager,_=presence
    await manager.update('viewer','tab-a',True)
    await manager.update('viewer','tab-b',True)
    await manager.update('viewer','tab-a',False)
    assert await manager.is_active('viewer')
    await manager.update('viewer','tab-b',False)
    assert not await manager.is_active('viewer')


@pytest.mark.asyncio
async def test_crashed_tab_presence_expires_and_heartbeat_extends_it(presence):
    manager,clock=presence
    await manager.update('viewer','tab',True)
    clock[0]+=30
    await manager.update('viewer','tab',True)
    clock[0]+=30
    assert await manager.is_active('viewer')
    clock[0]+=16
    assert not await manager.is_active('viewer')


@pytest.mark.asyncio
async def test_redis_outage_does_not_silently_drop_notifications():
    manager=NotesPresence(client=AsyncMock())
    manager.redis.zcount.side_effect=RedisError('offline')
    assert not await manager.is_active('viewer')


@pytest.mark.asyncio
async def test_local_fallback_tracks_visibility_when_redis_is_offline():
    clock=[1000.0]
    redis=AsyncMock()
    redis.pipeline=MagicMock(side_effect=RedisError('offline'))
    redis.zcount.side_effect=RedisError('offline')
    manager=NotesPresence(client=redis,clock=lambda:clock[0])
    await manager.update('viewer','tab-a',True)
    assert await manager.is_active('viewer')
    assert not await manager.is_active('other')
    await manager.update('viewer','tab-a',False)
    assert not await manager.is_active('viewer')
    await manager.update('viewer','tab-a',True)
    clock[0]+=46
    assert not await manager.is_active('viewer')


@pytest.mark.asyncio
async def test_presence_endpoint_requires_auth_and_uses_jwt_owner(presence,client):
    manager,_=presence
    body={'tab_id':str(uuid.uuid4()),'active':True}
    response=await client.post('/api/notifications/notes-presence',json=body)
    assert response.status_code==401
    token=create_access_token({'sub':'authenticated-viewer'})
    response=await client.post('/api/notifications/notes-presence',json={**body,'user_id':'someone-else'},headers={'Authorization':'Bearer '+token})
    assert response.status_code==200
    assert await manager.is_active('authenticated-viewer')
    assert not await manager.is_active('someone-else')
