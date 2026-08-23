"""
Auth business logic (register, login, refresh tokens).
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.schemas import UserRegisterRequest, UserLoginRequest
from app.auth.utils import generate_unique_tag
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


async def register_user(req: UserRegisterRequest, db: AsyncSession) -> tuple[User, str, str]:
    # Check email uniqueness
    res = await db.execute(select(User).where(User.email == req.email))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    tag = await generate_unique_tag(req.username, db)
    hashed_pwd = hash_password(req.password)

    user = User(
        username=req.username,
        tag=tag,
        email=req.email,
        password_hash=hashed_pwd,
    )
    db.add(user)
    await db.flush()  # assign user.id

    # Initialize Token Wallet (350,000 signup bonus) and Histoin Wallet
    from app.ai_notes.wallet_service import get_or_create_wallets
    await get_or_create_wallets(user.id, db)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return user, access_token, refresh_token


async def authenticate_user(req: UserLoginRequest, db: AsyncSession) -> tuple[User, str, str]:
    res = await db.execute(select(User).where(User.email == req.email))
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return user, access_token, refresh_token


async def refresh_user_tokens(refresh_token: str, db: AsyncSession) -> tuple[User, str, str]:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access_token = create_access_token({"sub": str(user.id)})
    new_refresh_token = create_refresh_token({"sub": str(user.id)})

    return user, new_access_token, new_refresh_token
