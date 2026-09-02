"""
Concrete SQLAlchemy implementations of the forum repository interfaces.
Provides clean async DB operations and maps ORM models to domain entities.
"""

from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete as sql_delete, func, and_

from app.social.models import Post as PostModel, Comment as CommentModel, Like as LikeModel, Share as ShareModel
from app.auth.models import User as UserModel
from app.social.community_forum.domain.entities import (
    PostEntity,
    CommentEntity,
    ShareEntity,
    AuthorEntity,
)
from app.social.community_forum.repositories.base import (
    IPostRepository,
    ICommentRepository,
    IInteractionRepository,
    IUserRepository,
)


def _to_author_entity(user: UserModel) -> AuthorEntity:
    return AuthorEntity(
        id=user.id,
        username=user.username,
        tag=user.tag,
        avatar_url=user.avatar_url,
        bio=getattr(user, "bio", None),
        is_banned=getattr(user, "is_banned", False),
    )


class SQLAlchemyUserRepository(IUserRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_author_by_id(self, user_id: str) -> Optional[AuthorEntity]:
        res = await self._session.execute(select(UserModel).where(UserModel.id == user_id))
        user = res.scalar_one_or_none()
        return _to_author_entity(user) if user else None

    async def increment_post_count(self, user_id: str, delta: int = 1) -> None:
        await self._session.execute(
            update(UserModel)
            .where(UserModel.id == user_id)
            .values(post_count=func.greatest(0, UserModel.post_count + delta))
        )
        await self._session.commit()


class SQLAlchemyPostRepository(IPostRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, post: PostEntity) -> PostEntity:
        model = PostModel(
            user_id=post.user_id,
            group_id=post.group_id,
            event_id=post.event_id,
            title=post.title,
            content=post.content,
            like_count=post.like_count,
            comment_count=post.comment_count,
            share_count=post.share_count,
            is_deleted=post.is_deleted,
            is_locked=post.is_locked,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)

        post.id = model.id
        post.created_at = model.created_at

        # Hydrate author
        u_res = await self._session.execute(select(UserModel).where(UserModel.id == post.user_id))
        user = u_res.scalar_one_or_none()
        if user:
            post.author = _to_author_entity(user)

        return post

    async def get_by_id(self, post_id: str, current_user_id: Optional[str] = None) -> Optional[PostEntity]:
        res = await self._session.execute(
            select(PostModel).where(PostModel.id == post_id, PostModel.is_deleted.is_(False))
        )
        model = res.scalar_one_or_none()
        if not model:
            return None

        # Hydrate author
        u_res = await self._session.execute(select(UserModel).where(UserModel.id == model.user_id))
        user = u_res.scalar_one_or_none()
        author = _to_author_entity(user) if user else None

        # Check liked status
        has_liked = False
        if current_user_id:
            like_res = await self._session.execute(
                select(LikeModel.id).where(
                    LikeModel.user_id == current_user_id,
                    LikeModel.target_type == "post",
                    LikeModel.target_id == post_id,
                )
            )
            has_liked = like_res.scalar_one_or_none() is not None

        return PostEntity(
            id=model.id,
            user_id=model.user_id,
            group_id=model.group_id,
            event_id=model.event_id,
            title=model.title,
            content=model.content,
            like_count=model.like_count or 0,
            comment_count=model.comment_count or 0,
            share_count=model.share_count or 0,
            is_deleted=model.is_deleted,
            is_locked=model.is_locked,
            author=author,
            has_liked=has_liked,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def delete(self, post_id: str) -> bool:
        # Soft delete to preserve thread audit trails and maintain performance
        res = await self._session.execute(
            update(PostModel)
            .where(PostModel.id == post_id)
            .values(is_deleted=True)
        )
        await self._session.commit()
        return res.rowcount > 0

    async def list_feed(
        self,
        group_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        current_user_id: Optional[str] = None,
    ) -> List[PostEntity]:
        stmt = (
            select(PostModel, UserModel)
            .join(UserModel, PostModel.user_id == UserModel.id)
            .where(PostModel.is_deleted.is_(False))
        )

        if group_id:
            stmt = stmt.where(PostModel.group_id == group_id)
        else:
            stmt = stmt.where(PostModel.group_id.is_(None))

        stmt = stmt.order_by(PostModel.created_at.desc()).limit(limit).offset(offset)
        res = await self._session.execute(stmt)
        rows = res.all()

        if not rows:
            return []

        post_ids = [p.id for p, _ in rows]
        user_liked_set = set()
        if current_user_id:
            liked_res = await self._session.execute(
                select(LikeModel.target_id).where(
                    LikeModel.user_id == current_user_id,
                    LikeModel.target_type == "post",
                    LikeModel.target_id.in_(post_ids),
                )
            )
            user_liked_set = set(liked_res.scalars().all())

        entities = []
        for post_model, user_model in rows:
            entities.append(
                PostEntity(
                    id=post_model.id,
                    user_id=post_model.user_id,
                    group_id=post_model.group_id,
                    event_id=post_model.event_id,
                    title=post_model.title,
                    content=post_model.content,
                    like_count=post_model.like_count or 0,
                    comment_count=post_model.comment_count or 0,
                    share_count=post_model.share_count or 0,
                    is_deleted=post_model.is_deleted,
                    is_locked=post_model.is_locked,
                    author=_to_author_entity(user_model) if user_model else None,
                    has_liked=post_model.id in user_liked_set,
                    created_at=post_model.created_at,
                    updated_at=post_model.updated_at,
                )
            )
        return entities

    async def increment_like(self, post_id: str, delta: int = 1) -> int:
        await self._session.execute(
            update(PostModel)
            .where(PostModel.id == post_id)
            .values(like_count=func.greatest(0, PostModel.like_count + delta))
        )
        await self._session.commit()
        res = await self._session.execute(select(PostModel.like_count).where(PostModel.id == post_id))
        return res.scalar_one_or_none() or 0

    async def increment_comment_count(self, post_id: str, delta: int = 1) -> int:
        await self._session.execute(
            update(PostModel)
            .where(PostModel.id == post_id)
            .values(comment_count=func.greatest(0, PostModel.comment_count + delta))
        )
        await self._session.commit()
        res = await self._session.execute(select(PostModel.comment_count).where(PostModel.id == post_id))
        return res.scalar_one_or_none() or 0

    async def increment_share_count(self, post_id: str, delta: int = 1) -> int:
        await self._session.execute(
            update(PostModel)
            .where(PostModel.id == post_id)
            .values(share_count=func.greatest(0, PostModel.share_count + delta))
        )
        await self._session.commit()
        res = await self._session.execute(select(PostModel.share_count).where(PostModel.id == post_id))
        return res.scalar_one_or_none() or 0


class SQLAlchemyCommentRepository(ICommentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, comment: CommentEntity) -> CommentEntity:
        model = CommentModel(
            post_id=comment.post_id,
            user_id=comment.user_id,
            parent_comment_id=comment.parent_comment_id,
            mentioned_user_id=comment.mentioned_user_id,
            content=comment.content,
            like_count=comment.like_count,
            is_deleted=comment.is_deleted,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)

        comment.id = model.id
        comment.created_at = model.created_at

        # Hydrate author
        u_res = await self._session.execute(select(UserModel).where(UserModel.id == comment.user_id))
        user = u_res.scalar_one_or_none()
        if user:
            comment.author = _to_author_entity(user)

        return comment

    async def get_by_id(self, comment_id: str) -> Optional[CommentEntity]:
        res = await self._session.execute(
            select(CommentModel).where(CommentModel.id == comment_id, CommentModel.is_deleted.is_(False))
        )
        model = res.scalar_one_or_none()
        if not model:
            return None

        u_res = await self._session.execute(select(UserModel).where(UserModel.id == model.user_id))
        user = u_res.scalar_one_or_none()

        return CommentEntity(
            id=model.id,
            post_id=model.post_id,
            user_id=model.user_id,
            parent_comment_id=model.parent_comment_id,
            mentioned_user_id=model.mentioned_user_id,
            content=model.content,
            like_count=model.like_count or 0,
            is_deleted=model.is_deleted,
            author=_to_author_entity(user) if user else None,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_comments_for_post(
        self,
        post_id: str,
        current_user_id: Optional[str] = None,
    ) -> List[CommentEntity]:
        stmt = (
            select(CommentModel, UserModel)
            .join(UserModel, CommentModel.user_id == UserModel.id)
            .where(CommentModel.post_id == post_id, CommentModel.is_deleted.is_(False))
            .order_by(CommentModel.created_at.asc())
        )
        res = await self._session.execute(stmt)
        rows = res.all()

        if not rows:
            return []

        comment_ids = [c.id for c, _ in rows]
        user_liked_set = set()
        if current_user_id:
            liked_res = await self._session.execute(
                select(LikeModel.target_id).where(
                    LikeModel.user_id == current_user_id,
                    LikeModel.target_type == "comment",
                    LikeModel.target_id.in_(comment_ids),
                )
            )
            user_liked_set = set(liked_res.scalars().all())

        # Map to flat dictionary and build tree
        entity_map: Dict[str, CommentEntity] = {}
        top_level: List[CommentEntity] = []

        for c_model, u_model in rows:
            entity = CommentEntity(
                id=c_model.id,
                post_id=c_model.post_id,
                user_id=c_model.user_id,
                parent_comment_id=c_model.parent_comment_id,
                mentioned_user_id=c_model.mentioned_user_id,
                content=c_model.content,
                like_count=c_model.like_count or 0,
                is_deleted=c_model.is_deleted,
                author=_to_author_entity(u_model) if u_model else None,
                has_liked=c_model.id in user_liked_set,
                created_at=c_model.created_at,
                updated_at=c_model.updated_at,
                replies=[],
            )
            entity_map[c_model.id] = entity

        # Assemble parent-child tree
        for entity in entity_map.values():
            if entity.parent_comment_id and entity.parent_comment_id in entity_map:
                entity_map[entity.parent_comment_id].replies.append(entity)
            else:
                top_level.append(entity)

        return top_level

    async def delete(self, comment_id: str) -> bool:
        res = await self._session.execute(
            update(CommentModel)
            .where(CommentModel.id == comment_id)
            .values(is_deleted=True)
        )
        await self._session.commit()
        return res.rowcount > 0

    async def increment_like(self, comment_id: str, delta: int = 1) -> int:
        await self._session.execute(
            update(CommentModel)
            .where(CommentModel.id == comment_id)
            .values(like_count=func.greatest(0, CommentModel.like_count + delta))
        )
        await self._session.commit()
        res = await self._session.execute(select(CommentModel.like_count).where(CommentModel.id == comment_id))
        return res.scalar_one_or_none() or 0


class SQLAlchemyInteractionRepository(IInteractionRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def toggle_like(self, user_id: str, target_type: str, target_id: str) -> bool:
        stmt = select(LikeModel).where(
            LikeModel.user_id == user_id,
            LikeModel.target_type == target_type,
            LikeModel.target_id == target_id,
        )
        res = await self._session.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            await self._session.delete(existing)
            await self._session.commit()
            return False
        else:
            new_like = LikeModel(user_id=user_id, target_type=target_type, target_id=target_id)
            self._session.add(new_like)
            await self._session.commit()
            return True

    async def has_user_liked(self, user_id: str, target_type: str, target_id: str) -> bool:
        stmt = select(LikeModel.id).where(
            LikeModel.user_id == user_id,
            LikeModel.target_type == target_type,
            LikeModel.target_id == target_id,
        )
        res = await self._session.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def create_share(self, share: ShareEntity) -> ShareEntity:
        model = ShareModel(
            user_id=share.user_id,
            target_type=share.target_type,
            target_id=share.post_id,
            share_channel=share.share_channel,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)

        share.id = model.id
        share.created_at = model.created_at
        return share
