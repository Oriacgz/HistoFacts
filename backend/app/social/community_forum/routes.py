"""
FastAPI Routes for Community Forum Service.
Exposes RESTful endpoints utilizing OOP services, DTOs, and Dependency Injection.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user, get_optional_current_user
from app.auth.models import User
from app.social.community_forum.datatransferobjects.schemas import (
    CreatePostDTO,
    PostResponseDTO,
    CreateCommentDTO,
    CommentResponseDTO,
    SharePostDTO,
    LikeToggleResponseDTO,
    ShareResponseDTO,
)
from app.social.community_forum.services.forum_services import ForumService
from app.social.community_forum.repositories.sqlalchemy_repo import (
    SQLAlchemyPostRepository,
    SQLAlchemyCommentRepository,
    SQLAlchemyInteractionRepository,
    SQLAlchemyUserRepository,
)
from app.social.community_forum.domain.exceptions import (
    PostNotFoundError,
    CommentNotFoundError,
    UnauthorizedPostActionError,
    UnauthorizedCommentActionError,
    PostLockedError,
    UserBannedError,
)

router = APIRouter(prefix="/api/social/posts", tags=["Community Forum"])


def get_forum_service(db: AsyncSession = Depends(get_async_session)) -> ForumService:
    """Dependency Provider for ForumService."""
    post_repo = SQLAlchemyPostRepository(db)
    comment_repo = SQLAlchemyCommentRepository(db)
    interaction_repo = SQLAlchemyInteractionRepository(db)
    user_repo = SQLAlchemyUserRepository(db)
    return ForumService(
        post_repo=post_repo,
        comment_repo=comment_repo,
        interaction_repo=interaction_repo,
        user_repo=user_repo,
    )


@router.post("/", response_model=PostResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_post(
    dto: CreatePostDTO,
    current_user: User = Depends(get_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        entity = await service.create_post(
            user_id=current_user.id,
            content=dto.content,
            title=dto.title,
            group_id=dto.group_id,
            event_id=dto.event_id,
        )
        return entity
    except UserBannedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/", response_model=List[PostResponseDTO])
async def get_feed(
    group_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    service: ForumService = Depends(get_forum_service),
):
    current_user_id = current_user.id if current_user else None
    return await service.get_feed(
        group_id=group_id,
        limit=limit,
        offset=offset,
        current_user_id=current_user_id,
    )


@router.get("/{post_id}", response_model=PostResponseDTO)
async def get_post_detail(
    post_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        current_user_id = current_user.id if current_user else None
        return await service.get_post_detail(post_id=post_id, current_user_id=current_user_id)
    except PostNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        await service.delete_post(post_id=post_id, requesting_user_id=current_user.id)
    except PostNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    except UnauthorizedPostActionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this post")


@router.post("/{post_id}/comments", response_model=CommentResponseDTO, status_code=status.HTTP_201_CREATED)
async def add_comment(
    post_id: str,
    dto: CreateCommentDTO,
    current_user: User = Depends(get_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        comment = await service.add_comment(
            post_id=post_id,
            user_id=current_user.id,
            content=dto.content,
            parent_comment_id=dto.parent_comment_id,
            mentioned_user_id=dto.mentioned_user_id,
        )
        return comment
    except PostNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    except CommentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")
    except PostLockedError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post is locked for comments")
    except UserBannedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    post_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        await service.delete_comment(comment_id=comment_id, requesting_user_id=current_user.id)
    except CommentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    except UnauthorizedCommentActionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")


@router.post("/{post_id}/like", response_model=LikeToggleResponseDTO)
async def toggle_post_like(
    post_id: str,
    current_user: User = Depends(get_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        liked, new_count = await service.toggle_post_like(post_id=post_id, user_id=current_user.id)
        return LikeToggleResponseDTO(liked=liked, new_like_count=new_count)
    except PostNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")


@router.post("/{post_id}/share", response_model=ShareResponseDTO)
async def share_post(
    post_id: str,
    dto: SharePostDTO,
    current_user: User = Depends(get_current_user),
    service: ForumService = Depends(get_forum_service),
):
    try:
        share_entity, new_count = await service.share_post(
            post_id=post_id,
            user_id=current_user.id,
            share_channel=dto.share_channel,
            caption=dto.caption,
        )
        return ShareResponseDTO(
            id=share_entity.id,
            post_id=post_id,
            user_id=current_user.id,
            share_channel=dto.share_channel,
            new_share_count=new_count,
        )
    except PostNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
