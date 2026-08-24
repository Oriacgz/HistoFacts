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


from sqlalchemy import select, or_, delete
from fastapi import HTTPException
from app.auth.models import Friend
from app.auth.schemas import FriendResponse, AddFriendRequest


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.get("/friends", response_model=list[FriendResponse])
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """List all accepted friends of the current user."""
    # Find friends where current_user is user_id or friend_id
    query = (
        select(Friend, User)
        .join(User, (Friend.friend_id == User.id) | (Friend.user_id == User.id))
        .where(
            or_(Friend.user_id == current_user.id, Friend.friend_id == current_user.id),
            User.id != current_user.id,
            Friend.status == "accepted",
        )
    )
    res = await db.execute(query)
    rows = res.all()
    results = []
    seen = set()
    for friend_rel, user_obj in rows:
        if user_obj.id not in seen:
            seen.add(user_obj.id)
            results.append(
                FriendResponse(
                    id=user_obj.id,
                    username=user_obj.username,
                    tag=user_obj.tag,
                    avatar_url=user_obj.avatar_url,
                    status=friend_rel.status,
                    requested_at=friend_rel.requested_at,
                )
            )
    return results


@router.post("/friends", response_model=FriendResponse, status_code=status.HTTP_201_CREATED)
async def add_friend(
    req: AddFriendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Add a friend by user_id or username+tag."""
    target_user = None
    if req.friend_id:
        target_user = await db.get(User, req.friend_id)
    elif req.username and req.tag:
        res = await db.execute(
            select(User).where(User.username == req.username, User.tag == req.tag)
        )
        target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot friend yourself")

    # Check if existing relationship
    existing = await db.execute(
        select(Friend).where(
            or_(
                (Friend.user_id == current_user.id) & (Friend.friend_id == target_user.id),
                (Friend.user_id == target_user.id) & (Friend.friend_id == current_user.id),
            )
        )
    )
    rel = existing.scalar_one_or_none()
    if rel:
        return FriendResponse(
            id=target_user.id,
            username=target_user.username,
            tag=target_user.tag,
            avatar_url=target_user.avatar_url,
            status=rel.status,
            requested_at=rel.requested_at,
        )

    new_rel = Friend(
        user_id=current_user.id,
        friend_id=target_user.id,
        status="accepted",
    )
    db.add(new_rel)
    await db.commit()
    await db.refresh(new_rel)

    return FriendResponse(
        id=target_user.id,
        username=target_user.username,
        tag=target_user.tag,
        avatar_url=target_user.avatar_url,
        status=new_rel.status,
        requested_at=new_rel.requested_at,
    )


@router.delete("/friends/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Remove a friendship relationship."""
    await db.execute(
        delete(Friend).where(
            or_(
                (Friend.user_id == current_user.id) & (Friend.friend_id == friend_id),
                (Friend.user_id == friend_id) & (Friend.friend_id == current_user.id),
            )
        )
    )
    await db.commit()
    return None


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


