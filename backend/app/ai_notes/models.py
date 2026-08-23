"""
SQLAlchemy models for AI Notes, Token Economy, Histoins, and Shop.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, ForeignKey
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
    style = Column(String, default="standard")      # "standard" or "handwritten"
    source_note_id = Column(String, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    attachment_name = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    is_ai_generated = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GroupSharedNote(Base):
    __tablename__ = "group_shared_notes"

    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    note_id = Column(String, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True)
    shared_by = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserTokenWallet(Base):
    __tablename__ = "user_token_wallets"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    token_balance = Column(Integer, nullable=False, default=350_000)
    last_refresh_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class TokenLedger(Base):
    __tablename__ = "token_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)  # positive = credit, negative = debit
    reason = Column(String, nullable=False)  # "signup_bonus", "daily_refresh", "ai_generation", "purchase"
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HistoinWallet(Base):
    __tablename__ = "histoin_wallets"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    balance = Column(Integer, nullable=False, default=0)


class HistoinLedger(Base):
    __tablename__ = "histoin_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)  # positive = earned, negative = spent
    reason = Column(String, nullable=False)  # "quiz_completed", "daily_login", "purchase_spend"
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TokenPack(Base):
    __tablename__ = "token_packs"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    token_amount = Column(Integer, nullable=False)
    histoin_cost = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
