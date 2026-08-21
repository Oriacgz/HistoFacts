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
