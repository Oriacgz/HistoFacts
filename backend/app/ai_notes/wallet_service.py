"""
Wallet and Token Economy Service:
- Manages UserTokenWallet, TokenLedger, HistoinWallet, HistoinLedger, and TokenPack.
- Lazy evaluation for daily token refresh (up to 350K cap, 50K/day back-filling missed days).
- Pre-flight estimation and atomic row-locked deduction.
- Atomic shop purchases respecting PURCHASED_CEILING.
"""

from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_notes.models import (
    UserTokenWallet,
    TokenLedger,
    HistoinWallet,
    HistoinLedger,
    TokenPack,
    PurchaseLog,
)

FREE_REFILL_CAP = 350_000
DAILY_REFRESH = 50_000
PURCHASED_CEILING = 1_000_000
SIGNUP_TOKENS = 350_000

INITIAL_TOKEN_PACKS = [
    {"name": "Starter Pack", "token_amount": 50_000, "histoin_cost": 100},
    {"name": "Popular Pack", "token_amount": 150_000, "histoin_cost": 250},
    {"name": "Mega Pack", "token_amount": 350_000, "histoin_cost": 500},
]


async def seed_token_packs(db: AsyncSession):
    """Seed initial token packs in the shop if not present."""
    res = await db.execute(select(TokenPack).limit(1))
    if res.scalar_one_or_none():
        return

    for p in INITIAL_TOKEN_PACKS:
        pack = TokenPack(
            name=p["name"],
            token_amount=p["token_amount"],
            histoin_cost=p["histoin_cost"],
            is_active=True,
        )
        db.add(pack)
    await db.commit()


async def get_or_create_wallets(user_id: str, db: AsyncSession) -> tuple[UserTokenWallet, HistoinWallet]:
    """
    Fetch user's token and histoin wallets with row-level locks.
    Applies lazy daily refresh and daily login histoin reward.
    """
    now = datetime.now(timezone.utc)

    # 1. Token Wallet
    res = await db.execute(
        select(UserTokenWallet).where(UserTokenWallet.user_id == user_id).with_for_update()
    )
    token_wallet = res.scalar_one_or_none()

    if not token_wallet:
        token_wallet = UserTokenWallet(
            user_id=user_id,
            token_balance=SIGNUP_TOKENS,
            last_refresh_at=now,
        )
        db.add(token_wallet)
        await db.flush()

        ledger = TokenLedger(
            user_id=user_id,
            delta=SIGNUP_TOKENS,
            reason="signup_bonus",
            balance_after=SIGNUP_TOKENS,
            created_at=now,
        )
        db.add(ledger)
        await db.flush()
    else:
        # Lazy daily refresh calculation
        last_refresh = token_wallet.last_refresh_at
        if last_refresh.tzinfo is None:
            last_refresh = last_refresh.replace(tzinfo=timezone.utc)

        elapsed_days = (now - last_refresh).days
        if elapsed_days >= 1:
            if token_wallet.token_balance < FREE_REFILL_CAP:
                max_refill = FREE_REFILL_CAP - token_wallet.token_balance
                credit = min(DAILY_REFRESH * elapsed_days, max_refill)
                credit = max(credit, 0)
                if credit > 0:
                    token_wallet.token_balance += credit
                    ledger = TokenLedger(
                        user_id=user_id,
                        delta=credit,
                        reason="daily_refresh",
                        balance_after=token_wallet.token_balance,
                        created_at=now,
                    )
                    db.add(ledger)
            token_wallet.last_refresh_at = now
            await db.flush()

    # 2. Histoin Wallet
    res_h = await db.execute(
        select(HistoinWallet).where(HistoinWallet.user_id == user_id).with_for_update()
    )
    histoin_wallet = res_h.scalar_one_or_none()

    if not histoin_wallet:
        histoin_wallet = HistoinWallet(
            user_id=user_id,
            balance=0,
        )
        db.add(histoin_wallet)
        await db.flush()

    # 3. Daily Login Reward (+10 Histoins for first action of the day)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    res_login = await db.execute(
        select(HistoinLedger).where(
            HistoinLedger.user_id == user_id,
            HistoinLedger.reason == "daily_login",
            HistoinLedger.created_at >= today_start,
        ).limit(1)
    )
    if not res_login.scalar_one_or_none():
        histoin_wallet.balance += 10
        h_ledger = HistoinLedger(
            user_id=user_id,
            delta=10,
            reason="daily_login",
            balance_after=histoin_wallet.balance,
            created_at=now,
        )
        db.add(h_ledger)
        await db.flush()

    return token_wallet, histoin_wallet


