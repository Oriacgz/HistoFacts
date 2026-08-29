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
    FriendRequestCreate,
    FriendRequestResponse,
    FriendWithPresence,
    SearchUserResponse,
)
from app.auth.service import register_user, authenticate_user, refresh_user_tokens
from app.auth.friend_service import (
    search_users,
    send_friend_request,
    get_incoming_requests,
    get_outgoing_requests,
    accept_friend_request,
    decline_friend_request,
    unfriend,
    list_friends_with_presence,
    heartbeat,
)
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


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.get("/search", response_model=list[SearchUserResponse])
async def search_users_endpoint(
    q: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Search users by partial name or exact Name#Tag."""
    return await search_users(q, db)


@router.post("/friends/request", response_model=FriendRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_friend_request(
    req: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Send a friend request to another user."""
    return await send_friend_request(db, current_user.id, req.addressee_id)


@router.get("/friends/requests/incoming", response_model=list[FriendRequestResponse])
async def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """List pending friend requests sent to the current user."""
    return await get_incoming_requests(db, current_user.id)


@router.get("/friends/requests/outgoing", response_model=list[FriendRequestResponse])
async def list_outgoing_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """List pending friend requests sent by the current user."""
    return await get_outgoing_requests(db, current_user.id)


@router.post("/friends/requests/{request_id}/accept", response_model=FriendRequestResponse)
async def accept_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Accept a pending friend request."""
    return await accept_friend_request(db, request_id, current_user.id)


@router.post("/friends/requests/{request_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Decline a pending friend request."""
    await decline_friend_request(db, request_id, current_user.id)
    return None


@router.delete("/friends/{friend_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friend_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Remove an accepted friendship."""
    await unfriend(db, current_user.id, friend_user_id)
    return None


@router.get("/friends", response_model=list[FriendWithPresence])
async def list_friends_with_presence_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """List accepted friends with online/offline presence (batched query)."""
    return await list_friends_with_presence(db, current_user.id)


@router.post("/presence/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def presence_heartbeat(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Update current user's last seen timestamp (called by frontend every ~25s when tab is visible)."""
    await heartbeat(db, current_user.id)
    return None