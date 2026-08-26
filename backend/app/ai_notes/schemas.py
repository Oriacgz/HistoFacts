"""
Pydantic schemas for AI Notes, Token Wallet, and Shop.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class GenerateNoteRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=2000)
    curriculum: str = Field(..., min_length=2, max_length=100)  # e.g. "NCERT Class 10 History"
    event_id: str | None = None
    attachment_name: str | None = None
    attachment_type: str | None = None
    attachment_text: str | None = None
    attachment_data: str | None = None
    style: str | None = "standard"  # "standard" or "handwritten"


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    event_id: str | None = None
    title: str
    content: str
    curriculum_tag: str | None = None
    style: str = "standard"
    source_note_id: str | None = None
    attachment_name: str | None = None
    attachment_type: str | None = None
    is_ai_generated: bool
    created_at: datetime


class UpdateNoteRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    curriculum_tag: str | None = None
    style: str | None = None


class WalletResponse(BaseModel):
    token_balance: int
    histoin_balance: int
    next_refresh_at: datetime
    daily_refresh_amount: int = 50_000
    free_refill_cap: int = 350_000
    purchased_ceiling: int = 1_000_000


class TokenPackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    token_amount: int
    histoin_cost: int
    is_active: bool


class PurchaseResponse(BaseModel):
    token_balance: int
    histoin_balance: int
    tokens_credited: int
    pack_name: str