async def preflight_token_check(user_id: str, estimated_tokens: int, db: AsyncSession) -> UserTokenWallet:
    """Check if user has sufficient tokens before calling LLM."""
    token_wallet, _ = await get_or_create_wallets(user_id, db)
    if token_wallet.token_balance < estimated_tokens:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient tokens. Required estimated ~{estimated_tokens:,} tokens, but you have {token_wallet.token_balance:,}. Please visit the Shop to refill tokens.",
        )
    return token_wallet


async def deduct_generation_tokens(user_id: str, actual_tokens: int, db: AsyncSession) -> int:
    """Deduct actual tokens used after generation."""
    token_wallet, _ = await get_or_create_wallets(user_id, db)
    deduction = min(actual_tokens, token_wallet.token_balance)
    token_wallet.token_balance -= deduction

    ledger = TokenLedger(
        user_id=user_id,
        delta=-deduction,
        reason="ai_generation",
        balance_after=token_wallet.token_balance,
        created_at=datetime.now(timezone.utc),
    )
    db.add(ledger)
    await db.flush()
    return token_wallet.token_balance


async def reward_quiz_histoins(user_id: str, db: AsyncSession) -> int | None:
    """
    Reward +20 Histoins for quiz completion with correct answer (max 3/day).
    Locks the user wallet before checking the daily limit to avoid race conditions.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Lock wallet first so concurrent requests wait before evaluating cap
    _, histoin_wallet = await get_or_create_wallets(user_id, db)

    # Check how many quiz rewards already awarded today under lock
    res = await db.execute(
        select(func.count(HistoinLedger.id)).where(
            HistoinLedger.user_id == user_id,
            HistoinLedger.reason == "quiz_completed",
            HistoinLedger.created_at >= today_start,
        )
    )
    count = res.scalar() or 0
    if count >= 3:
        return None

    histoin_wallet.balance += 20

    ledger = HistoinLedger(
        user_id=user_id,
        delta=20,
        reason="quiz_completed",
        balance_after=histoin_wallet.balance,
        created_at=now,
    )
    db.add(ledger)
    await db.flush()
    return histoin_wallet.balance


async def get_shop_packs(db: AsyncSession) -> list[TokenPack]:
    """Retrieve active token packs from shop."""
    await seed_token_packs(db)
    res = await db.execute(select(TokenPack).where(TokenPack.is_active == True).order_by(TokenPack.histoin_cost.asc()))
    return res.scalars().all()


async def purchase_token_pack(
    user_id: str,
    pack_id: str,
    db: AsyncSession,
    idempotency_key: str | None = None,
) -> dict:
    """
    Atomically exchange Histoins for Tokens.
    - Idempotency check: returns previous result if key already processed
    - Locks both wallets with with_for_update to prevent race conditions.
    """
    # 1. Idempotency check first
    if idempotency_key:
        existing = (await db.execute(
            select(PurchaseLog).where(PurchaseLog.idempotency_key == idempotency_key)
        )).scalar_one_or_none()
        if existing:
            return existing.result

    # 2. Fetch pack
    res_p = await db.execute(select(TokenPack).where(TokenPack.id == pack_id, TokenPack.is_active == True))
    pack = res_p.scalar_one_or_none()
    if not pack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token pack not found")

    now = datetime.now(timezone.utc)

    # 3. Lock both wallets with with_for_update()
    token_wallet, histoin_wallet = await get_or_create_wallets(user_id, db)

    if histoin_wallet.balance < pack.histoin_cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Not enough Histoins. This pack costs {pack.histoin_cost} Histoins, but you have {histoin_wallet.balance}.",
        )

    # 4. Deduct Histoins
    histoin_wallet.balance -= pack.histoin_cost
    h_ledger = HistoinLedger(
        user_id=user_id,
        delta=-pack.histoin_cost,
        reason="purchase_spend",
        balance_after=histoin_wallet.balance,
        created_at=now,
    )
    db.add(h_ledger)

    # 5. Credit Tokens respecting PURCHASED_CEILING
    new_balance = min(token_wallet.token_balance + pack.token_amount, PURCHASED_CEILING)
    credited = new_balance - token_wallet.token_balance
    token_wallet.token_balance = new_balance

    t_ledger = TokenLedger(
        user_id=user_id,
        delta=credited,
        reason="purchase",
        balance_after=token_wallet.token_balance,
        created_at=now,
    )
    db.add(t_ledger)

    result = {
        "token_balance": token_wallet.token_balance,
        "histoin_balance": histoin_wallet.balance,
        "tokens_credited": credited,
        "pack_name": pack.name,
    }

    if idempotency_key:
        db.add(PurchaseLog(
            idempotency_key=idempotency_key,
            user_id=user_id,
            result=result,
            created_at=now,
        ))

    await db.flush()
    return result
