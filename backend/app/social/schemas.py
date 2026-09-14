"""
Pydantic schemas for Social module.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class UserSummaryResponse(BaseModel):
    """Minimal user data for display — mirrors UserSummaryCache."""
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    username: str
    tag: str
    avatar_url: str | None = None
    bio: str | None = None
    is_banned: bool = False


class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    event_id: str | None = None
    group_id: str | None = None


class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: str | None = None
    mentioned_user_id: str | None = None


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    post_id: str
    user_id: str
    author: UserSummaryResponse | None = None
    parent_comment_id: str | None = None
    mentioned_user_id: str | None = None
    content: str
    like_count: int
    created_at: datetime
    replies: list["CommentResponse"] = []


class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    author: UserSummaryResponse | None = None
    group_id: str | None = None
    event_id: str | None = None
    content: str
    like_count: int
    created_at: datetime
    comment_count: int = 0
    comments: list[CommentResponse] = []


class LikeToggleResponse(BaseModel):
    liked: bool
    new_like_count: int
