"""
Pydantic schemas for Groups module.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class UserSummaryResponse(BaseModel):
    """Minimal user data for display — mirrors UserSummaryCache."""
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    username: str
    tag: str
    avatar_url: str | None = None
    bio: str | None = None
    is_banned: bool = False


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    member_ids: list[str] = Field(
        default=[],
        description="List of initial member user IDs to invite. Total members (creator + invited) must be between 3 and 50."
    )


class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_id: str
    user_id: str
    role: str
    joined_at: datetime
    user: UserSummaryResponse | None = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    created_by: str
    created_at: datetime
    member_count: int = 1
    members: list[GroupMemberResponse] = []
