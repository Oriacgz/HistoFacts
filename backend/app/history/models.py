"""
SQLAlchemy models for History module (historical_events, bookmarks).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class HistoricalEvent(Base):
    __tablename__ = "historical_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    date = Column(String, nullable=False, index=True)  # Format: MM-DD (e.g. "03-17") or YYYY-MM-DD
    year = Column(String, nullable=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String, default="General", index=True)
    country = Column(String, nullable=True, index=True)
    source = Column(String, default="Wikimedia")
    source_url = Column(String, nullable=True)
    synced_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_event_date_category", "date", "category"),
    )


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    event_id = Column(String, ForeignKey("historical_events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_user_event_bookmark"),
    )
