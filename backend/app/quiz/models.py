"""
SQLAlchemy models for Quiz module (quiz_questions, quiz_attempts).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String, primary_key=True, default=generate_uuid)
    event_id = Column(String, ForeignKey("historical_events.id", ondelete="SET NULL"), nullable=True)
    topic = Column(String, nullable=False, index=True)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # JSON array of strings e.g. ["A", "B", "C", "D"]
    correct_answer = Column(Integer, nullable=False)  # Index 0..3
    difficulty = Column(String, default="medium")  # easy, medium, hard
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    question_id = Column(String, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    selected_option = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    attempted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
