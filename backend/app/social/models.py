"""
SQLAlchemy models for Social module (posts, comments, likes).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, JSON, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    group_id = Column(String, nullable=True, index=True)
    event_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    media_urls = Column(JSON, nullable=True)   # up to 4 image URLs, or exactly 1 video URL
    media_type = Column(Enum("none", "image", "video", name="post_media_type"), nullable=False, default="none")
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0, nullable=False)
    share_count = Column(Integer, default=0, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    parent_comment_id = Column(String, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    mentioned_user_id = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    media_url = Column(String, nullable=True)   # single image or GIF URL (e.g. from Tenor search)
    like_count = Column(Integer, default=0)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True)


class PostVote(Base):
    """Reddit-style upvote/downvote. value is +1 or -1; score is the sum over all votes."""

    __tablename__ = "post_votes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_vote"),
    )


class Like(Base):
    __tablename__ = "likes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_user_target_like"),
    )


class Share(Base):
    __tablename__ = "shares"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False, index=True)
    share_channel = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserSummaryCache(Base):
    """Read-only local cache of user display data — populated from Auth service API."""
    __tablename__ = "social_user_summary_cache"

    user_id = Column(String, primary_key=True)
    username = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    avatar_seed = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    is_banned = Column(Boolean, default=False, nullable=False)
    synced_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
