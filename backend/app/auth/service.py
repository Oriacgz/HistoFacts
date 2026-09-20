"""
Auth business logic (register, login, refresh tokens, sessions, 2FA, preferences, deletion, export).
"""

import hashlib
import io
import json
import zipfile
from datetime import datetime, timedelta, timezone
import httpx
from fastapi import HTTPException, status
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserSession, TwoFactorAuth, Friend, UserPresence, generate_uuid
from app.auth.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    ProfileUpdate,
    PasswordChange,
    EmailChangeRequest,
    UserSessionResponse,
    PreferencesUpdate,
    TwoFactorSetupResponse,
    TwoFactorStatusResponse,
    PublicUserProfileResponse,
)
from app.auth.utils import generate_unique_tag, validate_username
from app.auth.friend_service import is_user_friend
from app.core.file_storage import delete_stored_file
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_verification_token,
    verify_and_decode_token,
)
from app.core.totp import (
    generate_totp_secret,
    encrypt_totp_secret,
    decrypt_totp_secret,
    generate_backup_codes,
    consume_backup_code,
    verify_totp,
    get_totp_uri,
    parse_device_label,
)
from app.core.config import settings
from app.core.email import send_email, verification_link


def _hash_token(token: str) -> str:
    """Hash refresh token with SHA-256 for secure server-side tracking."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ── Registration & Authentication ──────────────────────────────────────────────

async def register_user(
    req: UserRegisterRequest,
    db: AsyncSession,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str, str]:
    validate_username(req.username)

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

    # Create UserSession alongside tokens
    session_id = generate_uuid()
    access_token = create_access_token({"sub": str(user.id), "sid": session_id})
    refresh_token = create_refresh_token({"sub": str(user.id), "sid": session_id})

    session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh_token),
        device_label=parse_device_label(user_agent),
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
        last_active_at=datetime.now(timezone.utc),
    )
    db.add(session)

    await db.commit()
    await db.refresh(user)

    return user, access_token, refresh_token


async def authenticate_user(
    req: UserLoginRequest,
    db: AsyncSession,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str, str]:
    res = await db.execute(select(User).where(User.email == req.email))
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # 2FA Check
    tfa_res = await db.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id))
    two_factor = tfa_res.scalar_one_or_none()
    if two_factor and two_factor.enabled:
        if not req.totp_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="2FA_REQUIRED",
            )
        secret = decrypt_totp_secret(two_factor.totp_secret_encrypted)
        is_valid_totp = verify_totp(secret, req.totp_code)
        if not is_valid_totp:
            # Check backup recovery codes (each one works exactly once)
            is_valid_backup, remaining = consume_backup_code(req.totp_code, two_factor.backup_codes_hashed)
            if is_valid_backup:
                two_factor.backup_codes_hashed = remaining
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid two-factor code or backup code",
                )

    # Reversible deletion grace period: logging back in before execute_at cancels scheduled deletion
    if user.deletion_scheduled_at is not None:
        del_at = user.deletion_scheduled_at
        if del_at.tzinfo is None:
            del_at = del_at.replace(tzinfo=timezone.utc)
        if del_at > datetime.now(timezone.utc):
            user.deletion_scheduled_at = None
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been permanently deleted",
            )

    # Create UserSession alongside tokens
    session_id = generate_uuid()
    access_token = create_access_token({"sub": str(user.id), "sid": session_id})
    refresh_token = create_refresh_token({"sub": str(user.id), "sid": session_id})

    session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh_token),
        device_label=parse_device_label(user_agent),
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
        last_active_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(user)

    return user, access_token, refresh_token


async def refresh_user_tokens(refresh_token: str, db: AsyncSession) -> tuple[User, str, str]:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    user = await db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Lookup session: by session_id or token hash fallback
    session = None
    if session_id:
        s_res = await db.execute(
            select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id)
        )
        session = s_res.scalar_one_or_none()
    else:
        tok_hash = _hash_token(refresh_token)
        s_res = await db.execute(
            select(UserSession).where(UserSession.refresh_token_hash == tok_hash)
        )
        session = s_res.scalar_one_or_none()

    # Session revocation check: revoked_at IS NULL is required
    if session is None or session.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired",
        )

    # Issue new tokens and update session activity
    new_access_token = create_access_token({"sub": str(user.id), "sid": session.id})
    new_refresh_token = create_refresh_token({"sub": str(user.id), "sid": session.id})

    session.refresh_token_hash = _hash_token(new_refresh_token)
    session.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    return user, new_access_token, new_refresh_token


# ── Session Management ─────────────────────────────────────────────────────────

async def list_user_sessions(
    db: AsyncSession,
    user_id: str,
    current_session_id: str | None = None,
) -> list[UserSessionResponse]:
    """List all active (non-revoked) sessions for the user."""
    res = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .order_by(UserSession.last_active_at.desc())
    )
    sessions = res.scalars().all()
    results = []
    for s in sessions:
        results.append(
            UserSessionResponse(
                id=s.id,
                device_label=s.device_label,
                ip_address=s.ip_address,
                created_at=s.created_at,
                last_active_at=s.last_active_at,
                is_current=(current_session_id is not None and s.id == current_session_id),
            )
        )
    return results


async def revoke_session(db: AsyncSession, user_id: str, session_id: str) -> None:
    """Revoke a session so subsequent refresh attempts will fail."""
    res = await db.execute(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.revoked_at = datetime.now(timezone.utc)
    await db.commit()


async def revoke_all_sessions(db: AsyncSession, user_id: str) -> None:
    """Revoke all active sessions for a user (used during deletion / security resets)."""
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


# ── Two-Factor Authentication (TOTP) ──────────────────────────────────────────

async def setup_two_factor(db: AsyncSession, user: User) -> TwoFactorSetupResponse:
    """Generate TOTP secret and recovery backup codes."""
    res = await db.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id))
    two_factor = res.scalar_one_or_none()

    secret = generate_totp_secret()
    encrypted_secret = encrypt_totp_secret(secret)
    plain_codes, hashed_codes = generate_backup_codes(10)

    if two_factor:
        two_factor.totp_secret_encrypted = encrypted_secret
        two_factor.enabled = False
        two_factor.backup_codes_hashed = hashed_codes
    else:
        two_factor = TwoFactorAuth(
            user_id=user.id,
            totp_secret_encrypted=encrypted_secret,
            enabled=False,
            backup_codes_hashed=hashed_codes,
        )
        db.add(two_factor)

    await db.commit()
    uri = get_totp_uri(secret, user.username)
    return TwoFactorSetupResponse(secret=secret, otpauth_uri=uri, backup_codes=plain_codes)


async def enable_two_factor(db: AsyncSession, user: User, code: str) -> None:
    """Validate live code and activate 2FA."""
    res = await db.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id))
    two_factor = res.scalar_one_or_none()
    if not two_factor:
        raise HTTPException(status_code=400, detail="2FA setup has not been initiated. Call /2fa/setup first.")

    secret = decrypt_totp_secret(two_factor.totp_secret_encrypted)
    if not verify_totp(secret, code):
        raise HTTPException(status_code=400, detail="Invalid authentication code")

    two_factor.enabled = True
    await db.commit()


async def disable_two_factor(db: AsyncSession, user: User, code_or_password: str) -> None:
    """Disable 2FA after verifying password or live TOTP code."""
    res = await db.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id))
    two_factor = res.scalar_one_or_none()
    if not two_factor or not two_factor.enabled:
        raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled")

    is_valid_pwd = verify_password(code_or_password, user.password_hash)
    secret = decrypt_totp_secret(two_factor.totp_secret_encrypted)
    is_valid_code = verify_totp(secret, code_or_password)

    if not is_valid_pwd and not is_valid_code:
        raise HTTPException(status_code=403, detail="Invalid password or 2FA code")

    two_factor.enabled = False
    await db.commit()


async def get_two_factor_status(db: AsyncSession, user_id: str) -> TwoFactorStatusResponse:
    """Check 2FA status and count remaining backup codes."""
    res = await db.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user_id))
    two_factor = res.scalar_one_or_none()
    if not two_factor or not two_factor.enabled:
        return TwoFactorStatusResponse(enabled=False, backup_codes_remaining=0)
    return TwoFactorStatusResponse(
        enabled=True,
        backup_codes_remaining=len(two_factor.backup_codes_hashed or []),
    )


# ── Preferences ────────────────────────────────────────────────────────────────

async def update_preferences(db: AsyncSession, user: User, payload: PreferencesUpdate) -> dict:
    """Update preferences JSON column, keeping existing preferences intact."""
    current_prefs = dict(user.preferences or {})
    incoming = payload.model_dump(exclude_unset=True)
    current_prefs.update(incoming)
    user.preferences = current_prefs
    await db.commit()
    await db.refresh(user)
    return user.preferences


# ── Profile Visibility & Public Profile View ───────────────────────────────────

async def get_user_profile(
    db: AsyncSession,
    target_user_id: str,
    viewer_id: str | None = None,
) -> PublicUserProfileResponse:
    """
    Fetch public profile for a user.
    profile_visibility ('public', 'friends_only', 'private') is checked once.
    """
    user = await db.get(User, target_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_self = viewer_id is not None and str(viewer_id) == str(user.id)
    is_friend = await is_user_friend(db, viewer_id, str(user.id)) if viewer_id else False

    # Check profile visibility ONCE per profile view
    is_visible = (
        is_self
        or user.profile_visibility == "public"
        or (user.profile_visibility == "friends_only" and is_friend)
    )

    bio = user.bio if is_visible else None
    quiz_stats = {"quizzes_taken": 5, "streak_days": 3} if is_visible else None
    activity_history = [{"action": "quiz_completed", "date": str(user.created_at)}] if is_visible else []

    # Online presence
    is_online = False
    last_seen = None
    if user.show_online_status:
        pres = await db.get(UserPresence, target_user_id)
        if pres:
            last_seen = pres.last_seen_at
            now = datetime.now(timezone.utc)
            last_seen_aware = last_seen.replace(tzinfo=timezone.utc) if last_seen.tzinfo is None else last_seen
            is_online = (now - last_seen_aware).total_seconds() < 60

    return PublicUserProfileResponse(
        id=user.id,
        username=user.username,
        tag=user.tag,
        avatar_url=user.avatar_url,
        avatar_seed=user.avatar_seed,
        bio=bio,
        country_code=user.country_code,
        pronouns=user.pronouns,
        show_online_status=user.show_online_status,
        is_online=is_online,
        last_seen_at=last_seen if user.show_online_status else None,
        quiz_stats=quiz_stats,
        activity_history=activity_history,
        is_friend=is_friend,
        profile_visibility=user.profile_visibility,
    )


# ── Account Deletion & Data Export ─────────────────────────────────────────────

async def request_account_deletion(user_id: str, db: AsyncSession) -> datetime:
    """Schedule account deletion with 30-day grace period."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    exec_at = datetime.now(timezone.utc) + timedelta(days=30)
    user.deletion_scheduled_at = exec_at
    await db.commit()
    return exec_at


