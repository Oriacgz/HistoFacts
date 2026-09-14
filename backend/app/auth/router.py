"""
FastAPI router for Auth & Identity endpoints.
Includes authentication, sessions, 2FA, preferences, deletion, export, and relationships.
"""

import io
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, TwoFactorAuth
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
    ProfileUpdate,
    AvatarResponse,
    PasswordChange,
    EmailChangeRequest,
    UserSessionResponse,
    PreferencesUpdate,
    TwoFactorSetupResponse,
    TwoFactorCodeRequest,
    TwoFactorStatusResponse,
    BlockedUserResponse,
    PublicUserProfileResponse,
    AccountDeletionResponse,
)
from app.auth.service import (
    register_user,
    authenticate_user,
    refresh_user_tokens,
    update_profile,
    change_password,
    request_email_change,
    confirm_email_change,
    list_user_sessions,
    revoke_session,
    setup_two_factor,
    enable_two_factor,
    disable_two_factor,
    get_two_factor_status,
    update_preferences,
    get_user_profile,
    request_account_deletion,
    cancel_account_deletion,
    execute_account_deletion,
    export_user_data,
)
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
    block_user,
    unblock_user,
    list_blocked_users,
)
from app.core.file_storage import (
    validate_image_content,
    store_file,
    delete_stored_file,
)
from app.core.database import get_async_session
from app.core.deps import get_current_user, get_optional_current_user, verify_internal_service_secret, CurrentUser
from app.core.security import decode_token
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_DIMENSION = 512
router = APIRouter(prefix="/api/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])


def _extract_sid_from_request(request: Request) -> str | None:
    """Extract session ID (sid) claim from Bearer Authorization header."""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        payload = decode_token(auth_header[7:])
        if payload:
            return payload.get("sid")
    return None


async def _build_user_response(user: User, db: AsyncSession) -> UserResponse:
    """Populate UserResponse with 2FA status and preferences."""
    tfa_res = await db.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id))
    two_factor = tfa_res.scalar_one_or_none()
    resp = UserResponse.model_validate(user)
    resp.is_2fa_enabled = bool(two_factor and two_factor.enabled)
    resp.preferences = user.preferences or {}
    return resp


