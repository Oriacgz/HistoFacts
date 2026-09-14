"""
FastAPI dependencies shared across modules.
"""

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_session
from app.core.security import decode_token

# Points at the login endpoint — tells Swagger UI where to send credentials
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


class CurrentUser(BaseModel):
    """Current user extracted from JWT token claims — no DB query needed."""
    id: str
    username: str = ""
    tag: str = ""


async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> CurrentUser:
    """
    Decode the JWT bearer token and return the authenticated CurrentUser.
    Does NOT query the database — uses claims directly from the JWT.
    Raises 401 if the token is missing, invalid, or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    return CurrentUser(
        id=user_id,
        username=payload.get("username", ""),
        tag=payload.get("tag", ""),
    )


async def get_optional_current_user(
    token: str | None = Depends(oauth2_scheme_optional),
) -> CurrentUser | None:
    """
    Return the authenticated CurrentUser if valid token is provided, else None.
    Does NOT query the database — uses claims directly from the JWT.
    """
    if not token:
        return None

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        return None

    user_id: str | None = payload.get("sub")
    if user_id is None:
        return None

    return CurrentUser(
        id=user_id,
        username=payload.get("username", ""),
        tag=payload.get("tag", ""),
    )


async def verify_internal_service_secret(
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
):
    """
    Verify inter-service authorization header.
    Only authorized backend microservices possessing the secret key can invoke internal endpoints.
    """
    if not x_internal_secret or x_internal_secret != settings.secret_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid or missing internal service authorization token",
        )
    return True
