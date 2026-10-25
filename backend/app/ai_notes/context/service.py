"""Bounded extractive rolling memory with source IDs, epochs and operation leases.

Compaction copies excerpts from committed turns, rather than inventing a factual
summary with another model. Original notes are the source of truth for rebuilding.
"""
import hashlib
import json
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from app.ai_notes.models import Note, NoteSessionMemory
from .budget import count, enforce, limit

PRESETS={'minimal':{'summary_bytes':768,'recent_pairs':2},
         'balanced':{'summary_bytes':1100,'recent_pairs':3},
         'detailed':{'summary_bytes':2000,'recent_pairs':5}}


def policy(memory):
    account=getattr(memory,'_account_policy',{})
    local=(memory.retrieval or {}).get('policy',{})
    return {'enabled':memory.enabled and account.get('enabled',True),
            'auto_compact':local.get('auto_compact',account.get('auto_compact',True)),
            'mode':local.get('mode',account.get('mode','balanced'))}


def clip(value, size):
    return value.encode('utf-8')[:size].decode('utf-8',errors='ignore')


async def owned_chain(root_id, owner, db):
    from app.ai_notes.service import get_note_thread_for_user
    return [turn for turn in await get_note_thread_for_user(root_id,owner,db) if turn.source_note_id is None or turn.kind != "derived"]


async def get_memory(root_id, owner, db):
    from app.auth.models import User
    user=await db.get(User,owner,populate_existing=True)
    chain = await owned_chain(root_id,owner,db)
    root = chain[0]
    memory = await db.scalar(select(NoteSessionMemory).where(NoteSessionMemory.root_id == root.id,
                            NoteSessionMemory.user_id == owner).execution_options(populate_existing=True))
    if not memory:
        enabled=(user.preferences or {}).get('notes_memory_default',True) if user else True
        memory = NoteSessionMemory(root_id=root.id,user_id=owner,enabled=enabled)
        db.add(memory)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            memory = await db.scalar(select(NoteSessionMemory).where(NoteSessionMemory.root_id == root.id,NoteSessionMemory.user_id == owner))
    memory._account_policy=(user.preferences or {}).get('ai_notes_memory',{}) if user else {}
    if memory.status in {'compacting','generating'} and memory.lease_until:
        expiry=memory.lease_until.replace(tzinfo=timezone.utc) if memory.lease_until.tzinfo is None else memory.lease_until
        if expiry < datetime.now(timezone.utc):
            memory.status='degraded'
            memory.operation_id=None
            await db.commit()
    return memory,chain


def serialize(memory, chain=None):
    data = {key:getattr(memory,key) for key in ('root_id','epoch','version','enabled','summary','covered_ids','status','operation_id')}
    data['updated_at']=memory.updated_at.isoformat()
    data['method']='source-linked extractive rolling memory'
    data['retrieval_mode']=memory.retrieval.get('mode','lexical')
    data['dense_unavailable']=bool(memory.retrieval.get('dense_unavailable'))
    data['snapshots']=len(memory.snapshots)
    data['last_usage']=memory.retrieval.get('last_usage')
    data['session_enabled']=memory.enabled
    data['policy']=policy(memory)
    data['enabled']=data['policy']['enabled']
    if chain:
        from app.core.config import settings
        active=[t for t in chain if t.id not in set(memory.covered_ids+memory.ignored_ids)]
        used=count([m for t in active for m in ({'role':'user','content':t.prompt or ''},{'role':'assistant','content':t.content or ''})])
        data['window']={'used':used,'limit':settings.notes_session_window_tokens,'estimated':True}
        data['title']=chain[0].title
        data['turns']=len(chain)
    return data


def excerpts(turn):
    # Exclude source appendix, reasoning, embedded images and credential patterns.
    text = re.sub(r'<think>.*?</think>','',turn.content or '',flags=re.S|re.I).split('### Sources')[0]
    prompt=re.sub(r'data:[^\s]+','[attachment omitted]',turn.prompt or '')
    def clean(value):
        return re.sub(r'(?i)\b(?:sk-|tvly-|bearer\s+)[\w.-]+','[credential omitted]',value)
    records=[]
    for role,value in [('user',prompt),('assistant',text)]:
        for part in re.split(r'\n\s*\n|(?<=[.!?])\s+',clean(value)):
            part=part.strip()
            if len(part) >= 4:
                records.append({'turn_id':turn.id,'role':role,'text':clip(part,600),
                    'provenance':'conversation claim; not independently verified'})
    return records


