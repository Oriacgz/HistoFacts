"""
Service logic for creating, listing, revising, sharing, and restyling AI notes with token deductions.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.models import Note, GroupSharedNote
from app.ai_notes.schemas import GenerateNoteRequest, ReviseNoteRequest
from app.ai_notes.llm_client import (
    generate_curriculum_note,
    generate_handwritten_note,
    generate_revision_note,
    calculate_approx_tokens,
    is_history_related,
    REFUSAL_MESSAGE,
    SYSTEM_PROMPT,
)
from app.ai_notes.wallet_service import (
    preflight_token_check,
    deduct_generation_tokens,
)
from app.core.inter_service import notify


async def create_note_for_user(req: GenerateNoteRequest, user_id: str, db: AsyncSession) -> Note:
    # 0. Pre-classification guard — rejects off-topic before spending tokens
    if not await is_history_related(req.topic):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=REFUSAL_MESSAGE,
        )

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
        prompt=req.topic,
        content=content,
        curriculum_tag=req.curriculum,
        style=req.style or "standard",
        attachment_name=req.attachment_name,
        attachment_type=req.attachment_type,
        is_ai_generated=True,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    await notify(
        user_id=user_id,
        type="note_ready",
        payload={
            "note_id": note.id,
            "title": note.title,
            "curriculum": note.curriculum_tag,
            "style": note.style,
        },
    )

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

    # 5. Save as new handwritten note (original untouched)
    new_note = Note(
        user_id=user_id,
        event_id=original.event_id,
        title=new_title,
        prompt=f"Convert \"{original.title}\" to handwritten lecture style",
        content=rewritten_content,
        curriculum_tag=original.curriculum_tag,
        style="handwritten",
        source_note_id=original.id,
        attachment_name=original.attachment_name,
        attachment_type=original.attachment_type,
        is_ai_generated=True,
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)

    await notify(
        user_id=user_id,
        type="note_ready",
        payload={
            "note_id": new_note.id,
            "title": new_note.title,
            "curriculum": new_note.curriculum_tag,
            "style": new_note.style,
        },
    )

    return new_note


async def revise_note_for_user(note_id: str, req: ReviseNoteRequest, user_id: str, db: AsyncSession) -> Note:
    """
    Create a revised version of a note from a plain-language instruction.
    The original note is never modified — the revised copy is linked via source_note_id.
    Off-topic instructions are rejected before any generation call (0 tokens charged).
    """
    # 1. Fetch original note
    res = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    original = res.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    # 2. Pre-classification guard — reject off-topic revision instructions
    if not await is_history_related(req.instruction, thread_topic=original.title):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=REFUSAL_MESSAGE,
        )

    # 3. Pre-flight token check
    estimated_tokens = calculate_approx_tokens(original.content) + calculate_approx_tokens(req.instruction) + 1200
    await preflight_token_check(user_id, estimated_tokens, db)

    # 4. Generate revised content
    new_title, revised_content, actual_tokens = await generate_revision_note(
        original_title=original.title,
        original_content=original.content,
        instruction=req.instruction,
    )

    # 5. Deduct actual tokens
    await deduct_generation_tokens(user_id, actual_tokens, db)

    # 6. Save as new note linked to original (original is untouched)
    new_note = Note(
        user_id=user_id,
        event_id=original.event_id,
        title=new_title,
        prompt=req.instruction,
        content=revised_content,
        curriculum_tag=original.curriculum_tag,
        style=original.style,
        source_note_id=original.id,
        is_ai_generated=True,
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)

    await notify(
        user_id=user_id,
        type="note_ready",
        payload={
            "note_id": new_note.id,
            "title": new_note.title,
            "curriculum": new_note.curriculum_tag,
            "style": new_note.style,
        },
    )

    return new_note


async def get_user_notes(user_id: str, db: AsyncSession) -> list[Note]:
    """
    Return only root notes for the library view so revisions and conversions
    do not clutter the sidebar.
    """
    res = await db.execute(
        select(Note)
        .where(Note.user_id == user_id, Note.source_note_id.is_(None))
        .order_by(Note.created_at.desc())
    )
    return res.scalars().all()


async def get_note_thread_for_user(note_id: str, user_id: str, db: AsyncSession) -> list[Note]:
    """
    Walk the version chain starting from a root note down to all turns in order.
    Each entry includes both prompt and content.
    """
    res = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    root = res.scalar_one_or_none()
    if not root:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    if root.source_note_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a root note")

    chain = [root]
    current = root
    while True:
        nxt_res = await db.execute(
            select(Note)
            .where(Note.source_note_id == current.id, Note.user_id == user_id)
            .order_by(Note.created_at.asc())
        )
        nxt = nxt_res.scalars().first()
        if not nxt:
            break
        chain.append(nxt)
        current = nxt
    return chain


def build_conversation_messages(chain: list[Note]) -> list[dict]:
    """
    Build message history from the thread chain for multi-turn coherence.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in chain:
        user_prompt = turn.prompt or turn.title or "Historical query"
        messages.append({"role": "user", "content": user_prompt})
        messages.append({"role": "assistant", "content": turn.content})
    return messages


async def save_conversation_turn(
    root_note_id: str,
    user_id: str,
    prompt: str,
    content: str,
    db: AsyncSession,
    style: str = "standard",
) -> Note:
    """
    Append a new turn to the active session thread, chaining off the current leaf note.
    """
    chain = await get_note_thread_for_user(root_note_id, user_id, db)
    root = chain[0]
    leaf = chain[-1]

    clean_prompt = prompt.strip().replace("\n", " ")
    if len(clean_prompt) > 50:
        turn_title = f"{clean_prompt[:47]}..."
    else:
        turn_title = clean_prompt or "Follow-up"

    new_turn = Note(
        user_id=user_id,
        event_id=root.event_id,
        title=f"Follow-up: {turn_title}",
        prompt=prompt,
        content=content,
        curriculum_tag=root.curriculum_tag,
        style=style,
        source_note_id=leaf.id,
        is_ai_generated=True,
    )
    db.add(new_turn)
    await db.commit()
    await db.refresh(new_turn)

    await notify(
        user_id=user_id,
        type="note_ready",
        payload={
            "note_id": new_turn.id,
            "title": new_turn.title,
            "curriculum": new_turn.curriculum_tag,
            "style": new_turn.style,
        },
    )
    return new_turn


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

    # If deleting a root note, delete all chained child turns in the thread
    if note.source_note_id is None:
        try:
            chain = await get_note_thread_for_user(note_id, user_id, db)
            for item in reversed(chain):
                await db.delete(item)
            await db.flush()
            return True
        except Exception:
            pass

    await db.delete(note)
    await db.flush()
    return True
