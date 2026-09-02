"""
SQLAlchemy models for Auth and Identity module (users, friends, presence).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

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

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    requester_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    addressee_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum("pending", "accepted", name="friend_status"), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_requester_addressee"),
    )


class UserPresence(Base):
    __tablename__ = "user_presence"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
