"""
Pydantic schemas for auth requests and responses.
"""

import re
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional

# Static ISO 3166-1 alpha-2 codes — loaded once at import time.
_ISO_ALPHA2 = {
    "AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT",
    "AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW",
    "BV","BR","IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL",
    "CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ",
    "DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ",
    "FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP",
    "GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID",
    "IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR",
    "KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY",
    "MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS",
    "MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MK",
    "MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR",
    "QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST",
    "SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS","SS","ES",
    "LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO",
    "TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU",
    "VE","VN","VG","VI","WF","EH","YE","ZM","ZW",
}


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
    bio: str | None = None
    country_code: str | None = None
    pronouns: str | None = None
    timezone: str = "UTC"
    show_online_status: bool = True
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


# ── Profile update ───────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    """Strip HTML tags from *text* — defence-in-depth even when rendering as plain text."""
    return re.sub(r"<[^>]+>", "", text)


class ProfileUpdate(BaseModel):
    """Fields the user can change on their profile (all optional)."""
    bio: str | None = Field(None, max_length=300)
    pronouns: str | None = Field(None, max_length=20)
    timezone: str | None = Field(None, max_length=50)
    show_online_status: bool | None = None
    country_code: str | None = Field(None, min_length=2, max_length=2)
    username: str | None = Field(None, min_length=2, max_length=50)

    @field_validator("bio", mode="before")
    @classmethod
    def sanitize_bio(cls, v: str | None) -> str | None:
        return _strip_html(v) if v else v

    @field_validator("country_code", mode="before")
    @classmethod
    def validate_country(cls, v: str | None) -> str | None:
        if v is None:
            return v
        code = v.strip().upper()
        if code not in _ISO_ALPHA2:
            raise ValueError("Invalid ISO 3166-1 alpha-2 country code")
        return code

    @field_validator("username", mode="before")
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v and "#" in v:
            raise ValueError("Username cannot contain '#'")
        return v.strip() if v else v


class AvatarResponse(BaseModel):
    avatar_url: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class EmailChangeRequest(BaseModel):
    new_email: EmailStr
