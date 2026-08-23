"""
Pydantic schemas for Quiz module.
"""

from datetime import datetime
from pydantic import BaseModel


class QuizQuestionResponse(BaseModel):
    id: str
    topic: str
    question: str
    options: list[str]
    correct_answer: int
    difficulty: str

    class Config:
        from_attributes = True


class GenerateQuizRequest(BaseModel):
    topic: str = "World History"
    source_type: str = "topic"  # "topic" or "pdf"
    pdf_text: str | None = None
    difficulty: str = "medium"  # "easy", "medium", "hard"
    count: int = 10


class QuizAttemptRequest(BaseModel):
    session_id: str
    question_id: str
    selected_option: int


class QuizAttemptResponse(BaseModel):
    id: str
    question_id: str
    selected_option: int
    is_correct: bool
    correct_answer: int


class QuizResultSummary(BaseModel):
    session_id: str
    total_questions: int
    correct_answers: int
    score_percentage: float


class QuestionReviewItem(BaseModel):
    question_id: str
    question: str
    options: list[str]
    selected_option: int | None
    correct_answer: int
    is_correct: bool
    difficulty: str = "medium"


class QuizSessionCreateRequest(BaseModel):
    quiz_type: str = "personalized"  # "personalized", "lobby", "global"
    topic: str = "General History"
    difficulty: str = "medium"
    score: int = 0
    max_score: int = 20
    correct_count: int = 0
    wrong_count: int = 0
    total_time_seconds: int = 0
    rank: int | None = None
    details: list[QuestionReviewItem] = []


class QuizSessionResponse(BaseModel):
    id: str
    user_id: str
    quiz_type: str
    topic: str
    difficulty: str
    score: int
    max_score: int
    correct_count: int
    wrong_count: int
    total_time_seconds: int
    rank: int | None = None
    details: list[dict] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


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
