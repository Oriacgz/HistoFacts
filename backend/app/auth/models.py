"""
SQLAlchemy models for Auth and Identity module (users, friends).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, nullable=False, index=True)
    tag = Column(String(4), nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    preferences = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("username", "tag", name="uq_username_tag"),
    )

    @property
    def display_tag(self) -> str:
        return f"{self.username}#{self.tag}"


class Friend(Base):
    __tablename__ = "friends"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    friend_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status = Column(String, nullable=False, default="pending")  # pending, accepted, blocked
    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
