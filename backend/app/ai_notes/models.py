"""
SQLAlchemy models for AI Notes, Token Economy, Histoins, and Shop.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, ForeignKey, JSON, Index, text
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    prompt = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    curriculum_tag = Column(String, nullable=True)  # e.g. "NCERT Class 10", "UPSC GS I"
    style = Column(String, default="standard")      # "standard" or "handwritten"
    kind = Column(String(24), nullable=False, default="conversation", server_default="conversation")
    source_note_id = Column(String, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    attachment_name = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    is_ai_generated = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NoteResearchRun(Base):
    __tablename__ = "note_research_runs"
    __table_args__ = (Index("uq_research_running_owner", "user_id", unique=True,
                           sqlite_where=text("state = 'running'"), postgresql_where=text("state = 'running'")),)

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    fingerprint = Column(String(64), nullable=False)
    root_id = Column(String, nullable=True)
    note_id = Column(String, ForeignKey("notes.id", ondelete="CASCADE"), nullable=True, unique=True)
    state = Column(String(24), nullable=False, default="running")
    sources = Column(JSON, nullable=False, default=list)
    details = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class NoteSessionMemory(Base):
    __tablename__ = "note_session_memory"
    root_id = Column(String, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    epoch = Column(Integer, nullable=False, default=0)
    version = Column(Integer, nullable=False, default=0)
    enabled = Column(Boolean, nullable=False, default=True)
    summary = Column(JSON, nullable=False, default=list)
    covered_ids = Column(JSON, nullable=False, default=list)
    ignored_ids = Column(JSON, nullable=False, default=list)
    snapshots = Column(JSON, nullable=False, default=list)
    retrieval = Column(JSON, nullable=False, default=dict)
    status = Column(String(24), nullable=False, default="ready")
    operation_id = Column(String, nullable=True)
    lease_until = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


# Sources/passages/citations are one bounded JSON registry owned by this run,
# avoiding four independently writable records for the initial local feature.




class UserTokenWallet(Base):
    __tablename__ = "user_token_wallets"

    user_id = Column(String, primary_key=True)
    token_balance = Column(Integer, nullable=False, default=350_000)
    last_refresh_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class TokenLedger(Base):
    __tablename__ = "token_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    delta = Column(Integer, nullable=False)  # positive = credit, negative = debit
    reason = Column(String, nullable=False)  # "signup_bonus", "daily_refresh", "ai_generation", "purchase"
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class HistoinWallet(Base):
    __tablename__ = "histoin_wallets"

    user_id = Column(String, primary_key=True)
    balance = Column(Integer, nullable=False, default=0)


class HistoinLedger(Base):
    __tablename__ = "histoin_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    delta = Column(Integer, nullable=False)  # positive = earned, negative = spent
    reason = Column(String, nullable=False)  # "quiz_completed", "daily_login", "purchase_spend"
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class TokenPack(Base):
    __tablename__ = "token_packs"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    token_amount = Column(Integer, nullable=False)
    histoin_cost = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)


class PurchaseLog(Base):
    __tablename__ = "purchase_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    idempotency_key = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    result = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
