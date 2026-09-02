"""
Abstract Base Classes (Repository Interfaces) for Community Forum.
Adheres to Dependency Inversion (DIP) and Interface Segregation (ISP).
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from app.social.community_forum.domain.entities import (
    PostEntity,
    CommentEntity,
    ShareEntity,
    AuthorEntity,
)


class IPostRepository(ABC):
    @abstractmethod
    async def create(self, post: PostEntity) -> PostEntity:
        """Persist a new post."""
        pass

    @abstractmethod
    async def get_by_id(self, post_id: str, current_user_id: Optional[str] = None) -> Optional[PostEntity]:
        """Fetch post by its ID with author and like status."""
        pass

    @abstractmethod
    async def delete(self, post_id: str) -> bool:
        """Soft-delete or delete a post."""
        pass

    @abstractmethod
    async def list_feed(
        self,
        group_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        current_user_id: Optional[str] = None,
    ) -> List[PostEntity]:
        """Retrieve paginated community posts feed with author hydration."""
        pass

    @abstractmethod
    async def increment_like(self, post_id: str, delta: int = 1) -> int:
        """Increment/decrement post like counter atomically and return new count."""
        pass

    @abstractmethod
    async def increment_comment_count(self, post_id: str, delta: int = 1) -> int:
        """Increment/decrement post comment counter atomically."""
        pass

    @abstractmethod
    async def increment_share_count(self, post_id: str, delta: int = 1) -> int:
        """Increment post share counter atomically."""
        pass


class ICommentRepository(ABC):
    @abstractmethod
    async def create(self, comment: CommentEntity) -> CommentEntity:
        """Create and persist a comment."""
        pass

    @abstractmethod
    async def get_by_id(self, comment_id: str) -> Optional[CommentEntity]:
        """Fetch a single comment by ID."""
        pass

    @abstractmethod
    async def get_comments_for_post(
        self,
        post_id: str,
        current_user_id: Optional[str] = None,
    ) -> List[CommentEntity]:
        """Fetch all comments for a post, structured as a thread/tree with author info."""
        pass

    @abstractmethod
    async def delete(self, comment_id: str) -> bool:
        """Delete a comment."""
        pass

    @abstractmethod
    async def increment_like(self, comment_id: str, delta: int = 1) -> int:
        """Increment/decrement comment like counter."""
        pass


class IInteractionRepository(ABC):
    @abstractmethod
    async def toggle_like(self, user_id: str, target_type: str, target_id: str) -> bool:
        """Toggle like status for any polymorphic target (post, comment). Returns True if liked, False if unliked."""
        pass

    @abstractmethod
    async def has_user_liked(self, user_id: str, target_type: str, target_id: str) -> bool:
        """Check if user has liked a given entity."""
        pass

    @abstractmethod
    async def create_share(self, share: ShareEntity) -> ShareEntity:
        """Record a share interaction."""
        pass


class IUserRepository(ABC):
    @abstractmethod
    async def get_author_by_id(self, user_id: str) -> Optional[AuthorEntity]:
        """Fetch author info."""
        pass

    @abstractmethod
    async def increment_post_count(self, user_id: str, delta: int = 1) -> None:
        """Update denormalized user post counter."""
        pass
