"""
SQLAlchemy models for Notification Microservice.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, Index, JSON
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


NOTIFICATION_TYPES = (
    "friend_request",
    "friend_request_accepted",
    "comment_reply",
    "group_invite",
    "note_ready",
    "quiz_lobby_invite",
)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(
        Enum(*NOTIFICATION_TYPES, name="notification_type", native_enum=False),
        nullable=False,
    )
    payload = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read", "created_at"),
    )
