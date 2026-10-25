"""
Data Transfer Objects (DTOs) and Pydantic Schemas for Community Forum API.
"""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, model_validator


class AuthorDTO(BaseModel):
    id: str
    username: str
    tag: str
    avatar_url: Optional[str] = None
    avatar_seed: Optional[str] = None
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
    media_url: Optional[str] = None
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
    media_urls: Optional[List[str]] = None
    media_type: str = "none"
    likes: int = 0
    dislikes: int = 0
    user_reaction: Optional[str] = None
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
    content: str = Field(default="", max_length=1500)
    media_url: Optional[str] = Field(None, max_length=2048, description="Single image/GIF URL (e.g. from Tenor search)")
    parent_comment_id: Optional[str] = None
    mentioned_user_id: Optional[str] = None

    @model_validator(mode="after")
    def require_content_or_media(self):
        if not self.content.strip() and not self.media_url:
            raise ValueError("Comment requires text or media")
        if self.media_url and not self.media_url.startswith(("http://", "https://")):
            raise ValueError("media_url must be an absolute http(s) URL")
        return self


class SharePostDTO(BaseModel):
    share_channel: Optional[str] = Field(None, description="e.g. copy_link, twitter, whatsapp")
    caption: Optional[str] = Field(None, max_length=500)


class LikeToggleResponseDTO(BaseModel):
    liked: bool
    new_like_count: int


class ReactionPostDTO(BaseModel):
    reaction: Literal["like", "dislike", "none"]


class ReactionResponseDTO(BaseModel):
    likes: int
    dislikes: int
    user_reaction: Optional[str] = None


class GifDTO(BaseModel):
    id: str
    url: str
    preview_url: str


class ShareResponseDTO(BaseModel):
    id: str
    post_id: str
    user_id: str
    share_channel: Optional[str] = None
    new_share_count: int