def build_summary(chain, ignored, max_bytes=1100):
    records=[{**record,'turn_index':index} for index,turn in enumerate(chain) if turn.id not in ignored for record in excerpts(turn)]
    # Latest corrections/instructions rank first; original excerpts remain retrievable.
    def priority(item):
        index,record=item
        instructions=bool(re.search(r'always|from now|answer in|respond in|learning goal|exam goal|हमेशा',record['text'],re.I))
        correction=bool(re.search(r'correct|instead|remember|prefer|not |गलत|सुधार',record['text'],re.I))
        return record['role']=='user',2 if instructions else 1 if correction else 0,index
    ranked=sorted(enumerate(records),key=priority,reverse=True)
    summary=[]
    for _,record in ranked:
        if len(json.dumps(summary+[record],ensure_ascii=False).encode()) <= max_bytes:
            summary.append(record)
    return summary


def validate_summary(summary,turns,max_bytes):
    sources={turn.id for turn in turns}
    if not isinstance(summary,list) or len(json.dumps(summary,ensure_ascii=False).encode())>max_bytes:
        raise ValueError('Invalid summary size or schema')
    if any(not isinstance(record,dict) or record.get('turn_id') not in sources
           or record.get('role') not in {'user','assistant'} or not isinstance(record.get('text'),str)
           or not record['text'].strip() for record in summary):
        raise ValueError('Invalid summary source reference')
    if turns and not summary:
        raise ValueError('Empty summary candidate')


async def compact(root_id,owner,db,rebuild=False):
    memory,chain=await get_memory(root_id,owner,db)
    if not policy(memory)['enabled']:
        raise HTTPException(409,'Session memory is disabled.')
    if memory.status in {'compacting','generating'}:
        raise HTTPException(409,'This session is busy. Please retry after it finishes.')
    operation=str(uuid.uuid4())
    epoch,version=memory.epoch,memory.version
    from app.core.config import settings
    recent_size=count([{'content':(t.prompt or '')+(t.content or '')} for t in chain[-2:]])
    older=chain[:-2] if recent_size<settings.notes_session_window_tokens else (chain[:-1] or chain)
    if rebuild and not older:
        older=chain
    ignored=[] if rebuild else list(memory.ignored_ids)
    eligible=[turn for turn in older if turn.id not in ignored]
    if not eligible:
        return serialize(memory,chain)
    if not rebuild and memory.covered_ids==[turn.id for turn in eligible] and memory.summary:
        return serialize(memory,chain)
    reserved=await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==memory.root_id,
        NoteSessionMemory.user_id==owner,NoteSessionMemory.epoch==epoch,NoteSessionMemory.version==version,
        NoteSessionMemory.status.notin_(['compacting','generating'])).values(status='compacting',operation_id=operation,
            lease_until=datetime.now(timezone.utc)+timedelta(minutes=2)))
    if reserved.rowcount != 1:
        await db.rollback()
        raise HTTPException(409,'Session context changed. Reload and try again.')
    root=memory.root_id
    local_policy=memory.retrieval.get('policy',{})
    max_bytes=PRESETS[policy(memory)['mode']]['summary_bytes']
    previous={'version':version,'summary':memory.summary,'covered_ids':memory.covered_ids}
    await db.commit()
    # No open transaction during extraction or optional embedding calls.
    try:
        summary=build_summary(eligible,set(ignored),max_bytes)
        validate_summary(summary,eligible,max_bytes)
    except (ValueError,TypeError,KeyError):
        await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==root,
            NoteSessionMemory.user_id==owner,NoteSessionMemory.epoch==epoch,
            NoteSessionMemory.operation_id==operation).values(status='degraded',operation_id=None,lease_until=None))
        await db.commit()
        memory,chain=await get_memory(root,owner,db)
        return serialize(memory,chain)
    retrieval={'mode':'lexical','policy':local_policy,'source_hash':hashlib.sha256(''.join(t.id+(t.content or '') for t in eligible).encode()).hexdigest()}
    from app.core.config import settings
    if settings.notes_memory_dense_enabled:
        from .retrieval import build_index
        retrieval={**retrieval,**await build_index(eligible)}
    current=await db.scalar(select(NoteSessionMemory).where(NoteSessionMemory.root_id==root,
        NoteSessionMemory.user_id==owner,NoteSessionMemory.epoch==epoch,NoteSessionMemory.version==version,
        NoteSessionMemory.operation_id==operation).with_for_update().execution_options(populate_existing=True))
    if not current or not await db.scalar(select(Note.id).where(Note.id==root,Note.user_id==owner)):
        await db.rollback()
        raise HTTPException(409,'Memory was reset or removed during compaction.')
    current.snapshots=(list(current.snapshots)+[previous])[-3:]
    current.summary=summary
    current.covered_ids=[t.id for t in eligible]
    current.ignored_ids=ignored
    current.version+=1
    current.status='compacted'
    current.operation_id=None
    current.lease_until=None
    current.retrieval=retrieval
    current.updated_at=datetime.now(timezone.utc)
    await db.commit()
    return serialize(current,chain)


