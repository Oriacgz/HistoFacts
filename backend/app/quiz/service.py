"""
Quiz business logic — seeds questions, handles attempts, AI generation,
lobby room state machine, leaderboard rankings, and history records.
"""

from datetime import datetime, timezone
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value
from app.quiz.models import QuizQuestion, QuizAttempt, QuizSessionRecord
from app.quiz.schemas import (
    QuizAttemptRequest,
    GenerateQuizRequest,
    QuizSessionCreateRequest,
    LeaderboardResponse,
    LeaderboardEntry,
)
from app.core.deps import CurrentUser
from app.quiz.leaderboard import ranked_rows, user_summaries

SEED_QUESTIONS = [
    {
        "topic": "Mughal Empire",
        "question": "Who was the founder of the Mughal Empire in India?",
        "options": ["Akbar", "Babur", "Humayun", "Aurangzeb"],
        "correct_answer": 1,
        "difficulty": "medium",
    },
    {
        "topic": "Mughal Empire",
        "question": "Which Mughal emperor built the Taj Mahal?",
        "options": ["Shah Jahan", "Akbar", "Jahangir", "Aurangzeb"],
        "correct_answer": 0,
        "difficulty": "easy",
    },
    {
        "topic": "Mughal Empire",
        "question": "During which Mughal emperor's reign did the empire reach its greatest extent?",
        "options": ["Babur", "Humayun", "Akbar", "Aurangzeb"],
        "correct_answer": 3,
        "difficulty": "hard",
    },
    {
        "topic": "Freedom Movement",
        "question": "When was the Indian National Congress founded?",
        "options": ["1885", "1905", "1920", "1857"],
        "correct_answer": 0,
        "difficulty": "medium",
    },
    {
        "topic": "Freedom Movement",
        "question": "Who is known as the 'Father of the Nation' in India?",
        "options": ["Jawaharlal Nehru", "Sardar Patel", "Mahatma Gandhi", "Subhas Chandra Bose"],
        "correct_answer": 2,
        "difficulty": "easy",
    },
    {
        "topic": "Freedom Movement",
        "question": "Which movement was launched by Mahatma Gandhi in 1942?",
        "options": ["Non-Cooperation Movement", "Civil Disobedience Movement", "Quit India Movement", "Swadeshi Movement"],
        "correct_answer": 2,
        "difficulty": "medium",
    },
    {
        "topic": "General History",
        "question": "Which civilization flourished in the Indus Valley around 2500 BCE?",
        "options": ["Vedic Civilization", "Harappan Civilization", "Mauryan Civilization", "Gupta Civilization"],
        "correct_answer": 1,
        "difficulty": "medium",
    },
    {
        "topic": "General History",
        "question": "The Battle of Plassey, which established British rule in India, was fought in which year?",
        "options": ["1757", "1764", "1776", "1784"],
        "correct_answer": 0,
        "difficulty": "hard",
    },
    {
        "topic": "Ancient Rome",
        "question": "Who was the first Emperor of Rome?",
        "options": ["Julius Caesar", "Augustus", "Nero", "Marcus Aurelius"],
        "correct_answer": 1,
        "difficulty": "medium",
    },
    {
        "topic": "World War II",
        "question": "In which year did the D-Day Normandy landings take place?",
        "options": ["1942", "1943", "1944", "1945"],
        "correct_answer": 2,
        "difficulty": "medium",
    },
]


async def seed_quiz_questions(db: AsyncSession):
    res = await db.execute(select(QuizQuestion).where(QuizQuestion.is_global_pool.is_(False)).limit(1))
    if res.scalar_one_or_none():
        return

    for q in SEED_QUESTIONS:
        qq = QuizQuestion(
            topic=q["topic"],
            question=q["question"],
            options=q["options"],
            correct_answer=q["correct_answer"],
            difficulty=q["difficulty"],
        )
        db.add(qq)
    await db.commit()


async def get_quiz_questions_by_topic(topic: str, db: AsyncSession) -> list[QuizQuestion]:
    await seed_quiz_questions(db)
    
    if topic:
        res = await db.execute(
            select(QuizQuestion).where(QuizQuestion.topic.ilike(f"%{topic}%"), QuizQuestion.is_global_pool.is_(False))
        )
        questions = res.scalars().all()
        if questions:
            return list(questions)

    res = await db.execute(select(QuizQuestion).where(QuizQuestion.is_global_pool.is_(False)))
    return list(res.scalars().all())


