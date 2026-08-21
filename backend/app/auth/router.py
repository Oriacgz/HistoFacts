"""
FastAPI router for Auth & Identity endpoints.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    RefreshTokenRequest,
    UserResponse,
    TokenResponse,
)
from app.auth.service import register_user, authenticate_user, refresh_user_tokens
from app.core.database import get_async_session
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_async_session)):
    user, access_token, refresh_token = await register_user(req, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_async_session)):
    user, access_token, refresh_token = await authenticate_user(req, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshTokenRequest, db: AsyncSession = Depends(get_async_session)):
    user, access_token, refresh_token = await refresh_user_tokens(req.refresh_token, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


from sqlalchemy import select, or_

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    tag: str,
    db: AsyncSession = Depends(get_async_session),
):
    # tag format: "Ryan#3081" or "Ryan"
    if "#" in tag:
        uname, utag = tag.split("#", 1)
        res = await db.execute(
            select(User).where(User.username.ilike(f"%{uname}%"), User.tag == utag)
        )
    else:
        res = await db.execute(
            select(User).where(or_(User.username.ilike(f"%{tag}%"), User.tag == tag))
        )
    users = res.scalars().all()
    return [UserResponse.model_validate(u) for u in users]