async def reset(root_id,owner,db,enabled=None):
    memory,chain=await get_memory(root_id,owner,db)
    # Atomic epoch invalidation prevents an older operation from republishing.
    await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==memory.root_id,
        NoteSessionMemory.user_id==owner).values(epoch=NoteSessionMemory.epoch+1,version=0,summary=[],covered_ids=[],
        ignored_ids=[turn.id for turn in chain],snapshots=[],retrieval={'policy':memory.retrieval.get('policy',{})},status='ready',operation_id=None,lease_until=None,
        enabled=memory.enabled if enabled is None else enabled,updated_at=datetime.now(timezone.utc)))
    await db.commit()
    memory,chain=await get_memory(root_id,owner,db)
    return serialize(memory,chain)


async def configure(root_id,owner,db,changes):
    memory,chain=await get_memory(root_id,owner,db)
    # Settings invalidate an in-flight prompt without deleting saved memory.
    enabled=changes.get('enabled',memory.enabled)
    options={**memory.retrieval.get('policy',{}),**{k:v for k,v in changes.items() if k!='enabled'}}
    await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==memory.root_id,
        NoteSessionMemory.user_id==owner).values(enabled=enabled,epoch=NoteSessionMemory.epoch+1,
        retrieval={**memory.retrieval,'policy':options},status='ready',operation_id=None,lease_until=None,
        updated_at=datetime.now(timezone.utc)))
    await db.commit()
    memory,chain=await get_memory(root_id,owner,db)
    return serialize(memory,chain)


async def recover_expired(db):
    """Recover abandoned leases at startup without replacing valid summaries."""
    result=await db.execute(update(NoteSessionMemory).where(
        NoteSessionMemory.status.in_(['generating','compacting']),
        NoteSessionMemory.lease_until<datetime.now(timezone.utc)).values(
            status='degraded',operation_id=None,lease_until=None))
    await db.commit()
    return result.rowcount