async def generate_personalized_quiz_service(
    req: GenerateQuizRequest, db: AsyncSession
) -> list[dict]:
    from app.quiz.sessions import personalized_questions
    questions = await personalized_questions(req, db)
    await db.commit()
    return [{"id": q.id, "topic": q.topic, "question": q.question,
             "options": q.options, "correct_answer": q.correct_answer,
             "difficulty": q.difficulty} for q in questions]


async def record_quiz_attempt(
    req: QuizAttemptRequest, user_id: str | None, db: AsyncSession
) -> tuple[QuizAttempt, int]:
    res = await db.execute(select(QuizQuestion).where(QuizQuestion.id == req.question_id))
    qq = res.scalar_one_or_none()
    if not qq:
        raise ValueError("Question not found")

    if qq.is_global_pool:
        raise ValueError("Global answers must be submitted through the official session")
    session = await db.get(QuizSessionRecord, req.session_id)
    if session and session.question_ids:
        raise ValueError("Submit answers through the session completion endpoint")
    is_correct = (req.selected_option == qq.correct_answer)

    attempt = QuizAttempt(
        user_id=user_id,
        session_id=req.session_id,
        question_id=req.question_id,
        selected_option=req.selected_option,
        is_correct=is_correct,
    )
    db.add(attempt)
    await db.flush()

    # Reward +20 Histoins for correct answer (up to 3/day)
    if is_correct and user_id:
        try:
            from app.core.inter_service import call_notes_reward_quiz
            ok = await call_notes_reward_quiz(user_id)
            if not ok:
                from app.ai_notes.wallet_service import reward_quiz_histoins
                await reward_quiz_histoins(user_id, db)
        except Exception:
            try:
                from app.ai_notes.wallet_service import reward_quiz_histoins
                await reward_quiz_histoins(user_id, db)
            except Exception:
                pass

    await db.commit()
    await db.refresh(attempt)

    return attempt, qq.correct_answer


