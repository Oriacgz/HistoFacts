"""
Utility functions for Auth module (tag generation, etc.).
"""

import random
import string
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.models import User


async def generate_unique_tag(username: str, db: AsyncSession) -> str:
    """
    Generate a 4-digit unique numeric tag for a username (e.g. 3081 for Ryan -> Ryan#3081).
    Retries up to 20 times in case of collision.
    """
    for _ in range(20):
        tag = "".join(random.choices(string.digits, k=4))
        result = await db.execute(
            select(User).where(User.username == username, User.tag == tag)
        )
        if not result.scalar_one_or_none():
            return tag
    raise RuntimeError(f"Could not generate unique tag for username {username}")
