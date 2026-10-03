"""
FastAPI router for Social module endpoints (posts, comments, replies, likes, shares, internal purge/export).
Integrates with the OOP Community Forum service.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_async_session
from app.core.deps import verify_internal_service_secret
from app.social.community_forum.routes import router as forum_router
from app.social.community_forum.datatransferobjects.schemas import GifDTO
from app.social.models import UserSummaryCache, Post, Comment

router = APIRouter()
router.include_router(forum_router)


gif_router = APIRouter(prefix="/api/social/gifs", tags=["Community Forum"])


@gif_router.get("")
async def search_gifs(
    query: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(20, ge=1, le=50),
) -> list[GifDTO]:
    """Proxy Tenor GIF search so the API key stays server-side.
    Shared by community comments and chat — the single GIF integration in the app."""
    if not settings.tenor_api_key:
        raise HTTPException(status_code=503, detail="GIF search is not configured (missing TENOR_API_KEY)")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://tenor.googleapis.com/v2/search",
                params={
                    "q": query,
                    "key": settings.tenor_api_key,
                    "client_key": "histofacts",
                    "limit": limit,
                    "media_filter": "gif,tinygif",
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"GIF provider error: {exc.response.status_code}")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="GIF provider unreachable")

    results = []
    for item in resp.json().get("results", []):
        formats = item.get("media_formats", {})
        gif_url = formats.get("gif", {}).get("url")
        preview_url = formats.get("tinygif", {}).get("url")
        if gif_url and preview_url:
            results.append(GifDTO(id=str(item["id"]), url=gif_url, preview_url=preview_url))
    return results


# Include AFTER the GIF route is registered — include_router copies routes at call time
router.include_router(gif_router)


@router.post(
    "/internal/users/{user_id}/purge",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def purge_user_social(user_id: str, db: AsyncSession = Depends(get_async_session)):
    """Anonymize authorship so post/comment threads remain intact."""
    await db.execute(
        update(UserSummaryCache)
        .where(UserSummaryCache.user_id == user_id)
        .values(username="Deleted User", bio=None, avatar_url=None, avatar_seed=None)
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
