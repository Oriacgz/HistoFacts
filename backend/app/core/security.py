"""
JWT token creation / verification and password hashing utilities.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ─────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ── JWT tokens ────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a short-lived access token.

    Args:
        data: Payload dict — must include ``sub`` (user ID as string).
        expires_delta: Custom TTL. Defaults to settings.access_token_expire_minutes.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(data: dict) -> str:
    """
    Create a long-lived refresh token.

    Args:
        data: Payload dict — must include ``sub`` (user ID as string).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict | None:
    """
    Decode and validate a JWT token.

    Returns the payload dict on success, or None if the token is
    invalid / expired.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None


def create_verification_token(user_id: str, new_email: str, expires_in: timedelta = timedelta(hours=24)) -> str:
    """Create a signed token for email confirmation."""
    expire = datetime.now(timezone.utc) + expires_in
    payload = {
        "sub": str(user_id),
        "new_email": str(new_email).strip().lower(),
        "type": "email_verification",
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def verify_and_decode_token(token: str) -> tuple[str, str]:
    """
    Verify and decode an email verification token.
    Raises ValueError if invalid, expired, or wrong type.
    Returns (user_id, new_email).
    """
    payload = decode_token(token)
    if not payload or payload.get("type") != "email_verification":
        raise ValueError("Invalid or expired verification token")
    user_id = payload.get("sub")
    new_email = payload.get("new_email")
    if not user_id or not new_email:
        raise ValueError("Malformed verification token")
    return user_id, new_email