async def save_quiz_session_history(
    user_id: str, req: QuizSessionCreateRequest, db: AsyncSession
) -> QuizSessionRecord:
    from fastapi import HTTPException
    from app.quiz.sessions import complete_session
    from app.quiz.schemas import CompleteQuizRequest
    if req.session_id:
        return await complete_session(req.session_id, user_id, CompleteQuizRequest(
            answers={d.question_id: d.selected_option for d in req.details},
            total_time_seconds=req.total_time_seconds), db)
    if req.quiz_type == "global":
        raise HTTPException(400, "Start an official global quiz session first")
    if req.difficulty not in {"easy", "medium", "hard"}:
        raise HTTPException(400, "Invalid quiz difficulty")
    from app.quiz.generation import SCORING
    ids = [d.question_id for d in req.details]
    if not ids or len(ids) != len(set(ids)):
        raise HTTPException(400, "Distinct quiz questions are required")
    questions = {q.id: q for q in (await db.execute(select(QuizQuestion).where(QuizQuestion.id.in_(ids)))).scalars()}
    if len(questions) != len(ids) or any(q.is_global_pool for q in questions.values()):
        raise HTTPException(400, "Invalid quiz questions")
    details = []
    correct = wrong = 0
    for d in req.details:
        q = questions[d.question_id]
        if d.selected_option is not None and not 0 <= d.selected_option <= 3:
            raise HTTPException(400, "Invalid option")
        is_correct = d.selected_option == q.correct_answer
        if d.selected_option is not None:
            correct += int(is_correct)
            wrong += int(not is_correct)
        details.append({"question_id": q.id, "question": q.question, "options": q.options,
                        "selected_option": d.selected_option, "correct_answer": q.correct_answer,
                        "is_correct": is_correct, "difficulty": req.difficulty})
    rules = SCORING[req.difficulty]
    record = QuizSessionRecord(
        user_id=user_id,
        quiz_type=req.quiz_type,
        topic=req.topic,
        difficulty=req.difficulty,
        score=correct * rules["correct"] + wrong * rules["wrong"],
        max_score=len(ids) * 2,
        correct_count=correct,
        wrong_count=wrong,
        total_time_seconds=req.total_time_seconds,
        rank=None,
        details=details,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_user_quiz_history(user_id: str, db: AsyncSession, limit: int = 50, offset: int = 0) -> list[dict]:
    # Summaries avoid loading every question/options JSON document on the list view.
    fields = ("id", "user_id", "quiz_type", "topic", "difficulty", "score", "max_score",
              "correct_count", "wrong_count", "total_time_seconds", "rank", "created_at")
    statement = select(*(getattr(QuizSessionRecord, name) for name in fields)).where(
        QuizSessionRecord.user_id == user_id, QuizSessionRecord.completed.is_(True)
    ).order_by(desc(QuizSessionRecord.created_at), QuizSessionRecord.id).limit(limit).offset(offset)
    return list((await db.execute(statement)).mappings())


async def get_quiz_session_detail(
    session_id: str, user_id: str, db: AsyncSession
) -> QuizSessionRecord | None:
    from app.quiz.generation import SCORING
    res = await db.execute(
        select(QuizSessionRecord).where(
            QuizSessionRecord.id == session_id,
            QuizSessionRecord.user_id == user_id,
            QuizSessionRecord.completed.is_(True),
        )
    )
    session = res.scalar_one_or_none()
    if session is None or not session.question_ids:
        return session
    rows = await db.execute(select(QuizQuestion, QuizAttempt).outerjoin(
        QuizAttempt, and_(QuizAttempt.question_id == QuizQuestion.id,
                          QuizAttempt.session_id == session.id,
                          QuizAttempt.user_id == user_id)
    ).where(QuizQuestion.id.in_(session.question_ids)))
    by_id = {question.id: (question, attempt) for question, attempt in rows}
    rules = SCORING.get(session.difficulty, SCORING["medium"])
    if session.quiz_type == "global":
        rules = {"correct": 2, "wrong": -2}
    details = [{
        "question_id": question.id, "question": question.question,
        "options": question.options, "correct_answer": question.correct_answer,
        "selected_option": attempt.selected_option if attempt else None,
        "is_correct": bool(attempt and attempt.is_correct),
        "difficulty": session.difficulty,
        "points": rules["correct"] if attempt and attempt.is_correct else rules["wrong"] if attempt else 0,
    } for question_id in session.question_ids if question_id in by_id
      for question, attempt in [by_id[question_id]]]
    set_committed_value(session, "details", details)
    return session


async def get_global_leaderboard(
    db: AsyncSession,
    month_start: datetime | None = None,
    limit: int = 100,
) -> list[dict]:
    rows = await ranked_rows(db, month_start, limit)
    authors = await user_summaries(db, [r.user_id for r in rows])
    return [{"rank": int(r.rank), "score": int(r.total_score or 0),
             "user": authors.get(r.user_id)} for r in rows]


async def get_global_leaderboard_data(
    db: AsyncSession,
    current_user: CurrentUser | None = None,
    limit: int = 50,
) -> LeaderboardResponse:
    now = datetime.now(timezone.utc)
    month_name = now.strftime("%B %Y")
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    
    import calendar
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    days_remaining = max(1, days_in_month - now.day)

    rows = await ranked_rows(db, month_start, limit, current_user.id if current_user else None)
    user_map = await user_summaries(db, [r.user_id for r in rows])
    entries = []
    user_rank = None
    for row in rows:
        u_id = row.user_id
        db_user = user_map.get(u_id)
        username = db_user.username if db_user else f"Scholar_{str(u_id)[:6]}"
        tag = db_user.tag if db_user else "0001"
        total_score = int(row.total_score or 0)
        quizzes_taken = int(row.quizzes_taken or 0)
        total_correct = int(row.total_correct or 0)
        total_questions = int(row.total_questions or 0)
        accuracy = round((total_correct / total_questions) * 100.0, 1) if total_questions > 0 else 0.0
        row_rank = int(row.rank)

        is_me = bool(current_user and str(u_id) == str(current_user.id))
        if is_me:
            user_rank = row_rank
        if row.position > limit:
            continue

        entries.append(LeaderboardEntry(
            rank=row_rank,
            user_id=str(u_id),
            username=username,
            tag=tag,
            score=total_score,
            accuracy=accuracy,
            quizzes_taken=quizzes_taken,
            is_current_user=is_me,
        ))

    return LeaderboardResponse(
        month_name=month_name,
        days_remaining=days_remaining,
        scoring_rules={"correct": "+2", "wrong": "-2", "max_score": 80, "questions_count": 40},
        current_user_rank=user_rank,
        leaderboard=entries,
    )
