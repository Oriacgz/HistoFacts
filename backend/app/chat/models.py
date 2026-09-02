"""
SQLAlchemy models for Chat module (conversations, participants, messages, read receipts).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String, nullable=False)  # "direct" or "group"
    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DirectParticipant(Base):
    """Exactly 2 rows per direct conversation. Group participants use group_members table."""
    __tablename__ = "direct_participants"

    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String, nullable=False, default="text")  # text, note_share, quiz_share
    content = Column(Text, nullable=False)
    shared_ref_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_messages_conv_created", "conversation_id", "created_at"),
    )


class ConversationRead(Base):
    __tablename__ = "conversation_reads"

    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_read_message_id = Column(String, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
