"""
SQLAlchemy models for Chat module (conversations, participants, messages, read receipts).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Text, DateTime, ForeignKey, Index, UniqueConstraint
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String, nullable=False)
    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DirectParticipant(Base):
    """Exactly 2 rows per direct conversation. Group participants use group_members table."""
    __tablename__ = "direct_participants"

    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, primary_key=True)

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conv_user"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String, nullable=False)
    message_type = Column(String, nullable=False, default="text")
    content = Column(Text, nullable=False)
    shared_ref_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_messages_conv_created", "conversation_id", "created_at"),
    )


class ConversationRead(Base):
    __tablename__ = "conversation_reads"

    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, primary_key=True)
    last_read_message_id = Column(String, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserSummaryCache(Base):
    """Read-only local cache of user display data — populated from Auth service API."""
    __tablename__ = "chat_user_summary_cache"

    user_id = Column(String, primary_key=True)
    username = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    is_banned = Column(Boolean, default=False, nullable=False)
    synced_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
