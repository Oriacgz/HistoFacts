"""
Pydantic schemas for Chat module.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SendMessageRequest(BaseModel):
    message_type: str = Field(default="text", pattern="^(text|note_share|quiz_share)$")
    content: str = Field(..., min_length=1, max_length=5000)
    shared_ref_id: str | None = None


class ParticipantInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    tag: str
    avatar_url: str | None = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    sender_id: str
    sender_username: str
    sender_tag: str
    message_type: str
    content: str
    shared_ref_id: str | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    group_id: str | None = None
    group_name: str | None = None
    created_at: datetime
    last_message: MessageResponse | None = None
    unread_count: int = 0
    participants: list[ParticipantInfo] = []
