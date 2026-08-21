"""
FastAPI router for Quiz module endpoints.
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.quiz.models import QuizQuestion, QuizAttempt
from app.quiz.schemas import (
    QuizQuestionResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
    QuizResultSummary,
)
from app.quiz.service import get_quiz_questions_by_topic, record_quiz_attempt
from app.core.database import get_async_session

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


@router.get("/questions", response_model=list[QuizQuestionResponse])
async def get_questions(
    topic: str = Query("", description="Search topic e.g. Mughal, Freedom"),
    db: AsyncSession = Depends(get_async_session),
):
    questions = await get_quiz_questions_by_topic(topic, db)
    return [QuizQuestionResponse.model_validate(q) for q in questions]


@router.post("/attempt", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED)
async def submit_attempt(
    req: QuizAttemptRequest,
    db: AsyncSession = Depends(get_async_session),
):
    try:
        attempt, correct_answer = await record_quiz_attempt(req, user_id=None, db=db)
        return QuizAttemptResponse(
            id=attempt.id,
            question_id=attempt.question_id,
            selected_option=attempt.selected_option,
            is_correct=attempt.is_correct,
            correct_answer=correct_answer,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/results/{session_id}", response_model=QuizResultSummary)
async def get_session_results(
    session_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    res = await db.execute(
        select(QuizAttempt).where(QuizAttempt.session_id == session_id)
    )
    attempts = res.scalars().all()
    total = len(attempts)
    correct = sum(1 for a in attempts if a.is_correct)
    pct = (correct / total * 100.0) if total > 0 else 0.0

    return QuizResultSummary(
        session_id=session_id,
        total_questions=total,
        correct_answers=correct,
        score_percentage=round(pct, 2),
    )
