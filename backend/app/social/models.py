"""
SQLAlchemy models for Social module (posts, comments, likes).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base
import app.auth.models  # noqa: F401 - ensure users table is registered
import app.groups.models  # noqa: F401 - ensure groups table is registered
import app.history.models  # noqa: F401 - ensure historical_events table is registered


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True)
    event_id = Column(String, ForeignKey("historical_events.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=True)                      # <-- NEW
    content = Column(Text, nullable=False)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0, nullable=False) # <-- NEW
    share_count = Column(Integer, default=0, nullable=False)   # <-- NEW
    is_deleted = Column(Boolean, default=False, nullable=False)# <-- NEW
    is_locked = Column(Boolean, default=False, nullable=False) # <-- NEW
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True) # <-- NEW


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_comment_id = Column(String, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    mentioned_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    like_count = Column(Integer, default=0)
    is_deleted = Column(Boolean, default=False, nullable=False)# <-- NEW
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True) # <-- NEW


class Like(Base):
    __tablename__ = "likes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # 'post' or 'comment'
    target_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_user_target_like"),
    )

class Share(Base):
    __tablename__ = "shares"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # e.g. 'post'
    target_id = Column(String, nullable=False, index=True)
    share_channel = Column(String, nullable=True)  # e.g. 'twitter', 'copy_link', etc.
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
