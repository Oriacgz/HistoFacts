"""
FastAPI router for AI Notes, Token Wallet, Shop, and Handwritten Notes endpoints.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.schemas import (
    GenerateNoteRequest,
    NoteResponse,
    UpdateNoteRequest,
    WalletResponse,
    TokenPackResponse,
    PurchaseResponse,
)
from app.ai_notes.service import (
    create_note_for_user,
    create_handwritten_note_for_user,
    get_user_notes,
    update_note,
    share_note_to_group,
    delete_user_note,
)
from app.ai_notes.wallet_service import (
    get_or_create_wallets,
    get_shop_packs,
    purchase_token_pack,
    FREE_REFILL_CAP,
    DAILY_REFRESH,
    PURCHASED_CEILING,
)
from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.auth.models import User

router = APIRouter(tags=["AI Notes & Token Economy"])


# ── AI Notes Generation & Management ─────────────────────────────

@router.post("/api/notes/generate", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def generate_note(
    req: GenerateNoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    note = await create_note_for_user(req, current_user.id, db)
    return NoteResponse.model_validate(note)


@router.post("/api/notes/{note_id}/handwritten", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def restyle_handwritten_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Restyle an existing note into student handwritten lecture style."""
    note = await create_handwritten_note_for_user(note_id, current_user.id, db)
    return NoteResponse.model_validate(note)


@router.get("/api/notes", response_model=list[NoteResponse])
@router.get("/api/notes/me", response_model=list[NoteResponse], include_in_schema=False)
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    notes = await get_user_notes(current_user.id, db)
    return [NoteResponse.model_validate(n) for n in notes]


@router.put("/api/notes/{note_id}", response_model=NoteResponse)
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


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_200_OK)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    deleted = await delete_user_note(note_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "deleted", "note_id": note_id}


@router.post("/api/notes/{note_id}/share/{group_id}", status_code=status.HTTP_200_OK)
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


# ── Token & Histoin Wallet Endpoints ──────────────────────────────

@router.get("/api/wallet/me", response_model=WalletResponse)
async def get_my_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get the current user's token balance, Histoin balance, and next refresh info.
    Evaluates lazy daily refresh automatically.
    """
    token_wallet, histoin_wallet = await get_or_create_wallets(current_user.id, db)

    # Next refresh is tomorrow 00:00 UTC
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Purchase a token pack using Histoins virtual currency.
    Performs atomic exchange with row-level locks.
    """
    result = await purchase_token_pack(current_user.id, pack_id, db)
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

