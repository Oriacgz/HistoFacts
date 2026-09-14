"""
FastAPI router for Social module endpoints (posts, comments, replies, likes, shares, internal purge/export).
Integrates with the OOP Community Forum service.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session
from app.core.deps import verify_internal_service_secret
from app.social.community_forum.routes import router as forum_router
from app.social.models import UserSummaryCache, Post, Comment

router = APIRouter()
router.include_router(forum_router)


@router.post(
    "/internal/users/{user_id}/purge",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def purge_user_social(user_id: str, db: AsyncSession = Depends(get_async_session)):
    """Anonymize authorship so post/comment threads remain intact."""
    await db.execute(
        update(UserSummaryCache)
        .where(UserSummaryCache.user_id == user_id)
        .values(username="Deleted User", bio=None, avatar_url=None)
    )
    await db.commit()
    return {"status": "purged", "service": "social"}


@router.get(
    "/internal/users/{user_id}/export",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def export_user_social(user_id: str, db: AsyncSession = Depends(get_async_session)):
    posts_res = await db.execute(select(Post).where(Post.user_id == user_id))
    comments_res = await db.execute(select(Comment).where(Comment.user_id == user_id))
    return {
        "posts": [
            {"id": p.id, "title": p.title, "content": p.content, "created_at": str(p.created_at)}
            for p in posts_res.scalars().all()
        ],
        "comments": [
            {"id": c.id, "content": c.content, "created_at": str(c.created_at)}
            for c in comments_res.scalars().all()
        ],
    }
