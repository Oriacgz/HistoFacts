"""
SQLAlchemy models for AI Notes module (notes, group_shared_notes).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String, ForeignKey("historical_events.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    curriculum_tag = Column(String, nullable=True)  # e.g. "NCERT Class 10", "UPSC GS I"
    is_ai_generated = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GroupSharedNote(Base):
    __tablename__ = "group_shared_notes"

    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    note_id = Column(String, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True)
    shared_by = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
