"""Private session memory controls; never included in public note sharing."""
from fastapi import APIRouter,Depends,HTTPException,Query
from typing import Literal
from pydantic import BaseModel
from sqlalchemy import select,update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session
from app.core.deps import CurrentUser,get_current_user
from app.ai_notes.models import Note,NoteSessionMemory
from .service import get_memory,serialize,compact,reset,configure
from .budget import count,limit

async def active_owner(user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    from app.ai_notes.research.lifecycle import require_active_owner
    await require_active_owner(user.id,db)


router=APIRouter(prefix='/api/notes/sessions',tags=['AI Notes Memory'],dependencies=[Depends(active_owner)])


@router.get('')
async def sessions(user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session),
                   offset:int=Query(0,ge=0),page_size:int=Query(100,ge=1,le=100)):
    roots=(await db.execute(select(Note).where(Note.user_id==user.id,Note.source_note_id.is_(None)).order_by(Note.created_at.desc(),Note.id).offset(offset).limit(page_size))).scalars().all()
    memories=(await db.execute(select(NoteSessionMemory).where(NoteSessionMemory.user_id==user.id,
                               NoteSessionMemory.root_id.in_([r.id for r in roots])))).scalars().all()
    lookup={m.root_id:m for m in memories}
    return [{'root_id':root.id,'title':root.title,'status':lookup[root.id].status if root.id in lookup else 'ready',
             'version':lookup[root.id].version if root.id in lookup else 0,
             'updated_at':lookup[root.id].updated_at if root.id in lookup else root.created_at,
             'summary_bytes':len(str(lookup[root.id].summary).encode()) if root.id in lookup else 0} for root in roots]


@router.get('/{root_id}/context')
async def context(root_id:str,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    memory,chain=await get_memory(root_id,user.id,db)
    return {**serialize(memory,chain),'limit':limit(),'summary_estimate':count([{'content':str(memory.summary)}]),
            'disclosure':'Memory is private conversation context, not verified history or fresh web evidence. Usage is estimated; wallet credits are separate.'}


@router.post('/{root_id}/context/compact')
async def compact_context(root_id:str,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    return await compact(root_id,user.id,db)


@router.post('/{root_id}/context/rebuild')
async def rebuild_context(root_id:str,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    return await compact(root_id,user.id,db,rebuild=True)


class ResetRequest(BaseModel):
    enabled:bool|None=None


class MemorySettings(BaseModel):
    enabled:bool|None=None
    auto_compact:bool|None=None
    mode:Literal['minimal','balanced','detailed']|None=None


@router.patch('/{root_id}/context/settings')
async def memory_settings(root_id:str,body:MemorySettings,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    return await configure(root_id,user.id,db,{k:v for k,v in body.model_dump(exclude_unset=True).items() if v is not None})


class CancelRequest(BaseModel):
    operation_id:str


@router.post('/{root_id}/context/cancel')
async def cancel_generation(root_id:str,body:CancelRequest,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    memory,chain=await get_memory(root_id,user.id,db)
    result=await db.execute(update(NoteSessionMemory).where(NoteSessionMemory.root_id==memory.root_id,
        NoteSessionMemory.user_id==user.id,NoteSessionMemory.operation_id==body.operation_id,
        NoteSessionMemory.status=='generating').values(status='compacted' if memory.version else 'ready',operation_id=None,lease_until=None))
    await db.commit()
    return {'cancelled':result.rowcount==1}


@router.post('/{root_id}/context/reset')
async def reset_context(root_id:str,body:ResetRequest,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    if body.enabled is not None:
        return await configure(root_id,user.id,db,{'enabled':body.enabled})
    return await reset(root_id,user.id,db,body.enabled)


@router.delete('/{root_id}')
async def remove_session(root_id:str,user:CurrentUser=Depends(get_current_user),db:AsyncSession=Depends(get_async_session)):
    from app.ai_notes.service import delete_user_note
    memory,chain=await get_memory(root_id,user.id,db)
    await delete_user_note(chain[0].id,user.id,db)
    return {'deleted':True}


async def export_memories(owner,db):
    memories=(await db.execute(select(NoteSessionMemory).where(NoteSessionMemory.user_id==owner))).scalars().all()
    return [serialize(m) for m in memories]
