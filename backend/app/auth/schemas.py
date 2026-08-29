"""
Pydantic schemas for auth requests and responses.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    tag: str
    email: EmailStr
    avatar_url: str | None = None
    created_at: datetime


class FriendResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    tag: str
    avatar_url: str | None = None
    status: str = "accepted"
    requested_at: datetime | None = None


class AddFriendRequest(BaseModel):
    friend_id: str | None = None
    username: str | None = None
    tag: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class FriendRequestCreate(BaseModel):
    addressee_id: str


class FriendRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requester_id: str
    addressee_id: str
    status: str
    created_at: datetime
    requester: UserResponse | None = None
    addressee: UserResponse | None = None


class FriendWithPresence(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    tag: str
    avatar_url: str | None = None
    is_online: bool
    last_seen_at: datetime | None = None

    @property
    def display_name(self) -> str:
        return f"{self.username}#{self.tag}"


class SearchUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    tag: str
    avatar_url: str | None = None

    @property
    def display_name(self) -> str:
        return f"{self.username}#{self.tag}"
