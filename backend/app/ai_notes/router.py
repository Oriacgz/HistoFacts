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
from app.ai_notes.schemas import (
    GenerateNoteRequest,
    NoteResponse,
    ReviseNoteRequest,
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
    REFUSAL_MESSAGE,
    SYSTEM_PROMPT,
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
from app.core.database import get_async_session
from app.core.deps import get_current_user, CurrentUser
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["AI Notes & Token Economy"])


# ── AI Notes Generation & Management ─────────────────────────────

@router.post("/api/notes/generate", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def generate_note(
    request: Request,
    req: GenerateNoteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
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
    # 0. Pre-classification guard
    if not await is_history_related(req.topic):
        async def refusal_stream():
            yield f"data: {json.dumps({'delta': REFUSAL_MESSAGE})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(refusal_stream(), media_type="text/event-stream")

    # 1. Pre-flight token estimation check
    prompt_tokens = calculate_approx_tokens(req.topic) + calculate_approx_tokens(req.attachment_text or "")
    estimated_tokens = prompt_tokens + 1200
    await preflight_token_check(current_user.id, estimated_tokens, db)

    # 2. Build initial prompt instructions
    clean_topic_title = req.topic.strip().replace("\n", " ")
    if len(clean_topic_title) > 60:
        clean_topic_title = f"{clean_topic_title[:57]}..."
    elif not clean_topic_title and req.attachment_name:
        clean_topic_title = f"Document Analysis: {req.attachment_name}"
    elif not clean_topic_title:
        clean_topic_title = "Historical Study Notes"

    title = f"Study Notes: {clean_topic_title} ({req.curriculum})"

    attachment_instructions = ""
    if req.attachment_name:
        attachment_instructions += f"\n\nAttached Source File: '{req.attachment_name}' (Type: {req.attachment_type or 'document'})."
    if req.attachment_text:
        snippet = req.attachment_text[:12000]
        attachment_instructions += (
            f"\n\n--- SOURCE MATERIAL CONTENT ---\n{snippet}\n--- END SOURCE MATERIAL ---\n\n"
            "Carefully analyze, extract, and incorporate the primary facts, concepts, arguments, "
            "timelines, and figures from this attached source into the structured curriculum study notes."
        )

    user_prompt = (
        f"Generate a comprehensive, high-yield structured study note for the historical topic/inquiry: '{req.topic}'.\n"
        f"Target Curriculum / Syllabus: '{req.curriculum}'.{attachment_instructions}\n\n"
        f"Format the output in clean, readable Markdown with clear headings and bullet points:\n"
        f"- 📌 Key Takeaways & Core Concepts\n"
        f"- 🏛️ Historical Context & Background\n"
        f"- 📜 Chronological Timeline & Major Events\n"
        f"- 🔍 Source & Document Analysis (if source attached)\n"
        f"- 🎯 Examination & Curriculum Relevance (High-yield points, keywords, essay pointers)\n"
        f"- ❓ Self-Assessment & Exam Practice Questions"
    )

    user_content: str | list = user_prompt
    if req.attachment_data and req.attachment_data.startswith("data:image/"):
        user_content = [
            {"type": "text", "text": user_prompt},
            {"type": "image_url", "image_url": {"url": req.attachment_data, "detail": "auto"}},
        ]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    async def event_stream():
        full_response = ""
        async for delta in stream_and_filter_thinking(stream_chat(messages)):
            full_response += delta
            yield f"data: {json.dumps({'delta': delta})}\n\n"

        final = scrub_identity_leak(full_response)
        actual_tokens = calculate_approx_tokens(str(messages)) + calculate_approx_tokens(final)
        await deduct_generation_tokens(current_user.id, actual_tokens, db)

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
        db.add(note)
        await db.commit()
        await db.refresh(note)

        yield f"data: {json.dumps({'note': NoteResponse.model_validate(note).model_dump(mode='json')})}\n\n"
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
    chain = await get_note_thread_for_user(note_id, current_user.id, db)
    root = chain[0]

    # Guardrail check with thread context
    if not await is_history_related(req.message, thread_topic=root.title):
        async def refusal_stream():
            yield f"data: {json.dumps({'delta': REFUSAL_MESSAGE})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(refusal_stream(), media_type="text/event-stream")

    # Preflight check
    estimated_tokens = calculate_approx_tokens(req.message) + 1200
    await preflight_token_check(current_user.id, estimated_tokens, db)

    # Build conversation messages
    user_turn_content = req.message
    if req.attachment_name:
        user_turn_content += f"\n\n[Attached File: {req.attachment_name}]"
    if req.attachment_text:
        user_turn_content += f"\n\n--- ATTACHED CONTENT ---\n{req.attachment_text[:8000]}\n--- END ---"

    history = build_conversation_messages(chain)
    messages = history + [{"role": "user", "content": user_turn_content}]

    async def event_stream():
        full_response = ""
        async for delta in stream_and_filter_thinking(stream_chat(messages)):
            full_response += delta
            yield f"data: {json.dumps({'delta': delta})}\n\n"

        final = scrub_identity_leak(full_response)
        actual_tokens = calculate_approx_tokens(str(messages)) + calculate_approx_tokens(final)
        await deduct_generation_tokens(current_user.id, actual_tokens, db)

        new_turn = await save_conversation_turn(
            root_note_id=root.id,
            user_id=current_user.id,
            prompt=req.message,
            content=final,
            db=db,
            style="standard",
        )
        yield f"data: {json.dumps({'note': NoteResponse.model_validate(new_turn).model_dump(mode='json')})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


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
    return [NoteResponse.model_validate(n) for n in chain]


@router.post("/api/notes/{note_id}/handwritten", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def restyle_handwritten_note(
    note_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Restyle an existing note into student handwritten lecture style."""
    note = await create_handwritten_note_for_user(note_id, current_user.id, db)
    return NoteResponse.model_validate(note)


@router.post("/api/notes/{note_id}/revise", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def revise_note(
    note_id: str,
    req: ReviseNoteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Create an AI-revised version of a note from a plain-language instruction.
    The original note is never modified — the revision is a new linked note.
    Off-topic instructions are rejected before any generation call (0 tokens charged).
    """
    note = await revise_note_for_user(note_id, req, current_user.id, db)
    return NoteResponse.model_validate(note)


@router.get("/api/notes", response_model=list[NoteResponse])
@router.get("/api/notes/me", response_model=list[NoteResponse], include_in_schema=False)
async def list_notes(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    notes = await get_user_notes(current_user.id, db)
    return [NoteResponse.model_validate(n) for n in notes]


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_200_OK)
async def delete_note(
    note_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    deleted = await delete_user_note(note_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
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
    token_wallet = await db.get(UserTokenWallet, user_id)
    histoin_wallet = await db.get(HistoinWallet, user_id)
    return {
        "notes": [
            {"id": n.id, "title": n.title, "content": n.content, "created_at": str(n.created_at)}
            for n in notes_res.scalars().all()
        ],
        "token_balance": token_wallet.token_balance if token_wallet else 0,
        "histoin_balance": histoin_wallet.balance if histoin_wallet else 0,
    }
