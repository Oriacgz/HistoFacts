import json
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from app.ai_notes.models import Note,NoteSessionMemory
from app.ai_notes.context import service
from app.ai_notes.context.budget import enforce,count,limit


async def seed(db,owner='owner',size=12):
    chain=[]
    for index in range(size):
        note=Note(user_id=owner,title=f'History {index}',prompt=f'Remember correction {index}: year {1900+index}.',
            content=('Historical discussion about Ashoka and his edicts. '*16),source_note_id=chain[-1].id if chain else None)
        db.add(note);await db.flush();chain.append(note)
    await db.commit()
    return chain


@pytest.mark.asyncio
async def test_long_civil_war_answer_keeps_topic_for_board_followup(db_session):
    from app.ai_notes.llm_client import SYSTEM_PROMPT
    root=Note(user_id='owner',title='American Civil War',
              prompt='Tell me more about the civil war in america',
              content='The American Civil War concerned slavery and secession. '*200)
    db_session.add(root)
    await db_session.commit()
    # The previous all-or-nothing selector omitted this whole turn.
    assert count([{'role':'system','content':SYSTEM_PROMPT},
                  {'role':'user','content':root.prompt},
                  {'role':'assistant','content':root.content}])>limit()
    messages,usage=await service.assemble(root.id,'owner',db_session,SYSTEM_PROMPT,
                                         'give answer with respect to ICSE board')
    assert usage['recent_pairs']==1
    assert any(m['role']=='user' and m['content']==root.prompt for m in messages)
    assert any(m['role']=='assistant' and 'slavery and secession' in m['content'] and 'truncated' in m['content'] for m in messages)
    assert messages[-1]['content']=='give answer with respect to ICSE board'
    assert count(messages)<=limit()


@pytest.mark.asyncio
async def test_disable_preserves_memory_but_injects_no_history(db_session):
    chain=await seed(db_session)
    root=chain[0].id
    before=await service.compact(root,'owner',db_session)
    disabled=await service.configure(root,'owner',db_session,{'enabled':False})
    assert disabled['summary']==before['summary'] and disabled['version']==before['version']
    messages,usage=await service.assemble(root,'owner',db_session,'History assistant','New topic')
    assert messages==[{'role':'system','content':'History assistant'},{'role':'user','content':'New topic'}]
    await service.release_generation('owner',usage,db_session)
    enabled=await service.configure(root,'owner',db_session,{'enabled':True})
    assert enabled['summary']==before['summary']


@pytest.mark.asyncio
async def test_old_topic_and_language_survive_sliding_window_before_150k(db_session):
    turns=await seed(db_session,size=10)
    turns[0].prompt='American Civil War. Always respond in Hindi.'
    await db_session.commit()
    messages,usage=await service.assemble(turns[0].id,'owner',db_session,'History assistant','Adapt this for ICSE')
    assert usage['version']==0
    assert 'American Civil War' in json.dumps(messages)
    assert 'Always respond in Hindi' in json.dumps(messages)
    assert count(messages)<=limit()


@pytest.mark.asyncio
async def test_restart_recovers_expired_lease_preserving_summary(db_session):
    from datetime import datetime,timedelta,timezone
    turns=await seed(db_session)
    root=turns[0].id
    before=await service.compact(root,'owner',db_session)
    memory,_=await service.get_memory(root,'owner',db_session)
    memory.status='compacting';memory.operation_id='abandoned'
    memory.lease_until=datetime.now(timezone.utc)-timedelta(minutes=1)
    await db_session.commit()
    assert await service.recover_expired(db_session)==1
    memory,_=await service.get_memory(root,'owner',db_session)
    assert memory.status=='degraded' and memory.operation_id is None
    assert memory.summary==before['summary']


@pytest.mark.asyncio
async def test_invalid_compaction_candidate_keeps_previous_memory_and_bounded_fallback(db_session,monkeypatch):
    turns=await seed(db_session)
    root=turns[0].id
    before=await service.compact(root,'owner',db_session)
    monkeypatch.setattr(service,'build_summary',lambda *args,**kwargs:[{'turn_id':'foreign','role':'assistant','text':'Wrong source'}])
    failed=await service.compact(root,'owner',db_session,rebuild=True)
    assert failed['status']=='degraded' and failed['summary']==before['summary']
    assert failed['version']==before['version']
    messages,usage=await service.assemble(root,'owner',db_session,'History assistant','Continue')
    assert 'Wrong source' not in json.dumps(messages) and count(messages)<=limit()


