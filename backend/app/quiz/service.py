"""
Quiz business logic — seeds quiz questions and processes attempts.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.quiz.models import QuizQuestion, QuizAttempt
from app.quiz.schemas import QuizAttemptRequest

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
]


async def seed_quiz_questions(db: AsyncSession):
    res = await db.execute(select(QuizQuestion).limit(1))
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
            select(QuizQuestion).where(QuizQuestion.topic.ilike(f"%{topic}%"))
        )
        questions = res.scalars().all()
        if questions:
            return questions

    res = await db.execute(select(QuizQuestion))
    return res.scalars().all()


async def record_quiz_attempt(
    req: QuizAttemptRequest, user_id: str | None, db: AsyncSession
) -> tuple[QuizAttempt, int]:
    res = await db.execute(select(QuizQuestion).where(QuizQuestion.id == req.question_id))
    qq = res.scalar_one_or_none()
    if not qq:
        raise ValueError("Question not found")

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
        from app.ai_notes.wallet_service import reward_quiz_histoins
        await reward_quiz_histoins(user_id, db)

    return attempt, qq.correct_answer
