"""
SQLAlchemy models for Auth and Identity module (users, friends, presence).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint, JSON, Integer, Boolean, Enum, func
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
    bio = Column(Text, nullable=True)
    post_count = Column(Integer, default=0, nullable=False)
    is_banned = Column(Boolean, default=False, nullable=False)
    banned_at = Column(DateTime(timezone=True), nullable=True)
    country_code = Column(String(2), nullable=True)                          # ISO 3166-1 alpha-2
    pronouns = Column(String(20), nullable=True)
    timezone = Column(String(50), nullable=False, default="UTC")             # IANA name
    show_online_status = Column(Boolean, nullable=False, default=True)
    preferences = Column(JSON, default=dict)
    profile_visibility = Column(Enum("public", "friends_only", "private", name="visibility"), default="public", nullable=False)
    deletion_scheduled_at = Column(DateTime(timezone=True), nullable=True)
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
    status = Column(Enum("pending", "accepted", "blocked", name="friend_status"), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_requester_addressee"),
    )


class UserPresence(Base):
    __tablename__ = "user_presence"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_hash = Column(String, nullable=False, index=True)
    device_label = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_active_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class TwoFactorAuth(Base):
    __tablename__ = "two_factor_auth"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    totp_secret_encrypted = Column(String, nullable=False)
    enabled = Column(Boolean, default=False, nullable=False)
    backup_codes_hashed = Column(JSON, nullable=False, default=list)