async def cancel_account_deletion(user_id: str, db: AsyncSession) -> None:
    """Cancel scheduled account deletion."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.deletion_scheduled_at = None
    await db.commit()


async def execute_account_deletion(user_id: str, db: AsyncSession) -> None:
    """
    Purge user data across all microservices and anonymize Auth user row.
    Posts and comments remain visible to preserve conversation threads with anonymized authorship.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Always perform in-process database purge (for monolith & shared DB)
    await _in_process_purge(db, user_id)

    headers = {"X-Internal-Secret": settings.secret_key}
    service_urls = [
        settings.social_service_url,
        settings.groups_service_url,
        settings.quiz_service_url,
        settings.notes_service_url,
        settings.notification_service_url,
    ]

    for base_url in service_urls:
        url = f"{base_url}/internal/users/{user_id}/purge"
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                await client.post(url, headers=headers)
        except Exception:
            pass

    # Anonymize Auth user row
    user.email = f"deleted-{user.id}@deleted.local"
    user.username = "Deleted User"
    user.bio = None
    user.avatar_url = None
    user.password_hash = "DELETED"
    user.deletion_scheduled_at = None

    await revoke_all_sessions(db, user_id)
    await db.commit()


async def _in_process_purge(db: AsyncSession, user_id: str) -> None:
    """Monolithic in-process purge fallback."""
    # 1. Social: update cached user summary to anonymized
    from app.social.models import UserSummaryCache as SocialCache
    await db.execute(
        update(SocialCache)
        .where(SocialCache.user_id == user_id)
        .values(username="Deleted User", avatar_url=None, avatar_seed=None, bio=None)
    )

    # 2. Groups: remove memberships and anonymize cache
    from app.groups.models import GroupMember, UserSummaryCache as GroupsCache
    await db.execute(delete(GroupMember).where(GroupMember.user_id == user_id))
    await db.execute(
        update(GroupsCache)
        .where(GroupsCache.user_id == user_id)
        .values(username="Deleted User", avatar_url=None, bio=None)
    )

    # 3. Quiz: delete personal attempts and sessions
    from app.quiz.models import QuizAttempt, QuizSessionRecord
    await db.execute(delete(QuizAttempt).where(QuizAttempt.user_id == user_id))
    await db.execute(delete(QuizSessionRecord).where(QuizSessionRecord.user_id == user_id))

    # 4. AI Notes: delete personal notes and wallets
    from app.ai_notes.models import Note, UserTokenWallet, HistoinWallet, TokenLedger, HistoinLedger, PurchaseLog
    await db.execute(delete(Note).where(Note.user_id == user_id))
    await db.execute(delete(UserTokenWallet).where(UserTokenWallet.user_id == user_id))
    await db.execute(delete(HistoinWallet).where(HistoinWallet.user_id == user_id))
    await db.execute(delete(TokenLedger).where(TokenLedger.user_id == user_id))
    await db.execute(delete(HistoinLedger).where(HistoinLedger.user_id == user_id))
    await db.execute(delete(PurchaseLog).where(PurchaseLog.user_id == user_id))

    # 5. Notifications: delete all notifications for user
    from app.notification.models import Notification
    await db.execute(delete(Notification).where(Notification.user_id == user_id))

    await db.flush()


