"""
Domain entities for Community Forum using pure Python dataclasses.
Encapsulates business rules and entity invariants independent of ORM.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List


class PostVisibility(str, Enum):
    PUBLIC = "public"
    GROUP_ONLY = "group_only"
    PRIVATE = "private"


@dataclass
class AuthorEntity:
    id: str
    username: str
    tag: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_banned: bool = False

    @property
    def display_tag(self) -> str:
        return f"{self.username}#{self.tag}"


@dataclass
class CommentEntity:
    post_id: str
    user_id: str
    content: str
    id: Optional[str] = None
    parent_comment_id: Optional[str] = None
    mentioned_user_id: Optional[str] = None
    like_count: int = 0
    is_deleted: bool = False
    author: Optional[AuthorEntity] = None
    replies: List["CommentEntity"] = field(default_factory=list)
    has_liked: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

    def can_be_deleted_by(self, user_id: str, is_admin: bool = False) -> bool:
        """Domain logic: Author or admin can delete a comment."""
        return is_admin or self.user_id == user_id


@dataclass
class PostEntity:
    user_id: str
    content: str
    id: Optional[str] = None
    title: Optional[str] = None
    group_id: Optional[str] = None
    event_id: Optional[str] = None
    visibility: PostVisibility = PostVisibility.PUBLIC
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    is_deleted: bool = False
    is_locked: bool = False
    author: Optional[AuthorEntity] = None
    comments: List[CommentEntity] = field(default_factory=list)
    has_liked: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

    def can_be_deleted_by(self, user_id: str, is_admin: bool = False) -> bool:
        """Domain logic: Check if the user is authorized to delete the post."""
        return is_admin or self.user_id == user_id

    def can_be_commented_on(self) -> bool:
        """Domain logic: Locked or deleted posts cannot receive new comments."""
        return not self.is_deleted and not self.is_locked


@dataclass
class ShareEntity:
    post_id: str
    user_id: str
    id: Optional[str] = None
    target_type: str = "post"
    share_channel: Optional[str] = None
    caption: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class LikeEntity:
    user_id: str
    target_id: str
    target_type: str = "post"
    id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