@pytest.mark.asyncio
async def test_repeated_compact_without_new_coverage_is_noop(db_session):
    turns=await seed(db_session)
    first=await service.compact(turns[0].id,'owner',db_session)
    second=await service.compact(turns[0].id,'owner',db_session)
    assert first['version']==second['version']


@pytest.mark.asyncio
async def test_explicit_rebuild_restores_reset_sources(db_session):
    chain=await seed(db_session)
    root=chain[0].id
    await service.reset(root,'owner',db_session)
    reset_memory,_=await service.get_memory(root,'owner',db_session)
    assert len(reset_memory.ignored_ids)==len(chain)
    rebuilt=await service.compact(root,'owner',db_session,rebuild=True)
    assert rebuilt['summary'] and rebuilt['covered_ids']
    memory,_=await service.get_memory(root,'owner',db_session)
    assert memory.ignored_ids==[]


@pytest.mark.asyncio
async def test_auto_compaction_opt_out_and_mode_survive_reset(db_session,monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings,'notes_session_window_tokens',3000)
    chain=await seed(db_session)
    root=chain[0].id
    await service.configure(root,'owner',db_session,{'auto_compact':False,'mode':'minimal'})
    _,usage=await service.assemble(root,'owner',db_session,'History assistant','Ashoka?')
    assert usage['version']==0 and usage['compaction_due'] and usage['used']<=usage['limit']
    assert usage['recent_pairs']<=2
    await service.release_generation('owner',usage,db_session)
    manual=await service.compact(root,'owner',db_session)
    assert manual['version']==1 and len(json.dumps(manual['summary'],ensure_ascii=False).encode())<=768
    reset=await service.reset(root,'owner',db_session)
    assert reset['policy']['auto_compact'] is False and reset['policy']['mode']=='minimal'


@pytest.mark.asyncio
async def test_nested_preferences_merge_master_switch_and_session_pagination(client,db_session):
    from tests.test_notes_research_lifecycle import account
    from app.core.security import decode_token
    headers=await account(client,'memorypolicy')
    owner=decode_token(headers['Authorization'].split()[1])['sub']
    await client.patch('/api/auth/me/preferences',headers=headers,
                       json={'theme':'dark','ai_notes_memory':{'auto_compact':False,'mode':'detailed'}})
    response=await client.patch('/api/auth/me/preferences',headers=headers,json={'ai_notes_memory':{'enabled':False}})
    preferences=response.json()['preferences']
    assert preferences['theme']=='dark'
    assert preferences['ai_notes_memory']=={'enabled':False,'auto_compact':False,'mode':'detailed'}
    assert (await client.patch('/api/auth/me/preferences',headers=headers,
                               json={'ai_notes_memory':{'mode':'unlimited'}})).status_code==422
    chain=await seed(db_session,owner,size=1)
    other=Note(user_id=owner,title='Second',prompt='Second history',content='History')
    db_session.add(other);await db_session.commit()
    first=(await client.get('/api/notes/sessions?page_size=1',headers=headers)).json()
    second=(await client.get('/api/notes/sessions?page_size=1&offset=1',headers=headers)).json()
    assert len(first)==len(second)==1 and first[0]['root_id']!=second[0]['root_id']
    messages,usage=await service.assemble(chain[0].id,owner,db_session,'History assistant','Question')
    assert len(messages)==2 and usage['enabled'] is False
    await service.release_generation(owner,usage,db_session)


