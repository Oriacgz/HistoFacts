"""
Pydantic schemas for History module.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class HistoricalEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: str
    year: str | None = None
    title: str
    description: str
    category: str
    country: str | None = None
    source: str
    source_url: str | None = None
    synced_at: datetime


class BookmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    event_id: str
    event: HistoricalEventResponse | None = None
    created_at: datetime
