"""
Pydantic schemas for Quiz module.
"""

from uuid import UUID
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, StrictInt


class QuizQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    topic: str
    question: str
    options: list[str]
    correct_answer: int
    difficulty: str


class GenerateQuizRequest(BaseModel):
    topic: str = Field(default="World History", min_length=1, max_length=300)
    source_type: Literal["topic", "pdf"] = "topic"
    pdf_text: str | None = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    count: int = Field(default=10, ge=10, le=10)


class QuizAttemptRequest(BaseModel):
    session_id: str
    question_id: str
    selected_option: int = Field(ge=0, le=3)


class QuizAttemptResponse(BaseModel):
    id: str
    question_id: str
    selected_option: int
    is_correct: bool
    correct_answer: int


class QuestionReviewItem(BaseModel):
    question_id: str
    question: str
    options: list[str]
    selected_option: int | None
    correct_answer: int
    is_correct: bool
    difficulty: str = "medium"


class QuizSessionCreateRequest(BaseModel):
    session_id: str | None = None
    quiz_type: Literal["personalized", "lobby", "global"] = "personalized"
    topic: str = "General History"
    difficulty: str = "medium"
    score: int = 0
    max_score: int = 20
    correct_count: int = 0
    wrong_count: int = 0
    total_time_seconds: int = Field(default=0, ge=0)
    rank: int | None = None
    details: list[QuestionReviewItem] = Field(default_factory=list)


class QuizSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    quiz_type: str
    topic: str
    difficulty: str | None
    score: int
    max_score: int
    correct_count: int
    wrong_count: int
    total_time_seconds: int
    rank: int | None = None
    details: list[dict] | None = None
    created_at: datetime


class CompleteQuizRequest(BaseModel):
    answers: dict[str, StrictInt | None]
    total_time_seconds: int = Field(default=0, ge=0)


class GlobalPoolRequest(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    tag: str
    score: int
    accuracy: float
    quizzes_taken: int
    is_current_user: bool = False


class LeaderboardResponse(BaseModel):
    month_name: str
    days_remaining: int
    scoring_rules: dict
    current_user_rank: int | None
    leaderboard: list[LeaderboardEntry]


class LobbyCreateRequest(BaseModel):
    quiz_session_id: UUID