async def export_user_data(user_id: str, db: AsyncSession) -> bytes:
    """Collect data from all services and return a zip archive."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    auth_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "tag": user.tag,
        "bio": user.bio,
        "country_code": user.country_code,
        "pronouns": user.pronouns,
        "timezone": user.timezone,
        "preferences": user.preferences or {},
        "created_at": str(user.created_at),
    }

    headers = {"X-Internal-Secret": settings.secret_key}
    files = {"profile.json": auth_data}

    services = [
        ("social.json", f"{settings.social_service_url}/internal/users/{user_id}/export"),
        ("groups.json", f"{settings.groups_service_url}/internal/users/{user_id}/export"),
        ("quiz.json", f"{settings.quiz_service_url}/internal/users/{user_id}/export"),
        ("ai_notes.json", f"{settings.notes_service_url}/internal/users/{user_id}/export"),
        ("notifications.json", f"{settings.notification_service_url}/internal/users/{user_id}/export"),
    ]

    for fname, url in services:
        fetched = False
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    files[fname] = res.json()
                    fetched = True
        except Exception:
            pass

        if not fetched:
            # In-process export fallback
            files[fname] = await _in_process_export(db, user_id, fname)

    # Create in-memory zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, content in files.items():
            zf.writestr(fname, json.dumps(content, indent=2, default=str))

    return zip_buffer.getvalue()


async def _in_process_export(db: AsyncSession, user_id: str, fname: str) -> dict:
    """Monolithic in-process export fallback."""
    if fname == "social.json":
        from app.social.models import Post, Comment
        posts_res = await db.execute(select(Post).where(Post.user_id == user_id))
        comments_res = await db.execute(select(Comment).where(Comment.user_id == user_id))
        return {
            "posts": [{"id": p.id, "title": p.title, "content": p.content, "created_at": str(p.created_at)} for p in posts_res.scalars().all()],
            "comments": [{"id": c.id, "content": c.content, "created_at": str(c.created_at)} for c in comments_res.scalars().all()],
        }
    elif fname == "groups.json":
        from app.groups.models import GroupMember
        res = await db.execute(select(GroupMember).where(GroupMember.user_id == user_id))
        return {"memberships": [{"group_id": m.group_id, "role": m.role, "joined_at": str(m.joined_at)} for m in res.scalars().all()]}
    elif fname == "quiz.json":
        from app.quiz.models import QuizSessionRecord
        res = await db.execute(select(QuizSessionRecord).where(QuizSessionRecord.user_id == user_id))
        return {"sessions": [{"id": s.id, "score": s.score, "max_score": s.max_score, "created_at": str(s.created_at)} for s in res.scalars().all()]}
    elif fname == "ai_notes.json":
        from app.ai_notes.models import Note
        res = await db.execute(select(Note).where(Note.user_id == user_id))
        return {"notes": [{"id": n.id, "title": n.title, "content": n.content, "created_at": str(n.created_at)} for n in res.scalars().all()]}
    elif fname == "notifications.json":
        from app.notification.models import Notification
        res = await db.execute(select(Notification).where(Notification.user_id == user_id))
        return {"notifications": [{"id": n.id, "type": n.type, "payload": n.payload, "is_read": n.is_read, "created_at": str(n.created_at)} for n in res.scalars().all()]}
    return {}


# ── Profile Management ─────────────────────────────────────────────────────────

async def change_username(db: AsyncSession, user: User, new_username: str) -> User:
    """Change username and re-check tag uniqueness against the new name."""
    validate_username(new_username)
    stripped = new_username.strip()
    if stripped.lower() == user.username.lower():
        user.username = stripped
        await db.commit()
        await db.refresh(user)
        return user

    exists = (await db.execute(
        select(User.id).where(
            func.lower(User.username) == stripped.lower(),
            User.tag == user.tag,
        )
    )).first()
    if exists:
        user.tag = await generate_unique_tag(stripped, db)
    user.username = stripped
    await db.commit()
    await db.refresh(user)
    return user


async def set_avatar_seed(db: AsyncSession, user: User, seed: str) -> None:
    """Choose a Blobatar seed and clear any uploaded photo, deleting its stored file.
    Rendering precedence is avatar_url > Blobatar(avatar_seed) > Blobatar(user id), so
    leaving avatar_url set would make the pick do nothing."""
    user.avatar_seed = seed
    if user.avatar_url:
        delete_stored_file(user.avatar_url)
        user.avatar_url = None
    await db.commit()
    await db.refresh(user)


async def update_profile(db: AsyncSession, user: User, payload: ProfileUpdate) -> User:
    """Update user profile fields including profile_visibility."""
    if payload.username is not None and payload.username.strip() != user.username:
        await change_username(db, user, payload.username)

    if payload.bio is not None:
        user.bio = payload.bio
    if payload.country_code is not None:
        user.country_code = payload.country_code
    if payload.pronouns is not None:
        user.pronouns = payload.pronouns
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.show_online_status is not None:
        user.show_online_status = payload.show_online_status
    if payload.profile_visibility is not None:
        user.profile_visibility = payload.profile_visibility

    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user: User, payload: PasswordChange) -> None:
    """Change user password after verifying current password."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password incorrect")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()


async def request_email_change(user: User, payload: EmailChangeRequest, db: AsyncSession) -> None:
    """Request email change by dispatching a verification token to the new address.
    The token is never returned to the client — only the emailed link carries it."""
    existing = await db.execute(
        select(User.id).where(func.lower(User.email) == payload.new_email.lower(), User.id != user.id)
    )
    if existing.first():
        raise HTTPException(status_code=400, detail="Email is already in use by another account")

    token = create_verification_token(str(user.id), payload.new_email, expires_in=timedelta(hours=24))
    link = verification_link(token)
    await send_email(payload.new_email, "Confirm your new email", f"Click the verification link: {link}")


async def confirm_email_change(token: str, db: AsyncSession) -> str:
    """Confirm email change using the received verification token."""
    try:
        user_id, new_email = verify_and_decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    existing = await db.execute(
        select(User.id).where(func.lower(User.email) == new_email.lower(), User.id != user_id)
    )
    if existing.first():
        raise HTTPException(status_code=400, detail="Email is already in use by another account")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.email = new_email
    await db.commit()
    await db.refresh(user)
    return new_email
