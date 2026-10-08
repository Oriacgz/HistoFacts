"""Official pools and server-owned quiz sessions."""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.ai_notes.llm_client import is_history_related
from app.ai_notes.models import HistoinWallet, HistoinLedger
from app.quiz.leaderboard import ranked_global_sessions
from app.quiz.generation import QUIZ_PROMPT, SCORING, generate_and_parse_quiz_json
from app.quiz.models import QuizQuestion, QuizSessionRecord, QuizAttempt, GlobalQuizPool


def public_question(q):
    return {"id": q.id, "topic": q.topic, "question": q.question,
            "options": q.options, "difficulty": q.difficulty}


async def personalized_questions(req, db):
    source = req.pdf_text if req.source_type == "pdf" else req.topic
    source = (source or "").strip()
    if not source or not await is_history_related(source[:4000], req.topic):
        raise HTTPException(400, "Topic must be history-related")
    data = await generate_and_parse_quiz_json(
        QUIZ_PROMPT.format(count=10, difficulty=req.difficulty, topic=source[:4000]))
    questions = [QuizQuestion(topic=req.topic or "History PDF", difficulty=req.difficulty, **q) for q in data]
    db.add_all(questions)
    await db.flush()
    return questions


async def create_personalized_session(req, user_id, db):
    questions = await personalized_questions(req, db)
    session = QuizSessionRecord(user_id=user_id, quiz_type="personalized", topic=req.topic,
                                difficulty=req.difficulty, max_score=20, completed=False,
                                question_ids=[q.id for q in questions])
    db.add(session)
    await db.commit()
    return {"session_id": session.id, "questions": [public_question(q) for q in questions]}


async def generate_global_question_pool(period, db):
    """Internal monthly job; an atomic period key prevents concurrent pool publication."""
    if await db.get(GlobalQuizPool, period):
        await current_global_questions(db, period)
        return
    data = await generate_and_parse_quiz_json(
        QUIZ_PROMPT.format(count=40, difficulty="mixed", topic="World and Indian history"),
        max_retries=3, count=40)
    try:
        async with db.begin_nested():
            db.add(GlobalQuizPool(period=period))
            await db.flush()
            db.add_all([QuizQuestion(topic="Global History", difficulty="medium",
                                    is_global_pool=True, global_period=period, **q) for q in data])
            await db.flush()
        await db.commit()
    except IntegrityError:
        # Another publisher committed the complete pool for this period.
        await db.rollback()
        if not await db.get(GlobalQuizPool, period):
            raise
        await current_global_questions(db, period)


async def current_global_questions(db, period=None):
    period = period or datetime.now(timezone.utc).strftime("%Y-%m")
    questions = list((await db.execute(select(QuizQuestion).where(
        QuizQuestion.is_global_pool.is_(True), QuizQuestion.global_period == period
    ).order_by(QuizQuestion.id))).scalars())
    if len(questions) != 40:
        raise HTTPException(503, "This month's quiz isn't ready yet")
    return period, questions


async def start_global_session(user_id, db):
    period, questions = await current_global_questions(db)
    session = (await db.execute(select(QuizSessionRecord).where(
        QuizSessionRecord.user_id == user_id, QuizSessionRecord.global_period == period
    ))).scalar_one_or_none()
    if session and session.completed:
        raise HTTPException(409, "You have already completed this month's quiz")
    if not session:
        session = QuizSessionRecord(user_id=user_id, quiz_type="global", topic="Global History",
                                    difficulty=None, max_score=80, completed=False,
                                    global_period=period, question_ids=[q.id for q in questions])
        db.add(session)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            session = (await db.execute(select(QuizSessionRecord).where(
                QuizSessionRecord.user_id == user_id, QuizSessionRecord.global_period == period
            ))).scalar_one_or_none()
            if not session or session.completed:
                raise HTTPException(409, "Monthly session changed; reload the quiz")
    return {"session_id": session.id, "questions": [public_question(q) for q in questions]}


async def complete_session(session_id, user_id, req, db):
    session = (await db.execute(select(QuizSessionRecord).where(
        QuizSessionRecord.id == session_id, QuizSessionRecord.user_id == user_id
    ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if not session or not session.question_ids:
        raise HTTPException(404, "Quiz session not found")
    if session.completed:
        return session
    if session.global_period and session.global_period != datetime.now(timezone.utc).strftime("%Y-%m"):
        raise HTTPException(409, "This global quiz period has ended")
    if set(req.answers) - set(session.question_ids):
        raise HTTPException(400, "Answer does not belong to this quiz")
    if any(a is not None and (type(a) is not int or not 0 <= a <= 3) for a in req.answers.values()):
        raise HTTPException(400, "Answers must be option indices 0-3")
    questions = {q.id: q for q in (await db.execute(select(QuizQuestion).where(
        QuizQuestion.id.in_(session.question_ids)))).scalars()}
    if len(questions) != len(session.question_ids):
        raise HTTPException(409, "Quiz questions are unavailable")
    rules = SCORING["global" if session.quiz_type == "global" else session.difficulty]
    score = correct = wrong = 0
    details = []
    for q_id in session.question_ids:
        q = questions[q_id]
        answer = req.answers.get(q_id)
        is_correct = answer == q.correct_answer
        if answer is not None:
            correct += int(is_correct)
            wrong += int(not is_correct)
            score += rules["correct" if is_correct else "wrong"]
        details.append({**public_question(q), "question_id": q_id, "selected_option": answer,
                        "correct_answer": q.correct_answer, "is_correct": is_correct})
    # Claim completion atomically, including SQLite where SELECT FOR UPDATE is ignored.
    claimed = await db.execute(update(QuizSessionRecord).where(
        QuizSessionRecord.id == session.id, QuizSessionRecord.completed.is_(False)
    ).values(completed=True).execution_options(synchronize_session=False))
    if claimed.rowcount != 1:
        await db.refresh(session)
        return session
    session.completed = True
    session.score, session.correct_count, session.wrong_count = score, correct, wrong
    session.max_score = len(session.question_ids) * rules["correct"]
    session.details = details
    session.total_time_seconds = req.total_time_seconds
    if session.quiz_type == "global":
        await db.flush()
        ranked = ranked_global_sessions()
        session.rank = (await db.execute(select(ranked.c.rank).where(ranked.c.user_id == user_id))).scalar_one()
    db.add_all([QuizAttempt(session_id=session.id, question_id=d["question_id"], user_id=user_id,
                           selected_option=d["selected_option"], is_correct=d["is_correct"])
                for d in details if d["selected_option"] is not None])
    earned = max(score, 0) if session.quiz_type == "global" else 0
    if earned:
        wallet = (await db.execute(select(HistoinWallet).where(
            HistoinWallet.user_id == user_id).with_for_update())).scalar_one_or_none()
        if wallet is None:
            wallet = HistoinWallet(user_id=user_id, balance=0)
            db.add(wallet)
            await db.flush()
        await db.execute(update(HistoinWallet).where(HistoinWallet.user_id == user_id)
                         .values(balance=HistoinWallet.balance + earned)
                         .execution_options(synchronize_session=False))
        await db.refresh(wallet)
        db.add(HistoinLedger(user_id=user_id, delta=earned, reason="quiz_completed", balance_after=wallet.balance))
    await db.commit()
    await db.refresh(session)
    return session
