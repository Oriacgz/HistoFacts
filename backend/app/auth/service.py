"""
Auth business logic (register, login, refresh tokens).
"""

from datetime import timedelta
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    ProfileUpdate,
    PasswordChange,
    EmailChangeRequest,
)
from app.auth.utils import generate_unique_tag, validate_username
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_verification_token,
    verify_and_decode_token,
)
from app.core.email import send_email, verification_link


async def register_user(req: UserRegisterRequest, db: AsyncSession) -> tuple[User, str, str]:
    # Validate username
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

    await db.commit()
    await db.refresh(user)

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


async def change_username(db: AsyncSession, user: User, new_username: str) -> User:
    """
    Change username and re-check tag uniqueness against the new name.
    If (new_username, existing tag) is already taken, generate a new unique tag.
    """
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


async def update_profile(db: AsyncSession, user: User, payload: ProfileUpdate) -> User:
    """Update user profile fields."""
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

    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user: User, payload: PasswordChange) -> None:
    """Change user password after verifying current password."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password incorrect")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()


async def request_email_change(user: User, payload: EmailChangeRequest, db: AsyncSession) -> str:
    """Request email change by dispatching a verification token to the new address."""
    existing = await db.execute(
        select(User.id).where(func.lower(User.email) == payload.new_email.lower(), User.id != user.id)
    )
    if existing.first():
        raise HTTPException(status_code=400, detail="Email is already in use by another account")

    token = create_verification_token(str(user.id), payload.new_email, expires_in=timedelta(hours=24))
    link = verification_link(token)
    await send_email(payload.new_email, "Confirm your new email", f"Click the link to confirm your email: {link}")
    return token


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

