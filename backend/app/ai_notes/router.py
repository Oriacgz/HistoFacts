"""
FastAPI router for AI Notes, Token Wallet, Shop, and Handwritten Notes endpoints.
"""

import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.models import Note
from app.ai_notes.models import NoteResearchRun
from app.ai_notes.research.lifecycle import prepare_research, research_stream, serialize_notes, require_active_owner, consume_research
from app.core.request_lifetime import until_disconnect
from app.ai_notes.schemas import (
    GenerateNoteRequest,
    NoteResponse,
    ReviseNoteRequest,
    RestyleNoteRequest,
    ContinueConversationRequest,
    WalletResponse,
    TokenPackResponse,
    PurchaseResponse,
    ShareNoteRequest,
    ShareNoteResponse,
)
from app.ai_notes.service import (
    create_note_for_user,
    create_handwritten_note_for_user,
    revise_note_for_user,
    get_user_notes,
    get_note_thread_for_user,
    build_conversation_messages,
    save_conversation_turn,
    share_note_to_conversations,
    delete_user_note,
)
from app.ai_notes.llm_client import (
    stream_and_filter_thinking,
    stream_chat,
    is_history_related,
    scrub_identity_leak,
    calculate_approx_tokens,
    build_prompt_payload,
    detect_task_intent,
    REFUSAL_MESSAGE,
    SYSTEM_PROMPT,
    SERVICE_UNAVAILABLE_MESSAGE,
)
from app.ai_notes.wallet_service import (
    get_or_create_wallets,
    get_shop_packs,
    purchase_token_pack,
    preflight_token_check,
    deduct_generation_tokens,
    FREE_REFILL_CAP,
    DAILY_REFRESH,
    PURCHASED_CEILING,
)
from app.core.database import get_async_session, streaming_session_scope
from app.core.deps import get_current_user, CurrentUser
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["AI Notes & Token Economy"])
from app.ai_notes.context.router import router as memory_router, export_memories
router.include_router(memory_router)


@router.get("/api/notes/research/status")
async def research_status(current_user: CurrentUser = Depends(get_current_user)):
    from app.core.config import settings
    return {"available": bool(settings.tavily_api_key), "provider": "Tavily",
            "disclosure": "Search terms are sent to Tavily. Attachments and full conversations are not sent."}


