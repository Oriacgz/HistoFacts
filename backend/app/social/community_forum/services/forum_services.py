"""
Forum Service Layer: Orchestrates business logic, permissions, and entity workflows.
Adheres to Single Responsibility (SRP) and Open/Closed (OCP) principles.
"""

from typing import Optional, List
from app.social.community_forum.domain.entities import (
    PostEntity,
    CommentEntity,
    ShareEntity,
)
from app.social.community_forum.domain.exceptions import (
    PostNotFoundError,
    CommentNotFoundError,
    UnauthorizedPostActionError,
    UnauthorizedCommentActionError,
    PostLockedError,
    UserBannedError,
)
from app.social.community_forum.repositories.base import (
    IPostRepository,
    ICommentRepository,
    IInteractionRepository,
    IUserRepository,
)


class ForumService:
    def __init__(
        self,
        post_repo: IPostRepository,
        comment_repo: ICommentRepository,
        interaction_repo: IInteractionRepository,
        user_repo: Optional[IUserRepository] = None,
    ):
        self._post_repo = post_repo
        self._comment_repo = comment_repo
        self._interaction_repo = interaction_repo
        self._user_repo = user_repo

    async def create_post(
        self,
        user_id: str,
        content: str,
        title: Optional[str] = None,
        group_id: Optional[str] = None,
        event_id: Optional[str] = None,
    ) -> PostEntity:
        if self._user_repo:
            author = await self._user_repo.get_author_by_id(user_id)
            if author and author.is_banned:
                raise UserBannedError(user_id)

        post = PostEntity(
            user_id=user_id,
            title=title,
            content=content,
            group_id=group_id,
            event_id=event_id,
        )
        created_post = await self._post_repo.create(post)

        if self._user_repo:
            await self._user_repo.increment_post_count(user_id, 1)

        return created_post

    async def get_feed(
        self,
        group_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        current_user_id: Optional[str] = None,
    ) -> List[PostEntity]:
        return await self._post_repo.list_feed(
            group_id=group_id,
            limit=limit,
            offset=offset,
            current_user_id=current_user_id,
        )

    async def get_post_detail(
        self,
        post_id: str,
        current_user_id: Optional[str] = None,
    ) -> PostEntity:
        post = await self._post_repo.get_by_id(post_id, current_user_id=current_user_id)
        if not post:
            raise PostNotFoundError(post_id)

        comments = await self._comment_repo.get_comments_for_post(
            post_id=post_id,
            current_user_id=current_user_id,
        )
        post.comments = comments
        return post

    async def delete_post(
        self,
        post_id: str,
        requesting_user_id: str,
        is_admin: bool = False,
    ) -> None:
        post = await self._post_repo.get_by_id(post_id)
        if not post:
            raise PostNotFoundError(post_id)

        if not post.can_be_deleted_by(requesting_user_id, is_admin=is_admin):
            raise UnauthorizedPostActionError("delete")

        await self._post_repo.delete(post_id)

        if self._user_repo:
            await self._user_repo.increment_post_count(post.user_id, -1)

    async def add_comment(
        self,
        post_id: str,
        user_id: str,
        content: str,
        parent_comment_id: Optional[str] = None,
        mentioned_user_id: Optional[str] = None,
    ) -> CommentEntity:
        if self._user_repo:
            author = await self._user_repo.get_author_by_id(user_id)
            if author and author.is_banned:
                raise UserBannedError(user_id)

        post = await self._post_repo.get_by_id(post_id)
        if not post:
            raise PostNotFoundError(post_id)

        if not post.can_be_commented_on():
            raise PostLockedError(post_id)

        if parent_comment_id:
            parent = await self._comment_repo.get_by_id(parent_comment_id)
            if not parent or parent.post_id != post_id:
                raise CommentNotFoundError(parent_comment_id)

        comment = CommentEntity(
            post_id=post_id,
            user_id=user_id,
            content=content,
            parent_comment_id=parent_comment_id,
            mentioned_user_id=mentioned_user_id,
        )
        created_comment = await self._comment_repo.create(comment)
        await self._post_repo.increment_comment_count(post_id, 1)

        return created_comment

    async def delete_comment(
        self,
        comment_id: str,
        requesting_user_id: str,
        is_admin: bool = False,
    ) -> None:
        comment = await self._comment_repo.get_by_id(comment_id)
        if not comment:
            raise CommentNotFoundError(comment_id)

        if not comment.can_be_deleted_by(requesting_user_id, is_admin=is_admin):
            raise UnauthorizedCommentActionError("delete")

        await self._comment_repo.delete(comment_id)
        await self._post_repo.increment_comment_count(comment.post_id, -1)

    async def toggle_post_like(self, post_id: str, user_id: str) -> tuple[bool, int]:
        post = await self._post_repo.get_by_id(post_id)
        if not post:
            raise PostNotFoundError(post_id)

        is_liked = await self._interaction_repo.toggle_like(
            user_id=user_id,
            target_type="post",
            target_id=post_id,
        )
        delta = 1 if is_liked else -1
        new_count = await self._post_repo.increment_like(post_id, delta)
        return is_liked, new_count

    async def toggle_comment_like(self, comment_id: str, user_id: str) -> tuple[bool, int]:
        comment = await self._comment_repo.get_by_id(comment_id)
        if not comment:
            raise CommentNotFoundError(comment_id)

        is_liked = await self._interaction_repo.toggle_like(
            user_id=user_id,
            target_type="comment",
            target_id=comment_id,
        )
        delta = 1 if is_liked else -1
        new_count = await self._comment_repo.increment_like(comment_id, delta)
        return is_liked, new_count

    async def share_post(
        self,
        post_id: str,
        user_id: str,
        share_channel: Optional[str] = None,
        caption: Optional[str] = None,
    ) -> tuple[ShareEntity, int]:
        post = await self._post_repo.get_by_id(post_id)
        if not post:
            raise PostNotFoundError(post_id)

        share = ShareEntity(
            post_id=post_id,
            user_id=user_id,
            target_type="post",
            share_channel=share_channel,
            caption=caption,
        )
        created_share = await self._interaction_repo.create_share(share)
        new_share_count = await self._post_repo.increment_share_count(post_id, 1)

        return created_share, new_share_count
