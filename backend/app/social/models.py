"""
SQLAlchemy models for Social module (posts, comments, likes).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True)
    event_id = Column(String, ForeignKey("historical_events.id", ondelete="SET NULL"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_comment_id = Column(String, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    mentioned_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Like(Base):
    __tablename__ = "likes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    comment_id = Column(String, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_like"),
        UniqueConstraint("user_id", "comment_id", name="uq_user_comment_like"),
    )
