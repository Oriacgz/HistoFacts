"""Shared SQL aggregation and ranking for completed monthly global quizzes."""
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.quiz.models import QuizSessionRecord, UserSummaryCache


def month_bounds(start=None):
    now = start or datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start.replace(year=start.year + 1, month=1) if start.month == 12
           else start.replace(month=start.month + 1))
    return start, end


def ranked_global_sessions(start=None):
    start, end = month_bounds(start)
    total = func.sum(QuizSessionRecord.score)
    return select(
        QuizSessionRecord.user_id,
        total.label("total_score"),
        func.count(QuizSessionRecord.id).label("quizzes_taken"),
        func.sum(QuizSessionRecord.correct_count).label("total_correct"),
        func.sum(QuizSessionRecord.correct_count + QuizSessionRecord.wrong_count).label("total_questions"),
        func.rank().over(order_by=total.desc()).label("rank"),
        func.row_number().over(order_by=(total.desc(), QuizSessionRecord.user_id)).label("position"),
    ).where(
        QuizSessionRecord.quiz_type == "global", QuizSessionRecord.completed.is_(True),
        QuizSessionRecord.created_at >= start, QuizSessionRecord.created_at < end,
    ).group_by(QuizSessionRecord.user_id).subquery()


async def ranked_rows(db, start=None, limit=100, user_id=None):
    ranked = ranked_global_sessions(start)
    condition = ranked.c.position <= limit
    if user_id:
        condition |= ranked.c.user_id == user_id
    return (await db.execute(select(ranked).where(condition).order_by(ranked.c.position))).all()


async def user_summaries(db, user_ids):
    if not user_ids:
        return {}
    return {u.user_id: u for u in (await db.execute(
        select(UserSummaryCache).where(UserSummaryCache.user_id.in_(user_ids)))).scalars()}