@pytest.mark.asyncio
async def test_compaction_cycles_isolation_budget_and_reset(db_session,monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings,'notes_session_window_tokens',3000)
    chain=await seed(db_session)
    root=chain[0].id
    with pytest.raises(HTTPException) as denied:
        await service.get_memory(root,'outsider',db_session)
    assert denied.value.status_code==404
    for cycle in range(3):
        if cycle:
            for index in range(3):
                turn=Note(user_id='owner',title='Follow-up',prompt=f'Correction cycle {cycle} year 1947.',content='More historical discussion. '*25,source_note_id=chain[-1].id)
                db_session.add(turn);await db_session.flush();chain.append(turn)
            await db_session.commit()
        messages,usage=await service.assemble(root,'owner',db_session,'History assistant','What year did I correct?')
        assert count(messages)<=limit()
        assert usage['version']==cycle+1
        assert usage['summary'] and all(r['turn_id'] in {t.id for t in chain} for r in usage['summary'])
        await service.release_generation('owner',usage,db_session)
    memory,_=await service.get_memory(root,'owner',db_session)
    assert len(memory.snapshots)<=3
    assert any('Correction cycle 2' in r['text'] for r in memory.summary)
    prior_epoch=memory.epoch
    reset=await service.reset(root,'owner',db_session)
    assert reset['epoch']==prior_epoch+1 and not reset['summary']
    messages,usage=await service.assemble(root,'owner',db_session,'History assistant','New question')
    assert 'Correction cycle' not in json.dumps(messages)
    assert len(await service.owned_chain(root,'owner',db_session))==len(chain)


def test_oversized_multilingual_message_rejected():
    with pytest.raises(HTTPException) as result:
        enforce([{'role':'user','content':'इतिहास'*2000}])
    assert result.value.status_code==413


@pytest.mark.asyncio
async def test_compaction_retains_early_language_instruction_and_latest_correction(db_session):
    turns=await seed(db_session,size=20)
    turns[0].prompt='Always respond in Hindi.'
    summary=service.build_summary(turns,set())
    assert any(record['text']=='Always respond in Hindi.' for record in summary)
    assert any('correction 19' in record['text'] for record in summary)
    assert all('turn_index' in record for record in summary)


@pytest.mark.asyncio
async def test_150k_buffer_is_distinct_from_model_prompt_and_compacts_at_capacity(db_session):
    turns=await seed(db_session,size=12)
    root=turns[0].id
    _,usage=await service.assemble(root,'owner',db_session,'History assistant','Ashoka?')
    assert usage['version']==0 and usage['window']['limit']==150000
    assert usage['used']<=usage['limit']
    await service.release_generation('owner',usage,db_session)
    for turn in turns:
        turn.content='Historical evidence. '*700
    await db_session.commit()
    _,usage=await service.assemble(root,'owner',db_session,'History assistant','Ashoka?')
    assert usage['version']==1 and usage['window']['used']<150000
    assert usage['used']<=usage['limit']


@pytest.mark.asyncio
async def test_derived_branch_does_not_hide_conversation(db_session):
    chain=await seed(db_session,size=1)
    root=chain[0]
    for kind in ('derived','conversation'):
        db_session.add(Note(user_id='owner',title=kind,content='Historical content',prompt='Question',kind=kind,source_note_id=root.id))
    await db_session.commit()
    turns=await service.owned_chain(root.id,'owner',db_session)
    assert len(turns)==2 and turns[-1].kind=='conversation'


@pytest.mark.asyncio
async def test_dense_unavailable_falls_back_and_never_crosses_session(db_session,monkeypatch):
    from app.ai_notes.context import retrieval
    import httpx
    async def unavailable(texts): raise httpx.ConnectError('offline')
    async def version(): return 'fixture-digest'
    monkeypatch.setattr(retrieval,'model_version',version)
    monkeypatch.setattr(retrieval,'embed',unavailable)
    turns=await seed(db_session,size=4)
    index=await retrieval.build_index(turns)
    assert index['mode']=='lexical' and index['dense_unavailable']
    assert await retrieval.retrieve('Ashoka',[],index)==[]


@pytest.mark.asyncio
async def test_changed_embedding_digest_invalidates_index(db_session,monkeypatch):
    from app.ai_notes.context import retrieval
    async def version(): return 'changed-digest'
    monkeypatch.setattr(retrieval,'model_version',version)
    turns=await seed(db_session,size=2)
    index={'mode':'dense','version':'old-digest','dimension':768,'records':[{'turn_id':'foreign','text':'Leaked content'}],'vectors':[[0.0]*768]}
    result=await retrieval.retrieve('Ashoka',turns,index)
    assert index['mode']=='lexical' and index['dense_unavailable']
    assert all(record['turn_id'] in {turn.id for turn in turns} for record in result)