async def get_current_user_db(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> User:
    """Get full User model from DB for Auth service internal operations."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@router.get("/internal/users/{user_id}/summary", dependencies=[Depends(verify_internal_service_secret)])
async def get_user_summary(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Internal endpoint for other services to fetch user summary."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.id,
        "username": user.username,
        "tag": user.tag,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "is_banned": user.is_banned,
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    req: UserRegisterRequest,
    db: AsyncSession = Depends(get_async_session),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    user, access_token, refresh_token = await register_user(
        req, db, user_agent=user_agent, ip_address=ip_address
    )
    user_resp = await _build_user_response(user, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_resp,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    req: UserLoginRequest,
    db: AsyncSession = Depends(get_async_session),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    user, access_token, refresh_token = await authenticate_user(
        req, db, user_agent=user_agent, ip_address=ip_address
    )
    user_resp = await _build_user_response(user, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_resp,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshTokenRequest, db: AsyncSession = Depends(get_async_session)):
    user, access_token, refresh_token = await refresh_user_tokens(req.refresh_token, db)
    user_resp = await _build_user_response(user, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_resp,
    )


@router.get("/me", response_model=UserResponse)
@router.get("/users/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    return await _build_user_response(current_user, db)


@router.get("/search", response_model=list[SearchUserResponse])
async def search_users_endpoint(
    q: str = Query("", description="Search query: partial name or exact Name#Tag"),
    tag: str | None = Query(None, description="Optional tag query fallback"),
    optional_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Search users by partial name or exact Name#Tag, excluding blocked users."""
    search_term = (q or tag or "").strip()
    if not search_term:
        return []
    current_user_id = optional_user.id if optional_user else None
    return await search_users(search_term, db, current_user_id=current_user_id)


# ── Session Management Endpoints ─────────────────────────────────────────────

@router.get("/users/me/sessions", response_model=list[UserSessionResponse])
@router.get("/me/sessions", response_model=list[UserSessionResponse])
@users_router.get("/me/sessions", response_model=list[UserSessionResponse])
async def get_my_sessions(
    request: Request,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """List active sessions for the user, with the current session flagged."""
    current_sid = _extract_sid_from_request(request)
    return await list_user_sessions(db, user.id, current_session_id=current_sid)


@router.delete("/users/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
@users_router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_my_session(
    session_id: str,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Revoke a specific session. Subsequent refresh attempts using this session fail."""
    await revoke_session(db, user.id, session_id)
    return None


# ── Two-Factor Authentication Endpoints ──────────────────────────────────────

@router.post("/users/me/2fa/setup", response_model=TwoFactorSetupResponse)
@router.post("/me/2fa/setup", response_model=TwoFactorSetupResponse)
@users_router.post("/me/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Generate TOTP secret, QR URI, and one-time backup recovery codes."""
    return await setup_two_factor(db, user)


@router.post("/users/me/2fa/enable", status_code=status.HTTP_200_OK)
@router.post("/me/2fa/enable", status_code=status.HTTP_200_OK)
@users_router.post("/me/2fa/enable", status_code=status.HTTP_200_OK)
async def enable_2fa(
    payload: TwoFactorCodeRequest,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Verify live TOTP code and activate 2FA."""
    await enable_two_factor(db, user, payload.code)
    return {"status": "success", "message": "Two-factor authentication enabled successfully"}


@router.post("/users/me/2fa/disable", status_code=status.HTTP_200_OK)
@router.post("/me/2fa/disable", status_code=status.HTTP_200_OK)
@users_router.post("/me/2fa/disable", status_code=status.HTTP_200_OK)
async def disable_2fa(
    payload: TwoFactorCodeRequest,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Disable 2FA after validating current password or live code."""
    await disable_two_factor(db, user, payload.code)
    return {"status": "success", "message": "Two-factor authentication disabled"}


@router.get("/users/me/2fa/status", response_model=TwoFactorStatusResponse)
@router.get("/me/2fa/status", response_model=TwoFactorStatusResponse)
@users_router.get("/me/2fa/status", response_model=TwoFactorStatusResponse)
async def get_2fa_status(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Get current 2FA status and count of remaining backup codes."""
    return await get_two_factor_status(db, user.id)


# ── Preferences Endpoints (Single JSON column) ───────────────────────────────

@router.patch("/users/me/preferences")
@router.patch("/me/preferences")
@users_router.patch("/me/preferences")
async def patch_preferences(
    payload: PreferencesUpdate,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Update user preferences (theme, language, notification toggles) in existing JSON column."""
    updated = await update_preferences(db, user, payload)
    return {"status": "success", "preferences": updated}


@router.get("/users/me/preferences")
@router.get("/me/preferences")
@users_router.get("/me/preferences")
async def get_preferences(
    user: User = Depends(get_current_user_db),
):
    """Fetch user preferences."""
    return user.preferences or {}


# ── Account Deletion & Data Export ───────────────────────────────────────────

@router.post("/users/me/delete", response_model=AccountDeletionResponse)
@router.post("/me/delete", response_model=AccountDeletionResponse)
@users_router.post("/me/delete", response_model=AccountDeletionResponse)
async def request_deletion(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Request account deletion with a 30-day grace period (reversible on login)."""
    exec_at = await request_account_deletion(user.id, db)
    return AccountDeletionResponse(
        status="scheduled",
        message="Account deletion scheduled. You have 30 days to log back in and cancel.",
        deletion_scheduled_at=exec_at,
    )


@router.post("/users/me/delete/cancel", response_model=AccountDeletionResponse)
@router.post("/me/delete/cancel", response_model=AccountDeletionResponse)
@users_router.post("/me/delete/cancel", response_model=AccountDeletionResponse)
async def cancel_deletion(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Cancel scheduled account deletion."""
    await cancel_account_deletion(user.id, db)
    return AccountDeletionResponse(
        status="cancelled",
        message="Account deletion cancelled. Your account remains active.",
    )


@router.post("/users/me/delete/execute", status_code=status.HTTP_200_OK)
@router.post("/me/delete/execute", status_code=status.HTTP_200_OK)
@users_router.post("/me/delete/execute", status_code=status.HTTP_200_OK)
async def execute_deletion(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Immediately execute irreversible account deletion and purge data across services."""
    await execute_account_deletion(user.id, db)
    return {"status": "success", "message": "Account has been permanently deleted and personal data purged."}


@router.get("/users/me/export")
@router.get("/me/export")
@users_router.get("/me/export")
async def export_data(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Fan out to all services, collect user data, and download as a ZIP archive."""
    zip_bytes = await export_user_data(user.id, db)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="histofacts_export_{user.id}.zip"'},
    )


# ── Blocked Users Endpoints ──────────────────────────────────────────────────

@router.post("/users/{user_id}/block", status_code=status.HTTP_200_OK)
@users_router.post("/{user_id}/block", status_code=status.HTTP_200_OK)
async def block_user_endpoint(
    user_id: str,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Block another user, removing any friendship and rejecting future requests."""
    await block_user(db, user.id, user_id)
    return {"status": "success", "message": f"User {user_id} blocked"}


@router.delete("/users/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
@users_router.delete("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user_endpoint(
    user_id: str,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """Unblock a previously blocked user."""
    await unblock_user(db, user.id, user_id)
    return None


@router.get("/users/me/blocked", response_model=list[BlockedUserResponse])
@router.get("/me/blocked", response_model=list[BlockedUserResponse])
@users_router.get("/me/blocked", response_model=list[BlockedUserResponse])
async def get_blocked_users_endpoint(
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    """List all blocked users."""
    return await list_blocked_users(db, user.id)


# ── Public Profile Endpoint (Checks profile_visibility once) ─────────────────

@router.get("/users/{user_id}/profile", response_model=PublicUserProfileResponse)
@router.get("/users/{user_id}", response_model=PublicUserProfileResponse)
@users_router.get("/{user_id}/profile", response_model=PublicUserProfileResponse)
@users_router.get("/{user_id}", response_model=PublicUserProfileResponse)
async def view_user_profile(
    user_id: str,
    optional_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Fetch another user's profile with single-check visibility rule (bio, stats, history)."""
    viewer_id = optional_user.id if optional_user else None
    return await get_user_profile(db, user_id, viewer_id=viewer_id)



# ── Friends & Presence Endpoints ─────────────────────────────────────────────

@router.post("/friends/request", response_model=FriendRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_friend_request(
    req: FriendRequestCreate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    return await send_friend_request(db, current_user.id, req.addressee_id)


@router.get("/friends/requests/incoming", response_model=list[FriendRequestResponse])
async def list_incoming_requests(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    return await get_incoming_requests(db, current_user.id)


@router.get("/friends/requests/outgoing", response_model=list[FriendRequestResponse])
async def list_outgoing_requests(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    return await get_outgoing_requests(db, current_user.id)


@router.post("/friends/requests/{request_id}/accept", response_model=FriendRequestResponse)
async def accept_request(
    request_id: str,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    return await accept_friend_request(db, request_id, current_user.id)


@router.post("/friends/requests/{request_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_request(
    request_id: str,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    await decline_friend_request(db, request_id, current_user.id)
    return None


@router.delete("/friends/{friend_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friend_user_id: str,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    await unfriend(db, current_user.id, friend_user_id)
    return None


@router.get("/friends", response_model=list[FriendWithPresence])
async def list_friends_with_presence_endpoint(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    return await list_friends_with_presence(db, current_user.id)


@router.post("/presence/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def presence_heartbeat(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    await heartbeat(db, current_user.id)
    return None


# ── Profile Management Endpoints ─────────────────────────────────────────────

@router.post("/users/me/avatar", response_model=AvatarResponse)
@router.post("/me/avatar", response_model=AvatarResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    raw = await file.read()
    if len(raw) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB)")
    validate_image_content(raw)

    try:
        img = Image.open(io.BytesIO(raw))
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
        processed = io.BytesIO()
        img.save(processed, format="WEBP", quality=85)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not process image")

    if user.avatar_url:
        delete_stored_file(user.avatar_url)

    new_url = store_file(processed.getvalue(), prefix=f"avatars/{user.id}", extension="webp")
    user.avatar_url = new_url
    await db.commit()
    await db.refresh(user)
    return AvatarResponse(avatar_url=new_url)


@router.patch("/users/me", response_model=UserResponse)
@router.patch("/me", response_model=UserResponse)
async def update_profile_endpoint(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    updated = await update_profile(db, user, payload)
    return await _build_user_response(updated, db)


@router.post("/users/me/change-password")
@router.post("/me/change-password")
async def change_password_endpoint(
    payload: PasswordChange,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    await change_password(db, user, payload)
    return {"message": "Password updated successfully"}


@router.post("/users/me/change-email")
@router.post("/me/change-email")
async def request_email_change_endpoint(
    payload: EmailChangeRequest,
    user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_async_session),
):
    token = await request_email_change(user, payload, db)
    return {"message": "Confirmation link sent to your new email address", "token": token}


@router.get("/users/me/change-email/confirm")
@router.get("/me/change-email/confirm")
async def confirm_email_change_endpoint(
    token: str = Query(..., description="Verification token from link"),
    db: AsyncSession = Depends(get_async_session),
):
    new_email = await confirm_email_change(token, db)
    return {"status": "success", "message": "Email updated successfully", "email": new_email}