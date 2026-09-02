"""
Utility functions for Auth module (tag generation, etc.).
"""

import random
import string
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.models import User
from fastapi import HTTPException


TAG_LENGTH = 4
MAX_RETRIES = 20


async def generate_unique_tag(username: str, db: AsyncSession) -> str:
    """
    Generate a 4-digit unique numeric tag for a username (e.g. 3081 for Ryan -> Ryan#3081).
    Retries up to 20 times in case of collision.
    Uses case-insensitive username check.
    """
    normalized = username.strip().lower()
    for _ in range(MAX_RETRIES):
        tag = f"{random.randint(0, 9999):04d}"
        result = await db.execute(
            select(User).where(
                func.lower(User.username) == normalized,
                User.tag == tag,
            )
        )
        if not result.scalar_one_or_none():
            return tag
    raise HTTPException(500, "Could not generate a unique tag for this name — try a different one")


def validate_username(username: str) -> None:
    """Validate username doesn't contain '#' which is used as the tag delimiter."""
    if "#" in username:
        raise HTTPException(400, "Username cannot contain '#'")
