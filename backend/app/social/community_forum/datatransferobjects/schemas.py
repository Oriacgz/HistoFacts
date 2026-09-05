"""
Data Transfer Objects (DTOs) and Pydantic Schemas for Community Forum API.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AuthorDTO(BaseModel):
    id: str
    username: str
    tag: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

    model_config = {"from_attributes": True}


class CreatePostDTO(BaseModel):
    title: Optional[str] = Field(None, max_length=200, description="Optional thread headline")
    content: str = Field(..., min_length=1, max_length=5000, description="Post body")
    group_id: Optional[str] = None
    event_id: Optional[str] = None


class CommentResponseDTO(BaseModel):
    id: str
    post_id: str
    user_id: str
    author: Optional[AuthorDTO] = None
    parent_comment_id: Optional[str] = None
    mentioned_user_id: Optional[str] = None
    content: str
    like_count: int = 0
    has_liked: bool = False
    is_deleted: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    replies: List["CommentResponseDTO"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PostResponseDTO(BaseModel):
    id: str
    user_id: str
    author: Optional[AuthorDTO] = None
    group_id: Optional[str] = None
    event_id: Optional[str] = None
    title: Optional[str] = None
    content: str
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    has_liked: bool = False
    is_deleted: bool = False
    is_locked: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    comments: List[CommentResponseDTO] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class CreateCommentDTO(BaseModel):
    content: str = Field(..., min_length=1, max_length=1500)
    parent_comment_id: Optional[str] = None
    mentioned_user_id: Optional[str] = None


class SharePostDTO(BaseModel):
    share_channel: Optional[str] = Field(None, description="e.g. copy_link, twitter, whatsapp")
    caption: Optional[str] = Field(None, max_length=500)


class LikeToggleResponseDTO(BaseModel):
    liked: bool
    new_like_count: int


class ShareResponseDTO(BaseModel):
    id: str
    post_id: str
    user_id: str
    share_channel: Optional[str] = None
    new_share_count: int
