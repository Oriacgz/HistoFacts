"""Authenticated, idempotent research and atomic note/wallet persistence."""
import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, update, delete
from sqlalchemy.exc import IntegrityError

from app.ai_notes.models import Note, NoteResearchRun
from app.ai_notes.schemas import NoteResponse
from app.ai_notes.wallet_service import deduct_generation_tokens
from app.auth.models import User
from app.core.config import settings
from app.core.database import streaming_session_scope
from .providers import ResearchUnavailable
from .service import research_answer

logger = logging.getLogger(__name__)


async def consume_research(response):
    result = None
    try:
        async for chunk in response.body_iterator:
            if chunk.startswith("data: {"):
                payload = json.loads(chunk[6:])
                if payload.get("error"):
                    raise HTTPException(502, payload["error"])
                if payload.get("note"):
                    result = NoteResponse.model_validate(payload["note"])
    finally:
        await response.body_iterator.aclose()
    if result is None:
        raise HTTPException(502, "Research ended before a note could be saved.")
    return result


async def require_active_owner(user_id, db):
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))
    if not user or user.is_banned or user.deletion_scheduled_at is not None:
        raise HTTPException(403, "This account is unavailable for research.")


async def serialize_notes(notes, user_id, db):
    if not notes:
        return []
    runs = (await db.execute(select(NoteResearchRun).where(
        NoteResearchRun.user_id == user_id,
        NoteResearchRun.note_id.in_([note.id for note in notes]),
        NoteResearchRun.state.in_(["complete", "excerpts_expired"]),
    ))).scalars().all()
    by_note = {run.note_id: {"run_id": run.id, "sources": run.sources, "state": run.state, **(run.details or {})} for run in runs}
    return [NoteResponse.model_validate(note).model_copy(update={"research": by_note.get(note.id)}) for note in notes]


async def prepare_research(req, user_id, db, root=None, parent=None):
    if not settings.tavily_api_key:
        raise HTTPException(503, "Web Research is unavailable until a search key is configured. Ordinary Notes is still available.")
    # Keep private attachments out of research generation as well as search.
    if req.attachment_name or req.attachment_text or req.attachment_data:
        raise HTTPException(422, "Remove the attachment to use Web Research. Uploaded documents are analyzed separately.")
    await require_active_owner(user_id, db)
    await db.execute(update(NoteResearchRun).where(NoteResearchRun.user_id == user_id,
                     NoteResearchRun.state == "running",
                     NoteResearchRun.created_at < datetime.now(timezone.utc) - timedelta(minutes=4)).values(state="failed"))
    request_id = str(req.research_request_id or uuid.uuid4())
    question = getattr(req, "topic", None) or req.message
    fingerprint = hashlib.sha256(json.dumps([question, root.id if root else None, bool(req.think), req.research_depth], ensure_ascii=False).encode()).hexdigest()
    existing = await db.get(NoteResearchRun, request_id)
    if existing:
        if existing.user_id != user_id or existing.fingerprint != fingerprint:
            raise HTTPException(409, "This research request cannot be reused.")
        if existing.state in {"complete", "excerpts_expired"}:
            note = await db.scalar(select(Note).where(Note.id == existing.note_id, Note.user_id == user_id))
            if note:
                return request_id, note
        raise HTTPException(409, "This research request is already running or has ended. Start a new request to retry.")
    recent = await db.scalar(select(func.count()).select_from(NoteResearchRun).where(
        NoteResearchRun.user_id == user_id,
        NoteResearchRun.created_at > datetime.now(timezone.utc) - timedelta(minutes=1)))
    if recent >= 5:
        raise HTTPException(429, "Please wait before starting another web research request.")
    active = await db.scalar(select(func.count()).select_from(NoteResearchRun).where(
        NoteResearchRun.user_id == user_id, NoteResearchRun.state == "running",
        NoteResearchRun.created_at > datetime.now(timezone.utc) - timedelta(minutes=4)))
    if active:
        raise HTTPException(409, "A research request is already running for this account.")
    db.add(NoteResearchRun(id=request_id, user_id=user_id, fingerprint=fingerprint,
                           root_id=root.id if root else None, state="running", sources=[]))
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(409, "A research request has already started. Please wait before retrying.") from error
    return request_id, None


