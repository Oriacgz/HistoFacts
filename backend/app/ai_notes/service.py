"""
Service logic for creating, listing, updating, sharing, and restyling AI notes with token deductions.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.models import Note, GroupSharedNote
from app.ai_notes.schemas import GenerateNoteRequest, UpdateNoteRequest
from app.ai_notes.llm_client import (
    generate_curriculum_note,
    generate_handwritten_note,
    calculate_approx_tokens,
)
from app.ai_notes.wallet_service import (
    preflight_token_check,
    deduct_generation_tokens,
)


async def create_note_for_user(req: GenerateNoteRequest, user_id: str, db: AsyncSession) -> Note:
    # 1. Pre-flight token estimation check
    prompt_tokens = calculate_approx_tokens(req.topic) + calculate_approx_tokens(req.attachment_text or "")
    estimated_tokens = prompt_tokens + 1200  # estimated prompt + output
    await preflight_token_check(user_id, estimated_tokens, db)

    # 2. Call LLM
    title, content, actual_tokens = await generate_curriculum_note(
        topic=req.topic,
        curriculum=req.curriculum,
        attachment_name=req.attachment_name,
        attachment_type=req.attachment_type,
        attachment_text=req.attachment_text,
        attachment_data=req.attachment_data,
    )

    # 3. Deduct actual tokens used
    await deduct_generation_tokens(user_id, actual_tokens, db)

    # 4. Save note
    note = Note(
        user_id=user_id,
        event_id=req.event_id,
        title=title,
        content=content,
        curriculum_tag=req.curriculum,
        style=req.style or "standard",
        attachment_name=req.attachment_name,
        attachment_type=req.attachment_type,
        is_ai_generated=True,
    )
    db.add(note)
    await db.flush()
    return note


async def create_handwritten_note_for_user(note_id: str, user_id: str, db: AsyncSession) -> Note:
    """Restyle an existing note into student handwritten lecture notes."""
    # 1. Fetch original note
    res = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    original = res.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source note not found")

    # 2. Pre-flight token estimation check
    estimated_tokens = calculate_approx_tokens(original.content) * 2 + 500
    await preflight_token_check(user_id, estimated_tokens, db)

    # 3. Call LLM restyler
    new_title, rewritten_content, actual_tokens = await generate_handwritten_note(
        original_title=original.title,
        original_content=original.content,
    )

    # 4. Deduct actual tokens
    await deduct_generation_tokens(user_id, actual_tokens, db)

    # 5. Save as new handwritten note
    new_note = Note(
        user_id=user_id,
        event_id=original.event_id,
        title=new_title,
        content=rewritten_content,
        curriculum_tag=original.curriculum_tag,
        style="handwritten",
        source_note_id=original.id,
        attachment_name=original.attachment_name,
        attachment_type=original.attachment_type,
        is_ai_generated=True,
    )
    db.add(new_note)
    await db.flush()
    return new_note


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
    if req.style is not None:
        note.style = req.style

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
