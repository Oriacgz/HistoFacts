"""Re-ground revisions in retained evidence; never copy old citation markers."""
import asyncio
import copy
import hashlib
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from app.ai_notes.models import Note, NoteResearchRun
from app.ai_notes.wallet_service import preflight_token_check, deduct_generation_tokens
from .lifecycle import require_active_owner
from .providers import ResearchUnavailable
from .service import answer_from_sources


async def transform_note(original, run, user_id, db, instruction, think=False, style="standard"):
    await require_active_owner(user_id, db)
    if run.state == "excerpts_expired" or not run.sources or any(not source.get("passages") for source in run.sources):
        raise HTTPException(409, "Saved evidence has expired. Use a fresh researched follow-up before rewriting this note.")
    await preflight_token_check(user_id, 2000, db)
    sources = copy.deepcopy(run.sources)
    await db.commit()  # Release preflight locks while the model works.
    try:
        async with asyncio.timeout(150):
            content, sources, tokens = await answer_from_sources(original.prompt or original.title, sources,
                think=think, instruction=instruction)
    except Exception as error:
        raise HTTPException(422, "The rewrite could not be supported by the saved evidence. The original note is unchanged.") from error
    # Lock and recheck after generation so deletion/expiry cannot be undone by a late rewrite.
    await require_active_owner(user_id, db)
    exists = await db.scalar(select(Note.id).where(Note.id == original.id, Note.user_id == user_id))
    if not exists:
        raise HTTPException(404, "Source note was removed during rewriting.")
    current = await db.scalar(select(NoteResearchRun).where(NoteResearchRun.id == run.id,
                               NoteResearchRun.user_id == user_id).with_for_update().execution_options(populate_existing=True))
    if not current or current.state not in {"complete"}:
        raise HTTPException(409, "The source note or evidence is no longer available.")
    new = Note(user_id=user_id, title=original.title, prompt=instruction, content=content,
               curriculum_tag=original.curriculum_tag, source_note_id=original.id,
               style=style, kind="derived", is_ai_generated=True)
    db.add(new)
    await db.flush()
    await deduct_generation_tokens(user_id, tokens, db)
    db.add(NoteResearchRun(id=str(uuid.uuid4()), user_id=user_id,
        fingerprint=hashlib.sha256((original.id+instruction).encode()).hexdigest(), root_id=run.root_id or original.id,
        note_id=new.id, state="complete", sources=sources,
        details={"outcome":(run.details or {}).get("outcome","limited"), "retrieval_mode":"saved_evidence",
                 "origin_run_id":run.id}))
    await db.commit()
    await db.refresh(new)
    return new
