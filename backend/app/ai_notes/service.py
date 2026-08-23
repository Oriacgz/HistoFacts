"""
Service logic for creating, listing, updating, and sharing AI notes.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.models import Note, GroupSharedNote
from app.ai_notes.schemas import GenerateNoteRequest, UpdateNoteRequest
from app.ai_notes.llm_client import generate_curriculum_note


async def create_note_for_user(req: GenerateNoteRequest, user_id: str, db: AsyncSession) -> Note:
    title, content = await generate_curriculum_note(
        topic=req.topic,
        curriculum=req.curriculum,
        attachment_name=req.attachment_name,
        attachment_type=req.attachment_type,
        attachment_text=req.attachment_text,
        attachment_data=req.attachment_data,
    )

    note = Note(
        user_id=user_id,
        event_id=req.event_id,
        title=title,
        content=content,
        curriculum_tag=req.curriculum,
        is_ai_generated=True,
    )
    db.add(note)
    await db.flush()
    return note


async def get_user_notes(user_id: str, db: AsyncSession) -> list[Note]:
    res = await db.execute(
        select(Note).where(Note.user_id == user_id).order_by(Note.created_at.desc())
    )
    return res.scalars().all()


async def update_note(note_id: str, req: UpdateNoteRequest, user_id: str, db: AsyncSession) -> Note | None:
    res = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user_id)
    )
    note = res.scalar_one_or_none()
    if not note:
        return None

    if req.title is not None:
        note.title = req.title
    if req.content is not None:
        note.content = req.content
    if req.curriculum_tag is not None:
        note.curriculum_tag = req.curriculum_tag

    await db.flush()
    return note


async def share_note_to_group(note_id: str, group_id: str, user_id: str, db: AsyncSession) -> bool:
    res = await db.execute(
        select(GroupSharedNote).where(
            GroupSharedNote.group_id == group_id, GroupSharedNote.note_id == note_id
        )
    )
    if res.scalar_one_or_none():
        return False

    shared = GroupSharedNote(group_id=group_id, note_id=note_id, shared_by=user_id)
    db.add(shared)
    await db.flush()
    return True


async def delete_user_note(note_id: str, user_id: str, db: AsyncSession) -> bool:
    res = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user_id)
    )
    note = res.scalar_one_or_none()
    if not note:
        return False
    await db.delete(note)
    await db.flush()
    return True
