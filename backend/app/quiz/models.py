"""
SQLAlchemy models for Quiz module (quiz_questions, quiz_attempts, quiz_sessions).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Text, Integer, DateTime, ForeignKey, JSON, UniqueConstraint

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String, primary_key=True, default=generate_uuid)
    event_id = Column(String, nullable=True, index=True)
    topic = Column(String, nullable=False, index=True)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)
    correct_answer = Column(Integer, nullable=False)
    difficulty = Column(String().evaluates_none(), default="medium")
    is_global_pool = Column(Boolean, nullable=False, default=False)
    global_period = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    question_id = Column(String, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    selected_option = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    attempted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class QuizSessionRecord(Base):
    __tablename__ = "quiz_sessions"
    __table_args__ = (UniqueConstraint("user_id", "global_period", name="uq_quiz_user_period"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    quiz_type = Column(String, nullable=False, index=True)
    topic = Column(String, nullable=False)
    difficulty = Column(String().evaluates_none(), default="medium")
    score = Column(Integer, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=20)
    correct_count = Column(Integer, nullable=False, default=0)
    wrong_count = Column(Integer, nullable=False, default=0)
    total_time_seconds = Column(Integer, default=0)
    rank = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    question_ids = Column(JSON, nullable=True)
    global_period = Column(String, nullable=True, index=True)
    completed = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GlobalQuizPool(Base):
    __tablename__ = "quiz_global_pools"

    period = Column(String, primary_key=True)


class UserSummaryCache(Base):
    """Read-only local cache of user display data — populated from Auth service API."""
    __tablename__ = "quiz_user_summary_cache"

    user_id = Column(String, primary_key=True)
    username = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    is_banned = Column(Boolean, default=False, nullable=False)
    synced_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
