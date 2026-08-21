"""
Pydantic schemas for Social module.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from app.auth.schemas import UserResponse


class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    event_id: str | None = None
    group_id: str | None = None


class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: str | None = None
    mentioned_user_id: str | None = None


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    author: UserResponse | None = None
    parent_comment_id: str | None = None
    mentioned_user_id: str | None = None
    content: str
    like_count: int
    created_at: datetime
    replies: list["CommentResponse"] = []

    class Config:
        from_attributes = True


class PostResponse(BaseModel):
    id: str
    user_id: str
    author: UserResponse | None = None
    group_id: str | None = None
    event_id: str | None = None
    content: str
    like_count: int
    created_at: datetime
    comment_count: int = 0
    comments: list[CommentResponse] = []

    class Config:
        from_attributes = True


class LikeToggleResponse(BaseModel):
    liked: bool
    new_like_count: int
