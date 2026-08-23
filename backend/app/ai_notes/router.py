"""
FastAPI router for AI Notes endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.schemas import GenerateNoteRequest, NoteResponse, UpdateNoteRequest
from app.ai_notes.service import (
    create_note_for_user,
    get_user_notes,
    update_note,
    share_note_to_group,
    delete_user_note,
)
from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.auth.models import User

router = APIRouter(prefix="/api/notes", tags=["AI Notes"])


@router.post("/generate", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def generate_note(
    req: GenerateNoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    note = await create_note_for_user(req, current_user.id, db)
    return NoteResponse.model_validate(note)


@router.get("", response_model=list[NoteResponse])
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    notes = await get_user_notes(current_user.id, db)
    return [NoteResponse.model_validate(n) for n in notes]


@router.put("/{note_id}", response_model=NoteResponse)
async def edit_note(
    note_id: str,
    req: UpdateNoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    note = await update_note(note_id, req, current_user.id, db)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse.model_validate(note)


@router.delete("/{note_id}", status_code=status.HTTP_200_OK)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    deleted = await delete_user_note(note_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "deleted", "note_id": note_id}


@router.post("/{note_id}/share/{group_id}", status_code=status.HTTP_200_OK)
async def share_note(
    note_id: str,
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    shared = await share_note_to_group(note_id, group_id, current_user.id, db)
    if not shared:
        raise HTTPException(status_code=400, detail="Note already shared to this group")
    return {"status": "shared", "note_id": note_id, "group_id": group_id}