def research_stream(req, user_id, request_id, existing=None, root=None, parent=None, context_topics=None, context_status=None):
    question = getattr(req, "topic", None) or req.message
    def event(payload):
        return "data: " + json.dumps(payload) + "\n\n"

    async def stream():
        if existing:
            async with streaming_session_scope() as db:
                response = (await serialize_notes([existing], user_id, db))[0]
            yield event({"note": response.model_dump(mode="json")})
            yield "data: [DONE]\n\n"
            return
        queue = asyncio.Queue(maxsize=24)
        usage = {}
        async def progress(value):
            if "usage" in value:
                usage.update(value["usage"])
                return
            await queue.put({"research": {**value, "run_id": request_id}})
        task = asyncio.create_task(research_answer(question, root_topic=root.prompt if root else None,
                                                 think=bool(req.think), progress=progress, depth=req.research_depth, context_topics=context_topics))
        task.add_done_callback(lambda _: queue.put_nowait({"research": {"stage": "checking", "run_id": request_id}}))
        saved = False
        try:
            yield event({"research": {"stage": "started", "run_id": request_id}})
            while not task.done():
                try:
                    update = await asyncio.wait_for(queue.get(), timeout=5)
                    yield event(update)
                except TimeoutError:
                    yield ": research heartbeat\n\n"
            while not queue.empty():
                yield event(queue.get_nowait())
            content, sources, tokens = await task
            # Validation and retries are internally metered, not extra wallet charges.
            async with streaming_session_scope() as db:
                await require_active_owner(user_id, db)
                if context_status:
                    from app.ai_notes.context.service import assert_generation
                    await assert_generation(user_id,context_status,db)
                run = await db.scalar(select(NoteResearchRun).where(NoteResearchRun.id == request_id,
                                        NoteResearchRun.user_id == user_id).with_for_update())
                if not run or run.state != "running":
                    raise ResearchUnavailable("This research request is no longer available.")
                if root:
                    owned_root = await db.scalar(select(Note.id).where(Note.id == root.id, Note.user_id == user_id))
                    if not owned_root:
                        raise ResearchUnavailable("This conversation was removed during research.")
                note = Note(user_id=user_id, title=f"Notes: {question[:60]}", prompt=question,
                            content=content, curriculum_tag=root.curriculum_tag if root else req.curriculum,
                            source_note_id=parent.id if parent else None, style="standard", is_ai_generated=True)
                db.add(note)
                await db.flush()
                balance = await deduct_generation_tokens(user_id, tokens, db)
                run.state, run.note_id, run.sources = "complete", note.id, sources
                limited = len(sources) < 2 or any(s.get("limitations", {}).get("failed_sources", 0) for s in sources)
                disagreement = any(s.get("support_check", {}).get("disagreement", False) for s in sources)
                run.details = {"outcome": "disagreement" if disagreement else "limited" if limited else "researched", "usage": usage}
                await db.commit()
                await db.refresh(note)
                response = NoteResponse.model_validate(note).model_copy(update={"research": {
                    "run_id": request_id, "sources": sources, "state": "complete", **run.details}})
                saved = True
            # Never emit an answer or saved ID until both answer and evidence commit.
            yield event({"delta": content})
            yield event({"note": response.model_dump(mode="json"), "token_balance": balance, "tokens_used": tokens})
            from app.core.inter_service import notify
            await notify(user_id=user_id,type="note_ready",payload={"note_id":response.id,"title":response.title,"style":"standard"})
            yield event({"research": {"stage": "complete", "run_id": request_id}})
        except (ResearchUnavailable, TimeoutError) as error:
            yield event({"error": str(error) or "Research exceeded its time limit. Please retry.", "research_failed": True})
        except Exception:
            logger.exception("Research request failed: %s", request_id)
            yield event({"error": "Research could not be saved. No researched answer was completed. Please retry.", "research_failed": True})
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            if not saved:
                try:
                    async with streaming_session_scope() as db:
                        run = await db.scalar(select(NoteResearchRun).where(NoteResearchRun.id == request_id, NoteResearchRun.user_id == user_id))
                        if run and run.state in {"running","cancelled"}:
                            if run.state == "running":
                                run.state = "failed"
                            run.details = {"usage": usage, "outcome": run.state}
                            await db.commit()
                except Exception:
                    logger.exception("Could not mark research run failed: %s", request_id)
        yield "data: [DONE]\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
