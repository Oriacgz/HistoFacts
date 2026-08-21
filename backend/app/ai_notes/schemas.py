"""
Pydantic schemas for AI Notes module.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class GenerateNoteRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    curriculum: str = Field(..., min_length=2, max_length=100)  # e.g. "NCERT Class 10 History"
    event_id: str | None = None


class NoteResponse(BaseModel):
    id: str
    user_id: str
    event_id: str | None = None
    title: str
    content: str
    curriculum_tag: str | None = None
    is_ai_generated: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateNoteRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    curriculum_tag: str | None = None
