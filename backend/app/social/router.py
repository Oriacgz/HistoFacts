"""
FastAPI router for Social module endpoints (posts, comments, replies, likes).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.social.schemas import (
    CreatePostRequest,
    CreateCommentRequest,
    PostResponse,
    CommentResponse,
    LikeToggleResponse,
)
from app.social.service import (
    create_post,
    get_public_feed,
    get_post_with_comments,
    add_comment,
    toggle_post_like,
)
from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.auth.models import User

router = APIRouter(prefix="/api/social", tags=["Social"])


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_new_post(
    req: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    post = await create_post(req, current_user.id, db)
    full_post = await get_post_with_comments(post.id, db)
    return full_post


@router.get("/posts", response_model=list[PostResponse])
async def get_feed(db: AsyncSession = Depends(get_async_session)):
    return await get_public_feed(db)


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post_detail(post_id: str, db: AsyncSession = Depends(get_async_session)):
    post = await get_post_with_comments(post_id, db)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_post_comment(
    post_id: str,
    req: CreateCommentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    post = await get_post_with_comments(post_id, db)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = await add_comment(post_id, req, current_user.id, db)
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        parent_comment_id=comment.parent_comment_id,
        mentioned_user_id=comment.mentioned_user_id,
        content=comment.content,
        like_count=0,
        created_at=comment.created_at,
        replies=[],
    )


@router.post("/posts/{post_id}/like", response_model=LikeToggleResponse)
async def toggle_like(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    try:
        liked, count = await toggle_post_like(post_id, current_user.id, db)
        return LikeToggleResponse(liked=liked, new_like_count=count)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