@router.get("/api/notes/research/runs/{run_id}")
async def research_run_status(run_id: str, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    run = await db.scalar(select(NoteResearchRun).where(NoteResearchRun.id == run_id, NoteResearchRun.user_id == current_user.id))
    if not run:
        raise HTTPException(404, "Research request not found")
    note = await db.scalar(select(Note).where(Note.id == run.note_id, Note.user_id == current_user.id)) if run.note_id else None
    saved = (await serialize_notes([note], current_user.id, db))[0].model_dump(mode="json") if note else None
    return {"run_id": run.id, "state": run.state, "note_id": run.note_id, "note": saved, "sources": run.sources, **(run.details or {})}


@router.post("/api/notes/research/runs/{run_id}/cancel")
async def cancel_research_run(run_id: str, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    run = await db.scalar(select(NoteResearchRun).where(NoteResearchRun.id == run_id, NoteResearchRun.user_id == current_user.id).with_for_update())
    if not run:
        raise HTTPException(404, "Research request not found")
    if run.state == "running":
        run.state = "cancelled"
        await db.commit()
    return {"run_id": run.id, "state": run.state, "note_id": run.note_id}


def require_attachment_mode(req):
    if not req.think and (req.attachment_data or '').startswith('data:image/'):
        raise HTTPException(422, 'Enable Think mode to analyze an image attachment. Standard mode supports text and extracted documents.')


# ── AI Notes Generation & Management ─────────────────────────────

@router.post("/api/notes/generate", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def generate_note(
    request: Request,
    req: GenerateNoteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    require_attachment_mode(req)
    if req.research_mode == "web":
        await require_active_owner(current_user.id, db)
        if not await is_history_related(req.topic):
            raise HTTPException(422, REFUSAL_MESSAGE)
        await preflight_token_check(current_user.id, 2000, db)
        run_id, existing = await prepare_research(req, current_user.id, db)
        response = research_stream(req, current_user.id, run_id, existing)
        return await until_disconnect(request, consume_research(response))
    note = await create_note_for_user(req, current_user.id, db)
    return NoteResponse.model_validate(note)


@router.post("/api/notes/generate/stream")
@limiter.limit("10/minute")
async def generate_note_stream(
    request: Request,
    req: GenerateNoteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Stream note generation via SSE token-by-token.
    Enforces pre-classification guardrail, filters <think> traces,
    scrubs identity leaks, and saves the resulting note to database.
    """
    require_attachment_mode(req)
    # 0. Pre-classification guard
    if not await is_history_related(req.topic):
        async def refusal_stream():
            yield f"data: {json.dumps({'delta': REFUSAL_MESSAGE})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(refusal_stream(), media_type="text/event-stream")

    # 1. Pre-flight token estimation check
    if req.research_mode == "web":
        await require_active_owner(current_user.id, db)
    prompt_tokens = calculate_approx_tokens(req.topic) + calculate_approx_tokens(req.attachment_text or "")
    estimated_tokens = prompt_tokens + 1200
    await preflight_token_check(current_user.id, estimated_tokens, db)

    if req.research_mode == "web":
        run_id, existing = await prepare_research(req, current_user.id, db)
        return research_stream(req, current_user.id, run_id, existing)

    # 2. Build minimal low-latency prompt payload
    clean_topic_title = req.topic.strip().replace("\n", " ")
    if len(clean_topic_title) > 60:
        clean_topic_title = f"{clean_topic_title[:57]}..."
    elif not clean_topic_title and req.attachment_name:
        clean_topic_title = f"Document Analysis: {req.attachment_name}"
    elif not clean_topic_title:
        clean_topic_title = "Historical Notes"

    title = f"Notes: {clean_topic_title}"

    user_content, _ = build_prompt_payload(
        user_text=req.topic,
        attachment_name=req.attachment_name,
        attachment_type=req.attachment_type,
        attachment_text=req.attachment_text,
        attachment_data=req.attachment_data,
        curriculum=req.curriculum,
        think=bool(req.think),
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    from app.ai_notes.context.budget import enforce
    context_status = enforce(messages)

    async def event_stream():
        full_response = ""
        try:
            async for delta in stream_and_filter_thinking(stream_chat(messages, think=bool(req.think))):
                full_response += delta
                yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as e:
            if not full_response:
                full_response = "I encountered an issue generating this study note. Please try again."
                yield f"data: {json.dumps({'delta': full_response})}\n\n"

        final = scrub_identity_leak(full_response)
        if not final.strip() or SERVICE_UNAVAILABLE_MESSAGE in final:
            yield f"data: {json.dumps({'error':'The local model is unavailable. Your draft can be retried; no answer was saved or charged.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        actual_tokens = calculate_approx_tokens(str(messages)) + calculate_approx_tokens(final)

        try:
            async with streaming_session_scope() as stream_db:
                actual_balance = await deduct_generation_tokens(current_user.id, actual_tokens, stream_db)
                note = Note(
                    user_id=current_user.id,
                    event_id=req.event_id,
                    title=title,
                    prompt=req.topic,
                    content=final,
                    curriculum_tag=req.curriculum,
                    style=req.style or "standard",
                    attachment_name=req.attachment_name,
                    attachment_type=req.attachment_type,
                    is_ai_generated=True,
                )
                stream_db.add(note)
                await stream_db.commit()
                await stream_db.refresh(note)

                yield f"data: {json.dumps({'note': NoteResponse.model_validate(note).model_dump(mode='json'), 'token_balance': actual_balance, 'tokens_used': actual_tokens})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error':'This answer was not saved or charged. Please retry after checking the session.'})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/notes/{note_id}/continue/stream")
async def continue_conversation_stream(
    note_id: str,
    req: ContinueConversationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Continue a multi-turn conversation on an active note thread.
    Passes full prior conversation chain as context for coherent reasoning.
    Runs topic guardrails using the session topic as context.
    Streams token-by-token, filters thinking traces, scrubs identity leaks,
    and appends a new turn to the version chain.
    """
    require_attachment_mode(req)
    chain = await get_note_thread_for_user(note_id, current_user.id, db)
    root = chain[0]

    # Guardrail check with thread context
    if not await is_history_related(req.message, thread_topic=root.title):
        async def refusal_stream():
            yield f"data: {json.dumps({'delta': REFUSAL_MESSAGE})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(refusal_stream(), media_type="text/event-stream")

    # Preflight check
    if req.research_mode == "web":
        await require_active_owner(current_user.id, db)
    estimated_tokens = calculate_approx_tokens(req.message) + 1200
    await preflight_token_check(current_user.id, estimated_tokens, db)

    if req.research_mode == "web":
        from app.ai_notes.context.service import assemble, managed_response, release_generation
        context_messages, context_status = await assemble(root.id,current_user.id,db,SYSTEM_PROMPT,req.message)
        try:
            run_id, existing = await prepare_research(req, current_user.id, db, root=root, parent=chain[-1])
        except BaseException:
            await db.rollback()
            await release_generation(current_user.id,context_status,db)
            raise
        context_topics=[str(message['content']) for message in context_messages[1:-1]]
        response=research_stream(req,current_user.id,run_id,existing,root=root,parent=chain[-1],
            context_topics=context_topics,context_status=context_status)
        return managed_response(response,current_user.id,context_status)

    # The shared context assembler owns history and its budget.

    # Detect if user follow-up has task instruction
    has_attachment = bool(req.attachment_text or req.attachment_name or req.attachment_data)
    _, task_instruction = detect_task_intent(
        req.message,
        has_attachment=has_attachment,
        curriculum=root.curriculum_tag,
    )

    user_turn_parts = []
    if req.attachment_name:
        user_turn_parts.append(f"[Attached File: '{req.attachment_name}']")
    if req.attachment_text:
        user_turn_parts.append(f"--- SOURCE EXCERPT ---\n{req.attachment_text.strip()[:3000]}\n--- END ---")
    user_turn_parts.append(req.message.strip())
    if task_instruction:
        user_turn_parts.append(f"[Instruction: {task_instruction}]")

    user_turn_content = "\n\n".join(user_turn_parts)
    from app.ai_notes.context.service import assemble
    messages, context_status = await assemble(root.id, current_user.id, db, SYSTEM_PROMPT, user_turn_content)

    async def event_stream():
        full_response = ""
        try:
            async for delta in stream_and_filter_thinking(stream_chat(messages, think=bool(req.think))):
                full_response += delta
                yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception:
            if not full_response:
                full_response = "I encountered an error continuing this note thread. Please try again."
                yield f"data: {json.dumps({'delta': full_response})}\n\n"

        final = scrub_identity_leak(full_response)
        if not final.strip() or SERVICE_UNAVAILABLE_MESSAGE in final:
            yield f"data: {json.dumps({'error':'The local model is unavailable. Your draft can be retried; no answer was saved or charged.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        actual_tokens = calculate_approx_tokens(str(messages)) + calculate_approx_tokens(final)

        try:
            async with streaming_session_scope() as stream_db:
                from app.ai_notes.context.service import assert_generation
                await assert_generation(current_user.id, context_status, stream_db)
                actual_balance = await deduct_generation_tokens(current_user.id, actual_tokens, stream_db)
                new_turn = await save_conversation_turn(
                    root_note_id=root.id,
                    user_id=current_user.id,
                    prompt=req.message,
                    content=final,
                    db=stream_db,
                    style="standard",
                )
                yield f"data: {json.dumps({'note': NoteResponse.model_validate(new_turn).model_dump(mode='json'), 'token_balance': actual_balance, 'tokens_used': actual_tokens})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error':'This answer was not saved or charged. Check the session before retrying.'})}\n\n"

        yield "data: [DONE]\n\n"

    from app.ai_notes.context.service import managed_response
    return managed_response(StreamingResponse(event_stream(),media_type="text/event-stream"),current_user.id,context_status)


@router.get("/api/notes/{note_id}/thread", response_model=list[NoteResponse])
async def get_note_thread(
    note_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Load the full conversation thread for a session in chronological order.
    Every turn contains prompt (user request) and content (AI note).
    """
    chain = await get_note_thread_for_user(note_id, current_user.id, db)
    return await serialize_notes(chain, current_user.id, db)


@router.get("/api/notes/{note_id}/shared")
async def read_shared_note(note_id: str, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    from app.chat.models import Message
    from app.chat.service import _is_participant
    note = await db.get(Note,note_id)
    if not note:
        raise HTTPException(404,"Shared note is unavailable")
    owner = note.user_id == current_user.id
    if not owner:
        conversations = (await db.execute(select(Message.conversation_id).where(
            Message.shared_ref_id == note_id, Message.message_type == 'note_share',
            Message.sender_id == note.user_id))).scalars().all()
        allowed = False
        for conversation in set(conversations):
            if await _is_participant(conversation,current_user.id,db):
                allowed = True
                break
        if not allowed:
            raise HTTPException(404,"Shared note is unavailable")
    response = (await serialize_notes([note],note.user_id,db))[0]
    public_research = None
    if response.research:
        public_fields = {'id','url','title','author','institution','published_at','updated_at','retrieved_at','fixture','excerpts_expired'}
        public_research = {'run_id':f'shared-{note.id}','outcome':response.research.get('outcome'),
            'sources':[{key:value for key,value in source.items() if key in public_fields} for source in response.research['sources']]}
    return {'id':note.id,'title':note.title,'content':note.content,'style':note.style,
            'created_at':note.created_at,'research':public_research,'shared_read_only':not owner}


@router.post("/api/notes/{note_id}/handwritten", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def restyle_handwritten_note(
    note_id: str,
    request: Request,
    req: RestyleNoteRequest | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Restyle an existing note into student handwritten lecture style."""
    note = await until_disconnect(request, create_handwritten_note_for_user(note_id, current_user.id, db, think=bool(req and req.think)))
    return (await serialize_notes([note],current_user.id,db))[0]


@router.post("/api/notes/{note_id}/revise", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def revise_note(
    note_id: str,
    req: ReviseNoteRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Create an AI-revised version of a note from a plain-language instruction.
    The original note is never modified — the revision is a new linked note.
    Off-topic instructions are rejected before any generation call (0 tokens charged).
    """
    note = await until_disconnect(request, revise_note_for_user(note_id, req, current_user.id, db))
    return (await serialize_notes([note],current_user.id,db))[0]


@router.get("/api/notes", response_model=list[NoteResponse])
@router.get("/api/notes/me", response_model=list[NoteResponse], include_in_schema=False)
async def list_notes(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    notes = await get_user_notes(current_user.id, db)
    return await serialize_notes(notes, current_user.id, db)


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_200_OK)
async def delete_note(
    note_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    deleted = await delete_user_note(note_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.commit()
    return {"status": "deleted", "note_id": note_id}


@router.post("/api/notes/{note_id}/share", response_model=ShareNoteResponse, status_code=status.HTTP_200_OK)
async def share_note(
    note_id: str,
    payload: ShareNoteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Fan-out a note as a note_share chat message to one or more conversations."""
    count = await share_note_to_conversations(note_id, payload.conversation_ids, current_user.id, db)
    return ShareNoteResponse(shared_to=count)


# ── Token & Histoin Wallet Endpoints ──────────────────────────────

@router.get("/api/wallet/me", response_model=WalletResponse)
async def get_my_wallet(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get the current user's token balance, Histoin balance, and next refresh info.
    Evaluates lazy daily refresh automatically.
    """
    token_wallet, histoin_wallet = await get_or_create_wallets(current_user.id, db)

    now = datetime.now(timezone.utc)
    next_refresh = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    return WalletResponse(
        token_balance=token_wallet.token_balance,
        histoin_balance=histoin_wallet.balance,
        next_refresh_at=next_refresh,
        daily_refresh_amount=DAILY_REFRESH,
        free_refill_cap=FREE_REFILL_CAP,
        purchased_ceiling=PURCHASED_CEILING,
    )


# ── Shop Endpoints ────────────────────────────────────────────────

@router.get("/api/shop/packs", response_model=list[TokenPackResponse])
async def list_shop_packs(
    db: AsyncSession = Depends(get_async_session),
):
    """List all available token packs in the shop."""
    packs = await get_shop_packs(db)
    return [TokenPackResponse.model_validate(p) for p in packs]


@router.post("/api/shop/purchase/{pack_id}", response_model=PurchaseResponse)
async def purchase_pack(
    pack_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Purchase a token pack using Histoins virtual currency.
    Performs atomic exchange with row-level locks and idempotency protection.
    """
    result = await purchase_token_pack(current_user.id, pack_id, db, idempotency_key=idempotency_key)
    return PurchaseResponse(**result)


# ── Internal Inter-Service Endpoints ─────────────────────────────

class InternalWalletInitRequest(BaseModel):
    user_id: str


class InternalQuizRewardRequest(BaseModel):
    user_id: str
    amount: int = 20


from app.core.deps import verify_internal_service_secret


@router.post("/api/wallet/internal/init", status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def internal_init_wallet(
    req: InternalWalletInitRequest,
    _auth: bool = Depends(verify_internal_service_secret),
    db: AsyncSession = Depends(get_async_session),
):
    await get_or_create_wallets(req.user_id, db)
    return {"status": "initialized", "user_id": req.user_id}


@router.post("/api/wallet/internal/reward-quiz", status_code=status.HTTP_200_OK, include_in_schema=False)
async def internal_reward_quiz(
    req: InternalQuizRewardRequest,
    _auth: bool = Depends(verify_internal_service_secret),
    db: AsyncSession = Depends(get_async_session),
):
    from app.ai_notes.wallet_service import reward_quiz_histoins
    rewarded = await reward_quiz_histoins(req.user_id, db)
    return {"status": "rewarded" if rewarded else "cap_reached", "user_id": req.user_id}


@router.post(
    "/internal/users/{user_id}/purge",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_service_secret)],
)
async def purge_user_ai_notes(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    from app.ai_notes.models import Note, UserTokenWallet, HistoinWallet, TokenLedger, HistoinLedger, PurchaseLog
    from app.ai_notes.models import NoteSessionMemory
    await db.execute(delete(NoteSessionMemory).where(NoteSessionMemory.user_id == user_id))
    await db.execute(delete(NoteResearchRun).where(NoteResearchRun.user_id == user_id))
    await db.execute(delete(Note).where(Note.user_id == user_id))
    await db.execute(delete(UserTokenWallet).where(UserTokenWallet.user_id == user_id))
    await db.execute(delete(HistoinWallet).where(HistoinWallet.user_id == user_id))
    await db.execute(delete(TokenLedger).where(TokenLedger.user_id == user_id))
    await db.execute(delete(HistoinLedger).where(HistoinLedger.user_id == user_id))
    await db.execute(delete(PurchaseLog).where(PurchaseLog.user_id == user_id))
    await db.commit()
    return {"status": "purged", "service": "ai_notes"}


@router.get(
    "/internal/users/{user_id}/export",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def export_user_ai_notes(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    from app.ai_notes.models import Note, UserTokenWallet, HistoinWallet
    notes_res = await db.execute(select(Note).where(Note.user_id == user_id))
    exported_notes = await serialize_notes(notes_res.scalars().all(), user_id, db)
    token_wallet = await db.get(UserTokenWallet, user_id)
    histoin_wallet = await db.get(HistoinWallet, user_id)
    return {
        "notes": [
            {"id": n.id, "title": n.title, "content": n.content, "created_at": str(n.created_at), "research": n.research}
            for n in exported_notes
        ],
        "session_memories": await export_memories(user_id, db),
        "token_balance": token_wallet.token_balance if token_wallet else 0,
        "histoin_balance": histoin_wallet.balance if histoin_wallet else 0,
    }
