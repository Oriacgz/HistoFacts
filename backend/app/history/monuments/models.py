from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String
from app.core.database import Base


class MonumentFavorite(Base):
    __tablename__ = "monument_favorites"
    # Match the existing History bookmark boundary: JWT ownership without an
    # identity-table foreign key across independently running services.
    user_id = Column(String, primary_key=True)
    monument_id = Column(String(64), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class MonumentTourCompletion(Base):
    __tablename__ = "monument_tour_completions"
    user_id = Column(String, primary_key=True)
    monument_id = Column(String(64), primary_key=True)
    tour_revision = Column(Integer, primary_key=True)
    completed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
