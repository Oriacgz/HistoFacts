from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class FavoriteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    monument_id: str
    created_at: datetime


class CompletionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tour_revision: int = Field(ge=1, strict=True)


class CompletionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    monument_id: str
    tour_revision: int
    completed_at: datetime