@pytest.mark.asyncio
async def test_reset_invalidates_late_compaction(db_session,monkeypatch):
    from app.core.config import settings
    from app.ai_notes.context import retrieval
    chain=await seed(db_session)
    root_id=chain[0].id
    monkeypatch.setattr(settings,'notes_memory_dense_enabled',True)
    async def index(turns):
        await service.reset(root_id,'owner',db_session)
        return {'mode':'lexical'}
    monkeypatch.setattr(retrieval,'build_index',index)
    with pytest.raises(HTTPException) as result:
        await service.compact(root_id,'owner',db_session)
    assert result.value.status_code==409
    memory,_=await service.get_memory(root_id,'owner',db_session)
    assert not memory.summary and memory.epoch==1


@pytest.mark.asyncio
async def test_generation_lease_blocks_concurrent_sends_and_reset_prevents_save(db_session):
    chain=await seed(db_session)
    root_id=chain[0].id
    _,usage=await service.assemble(root_id,'owner',db_session,'History','Ashoka?')
    with pytest.raises(HTTPException) as busy:
        await service.assemble(root_id,'owner',db_session,'History','Another question')
    assert busy.value.status_code==409
    await service.reset(root_id,'owner',db_session)
    with pytest.raises(HTTPException) as stale:
        await service.assert_generation('owner',usage,db_session)
    assert stale.value.status_code==409
    await service.release_generation('owner',usage,db_session)
    memory,_=await service.get_memory(root_id,'owner',db_session)
    assert memory.epoch==1 and memory.status=='ready'


@pytest.mark.asyncio
async def test_deleting_covered_turn_invalidates_all_derived_memory(db_session):
    from app.ai_notes.service import delete_user_note
    chain=await seed(db_session)
    root=chain[0].id
    await service.compact(root,'owner',db_session)
    await delete_user_note(chain[2].id,'owner',db_session)
    await db_session.commit()
    assert await db_session.scalar(select(NoteSessionMemory).where(NoteSessionMemory.root_id==root)) is None


@pytest.mark.asyncio
async def test_memory_api_owner_preferences_export_and_purge(client,db_session,monkeypatch):
    from tests.test_notes_research_lifecycle import account
    from app.core.security import decode_token
    from app.core.config import settings
    from app.auth.service import _in_process_export,_in_process_purge
    headers=await account(client,'memory')
    other=await account(client,'othermemory')
    owner=decode_token(headers['Authorization'].split()[1])['sub']
    chain=await seed(db_session,owner)
    root=chain[0].id
    response=await client.get(f'/api/notes/sessions/{root}/context',headers=headers)
    assert response.status_code==200
    assert (await client.get(f'/api/notes/sessions/{root}/context',headers=other)).status_code==404
    compacted=await client.post(f'/api/notes/sessions/{root}/context/compact',headers=headers)
    assert compacted.status_code==200 and compacted.json()['version']==1
    exported=await _in_process_export(db_session,owner,'ai_notes.json')
    assert exported['session_memories'][0]['root_id']==root
    _,usage=await service.assemble(root,owner,db_session,'History assistant','Ashoka?')
    mismatch=await client.post(f'/api/notes/sessions/{root}/context/cancel',headers=headers,json={'operation_id':'different'})
    assert mismatch.json()['cancelled'] is False
    stopped=await client.post(f'/api/notes/sessions/{root}/context/cancel',headers=headers,json={'operation_id':usage['generation_id']})
    assert stopped.json()['cancelled'] is True
    preferences=await client.patch('/api/auth/me/preferences',headers=headers,json={'notes_memory_default':False})
    assert preferences.status_code==200 and preferences.json()['preferences']['notes_memory_default'] is False
    new_root=Note(user_id=owner,title='Separate session',content='Other historical content',prompt='Other question')
    db_session.add(new_root);await db_session.commit()
    context=await client.get(f'/api/notes/sessions/{new_root.id}/context',headers=headers)
    assert context.json()['enabled'] is False
    assert (await client.get('/api/notes/sessions',headers=other)).json()==[]
    await _in_process_purge(db_session,owner);await db_session.commit()
    assert await db_session.scalar(select(NoteSessionMemory).where(NoteSessionMemory.user_id==owner)) is None