async def assemble(root_id,owner,db,system,current):
    memory,chain=await get_memory(root_id,owner,db)
    if memory.status in {'compacting','generating'}:
        raise HTTPException(409,'This session is busy in another request. Please wait for it to finish.')
    enforce([{'role':'system','content':system},{'role':'user','content':current}])
    options=policy(memory)
    eligible=[t for t in chain if t.id not in memory.ignored_ids] if options['enabled'] else []
    compacted=False
    from app.core.config import settings
    uncovered=[t for t in eligible if t.id not in memory.covered_ids]
    window_messages=[m for t in uncovered for m in ({'role':'user','content':t.prompt or ''},{'role':'assistant','content':t.content or ''})]
    projected_window=count(window_messages+[{'role':'user','content':current}])
    if options['enabled'] and options['auto_compact'] and projected_window>=settings.notes_session_window_tokens and eligible:
        if memory.covered_ids != [t.id for t in eligible[:-2]]:
            previous_version=memory.version
            await compact(memory.root_id,owner,db)
            memory,chain=await get_memory(root_id,owner,db)
            compacted=memory.version>previous_version
    base=[{'role':'system','content':system}]
    recent_pairs=PRESETS[options['mode']]['recent_pairs']
    # Prompt pressure can occur long before the 150K storage buffer fills.
    # Extract from originals for those older turns without marking them compacted.
    older=eligible[:-recent_pairs]
    context_summary=memory.summary
    if older:
        try:
            candidate=build_summary(older,set(),PRESETS[options['mode']]['summary_bytes'])
            validate_summary(candidate,older,PRESETS[options['mode']]['summary_bytes'])
            context_summary=candidate
        except (ValueError,TypeError,KeyError):
            pass  # The last validated memory and bounded recent pairs remain usable.
    if options['enabled'] and eligible:
        topic=clip(eligible[0].prompt or eligible[0].title,240)
        base.append({'role':'user','content':'Earlier session topic (untrusted conversation context): '+topic})
    if options['enabled'] and context_summary:
        base.append({'role':'user','content':'Saved conversation excerpts (untrusted context, not verified facts or fresh web evidence):\n'+json.dumps(context_summary,ensure_ascii=False)})
    tail=[{'role':'user','content':current}]
    while count(base+tail)>limit() and len(base)>1:
        base.pop()
    selected=[]
    for turn in reversed(eligible[-recent_pairs:]):
        pair=[{'role':'user','content':turn.prompt or turn.title},{'role':'assistant','content':turn.content}]
        if count(base+pair+selected+tail) <= limit():
            selected=pair+selected
        else:
            # Keep the topic and a bounded answer excerpt when a full turn is
            # too large. Dropping it entirely makes short follow-ups contextless.
            available=limit()-count(base+selected+tail)-48
            if available < 160:
                break
            budget=available//min(3,len(eligible))
            if budget < 160:
                budget=available
            prompt=clip(turn.prompt or turn.title,max(64,budget//3))
            answer=clip(turn.content or '',max(0,budget-len(prompt.encode())-40))
            pair=[{'role':'user','content':prompt},
                  {'role':'assistant','content':answer+'\n[Earlier answer excerpt; truncated]'}]
            if count(base+pair+selected+tail)<=limit():
                selected=pair+selected
    # Bounded older recall: ownership was filtered before ranking.
    from .retrieval import retrieve
    recalled=await retrieve(current,older,memory.retrieval)
    included=[]
    for record in recalled:
        entry={'role':'user','content':'Older untrusted conversation excerpt: '+json.dumps(record,ensure_ascii=False)}
        if count(base+[entry]+selected+tail)<=limit():
            base.append(entry)
            included.append(record['turn_id'])
    messages=base+selected+tail
    usage=enforce(messages)
    usage.update(serialize(memory,chain))
    usage.update({'compacted_now':compacted,'recent_pairs':len(selected)//2,'retrieved_turn_ids':included,
        'compaction_due':options['enabled'] and projected_window>=settings.notes_session_window_tokens,
        'history_reduced':len(selected)//2 < min(2,len(eligible))})
    operation=str(uuid.uuid4())
    claimed=await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==memory.root_id,
        NoteSessionMemory.user_id==owner,NoteSessionMemory.epoch==memory.epoch,NoteSessionMemory.version==memory.version,
        NoteSessionMemory.status.notin_(['compacting','generating'])).values(status='generating',operation_id=operation,
        lease_until=datetime.now(timezone.utc)+timedelta(minutes=4),
        retrieval={**memory.retrieval,'last_usage':{k:usage[k] for k in ('used','limit','recent_pairs','history_reduced')}}))
    if claimed.rowcount!=1:
        await db.rollback()
        raise HTTPException(409,'Session changed while preparing context. Reload and try again.')
    usage['generation_id']=operation
    await db.commit()
    return messages,usage


async def assert_generation(owner,usage,db):
    memory,_=await get_memory(usage['root_id'],owner,db)
    if 'policy' in usage and policy(memory)!=usage['policy']:
        raise HTTPException(409,'Session memory preferences changed. Retry with the current settings.')
    valid=await db.scalar(select(NoteSessionMemory.root_id).where(NoteSessionMemory.root_id==usage['root_id'],
        NoteSessionMemory.user_id==owner,NoteSessionMemory.epoch==usage['epoch'],NoteSessionMemory.operation_id==usage['generation_id'],
        NoteSessionMemory.status=='generating').with_for_update())
    if not valid:
        raise HTTPException(409,'Session memory changed or the conversation was removed. This answer was not saved or charged.')


async def release_generation(owner,usage,db):
    await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==usage['root_id'],
        NoteSessionMemory.user_id==owner,NoteSessionMemory.operation_id==usage['generation_id']).values(
        status='compacted' if usage['version'] else 'ready',operation_id=None,lease_until=None))
    await db.commit()


def managed_response(response,owner,usage):
    import asyncio
    from fastapi.responses import StreamingResponse
    from app.core.database import streaming_session_scope
    async def body():
        try:
            yield 'event: context.status\ndata: '+json.dumps({'type':'context.status','context':usage})+'\n\n'
            async for chunk in response.body_iterator:
                yield chunk
        finally:
            async def cleanup():
                try:
                    await response.body_iterator.aclose()
                finally:
                    async with streaming_session_scope() as db:
                        await release_generation(owner,usage,db)
                        try:
                            memory,chain=await get_memory(usage['root_id'],owner,db)
                        except HTTPException as error:
                            if error.status_code==404:
                                return
                            raise
                        window=serialize(memory,chain).get('window',{})
                        options=policy(memory)
                        if options['enabled'] and options['auto_compact'] and window.get('used',0)>=window.get('limit',150000):
                            await compact(memory.root_id,owner,db)
            await asyncio.shield(asyncio.create_task(cleanup()))
    return StreamingResponse(body(),media_type=response.media_type,status_code=response.status_code,headers=dict(response.headers))
