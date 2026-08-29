"""
Pydantic schemas for Notification Microservice.
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    user_id: str
    type: str
    payload: dict[str, Any] = {}


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    type: str
    payload: dict[str, Any]
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationBatchReadResponse(BaseModel):
    status: str
    updated_count: int
