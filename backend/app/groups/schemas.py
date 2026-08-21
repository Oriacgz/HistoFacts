"""
Pydantic schemas for Groups module.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from app.auth.schemas import UserResponse


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None


class GroupMemberResponse(BaseModel):
    group_id: str
    user_id: str
    role: str
    joined_at: datetime
    user: UserResponse | None = None

    class Config:
        from_attributes = True


class GroupResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_by: str
    created_at: datetime
    member_count: int = 1
    members: list[GroupMemberResponse] = []

    class Config:
        from_attributes = True
