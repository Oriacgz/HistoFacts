"""
SQLAlchemy models for Groups module (groups, group_members).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String, nullable=False, default="member")  # admin, member
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
