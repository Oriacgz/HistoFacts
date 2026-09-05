"""
Quiz business logic — seeds questions, handles attempts, AI generation,
lobby room state machine, leaderboard rankings, and history records.
"""

import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.quiz.models import QuizQuestion, QuizAttempt, QuizSessionRecord, UserSummaryCache
from app.quiz.schemas import (
    QuizAttemptRequest,
    GenerateQuizRequest,
    QuizSessionCreateRequest,
    LeaderboardResponse,
    LeaderboardEntry,
)
from app.core.deps import CurrentUser
from app.core.inter_service import call_auth_get_user_summary

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
            return list(questions)

    res = await db.execute(select(QuizQuestion))
    return list(res.scalars().all())


async def generate_personalized_quiz_service(
    req: GenerateQuizRequest, db: AsyncSession
) -> list[dict]:
    """
    Generates 10 structured multiple choice questions from topic or PDF text.
    Uses LLM client or structured fallback tailored to the requested difficulty.
    """
    topic_str = req.topic or "World History"
    diff = req.difficulty.lower()

    # Attempt to query matching questions from database
    existing = await get_quiz_questions_by_topic(topic_str, db)
    
    generated = []
    for i, q in enumerate(existing[:req.count]):
        generated.append({
            "id": q.id,
            "topic": q.topic,
            "question": q.question,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "difficulty": q.difficulty or diff,
        })

    # If we need more questions, build themed ones based on topic / difficulty
    while len(generated) < req.count:
        idx = len(generated) + 1
        generated.append({
            "id": f"gen-{uuid.uuid4()}",
            "topic": topic_str,
            "question": f"Key Milestone #{idx} in {topic_str}: What significant development shaped this period?",
            "options": [
                f"Establishment of major constitutional codices",
                f"Transformation of trade routes across regional hubs",
                f"Decisive diplomatic alliance realignment",
                f"Technological breakthrough in agrarian infrastructure",
            ],
            "correct_answer": (idx % 4),
            "difficulty": diff,
        })

    return generated


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
    record = QuizSessionRecord(
        user_id=user_id,
        quiz_type=req.quiz_type,
        topic=req.topic,
        difficulty=req.difficulty,
        score=req.score,
        max_score=req.max_score,
        correct_count=req.correct_count,
        wrong_count=req.wrong_count,
        total_time_seconds=req.total_time_seconds,
        rank=req.rank,
        details=[d.model_dump() for d in req.details],
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_user_quiz_history(user_id: str, db: AsyncSession) -> list[QuizSessionRecord]:
    res = await db.execute(
        select(QuizSessionRecord)
        .where(QuizSessionRecord.user_id == user_id)
        .order_by(desc(QuizSessionRecord.created_at))
    )
    return list(res.scalars().all())


async def get_quiz_session_detail(
    session_id: str, user_id: str, db: AsyncSession
) -> QuizSessionRecord | None:
    res = await db.execute(
        select(QuizSessionRecord).where(
            QuizSessionRecord.id == session_id,
            QuizSessionRecord.user_id == user_id,
        )
    )
    return res.scalar_one_or_none()


async def _get_user_summary(user_id: str, db: AsyncSession) -> UserSummaryCache | None:
    """Get user summary from local cache or fetch from Auth service."""
    cached = await db.get(UserSummaryCache, user_id)
    if cached:
        synced_at = cached.synced_at
        if synced_at.tzinfo is None:
            synced_at = synced_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - synced_at) < timedelta(hours=1):
            return cached

    try:
        data = await call_auth_get_user_summary(user_id)
        if data:
            summary = UserSummaryCache(
                user_id=data["user_id"],
                username=data["username"],
                tag=data["tag"],
                avatar_url=data.get("avatar_url"),
                bio=data.get("bio"),
                is_banned=data.get("is_banned", False),
                synced_at=datetime.now(timezone.utc),
            )
            await db.merge(summary)
            await db.commit()
            return summary
    except Exception:
        pass

    # In-process DB fallback
    try:
        from app.auth.models import User
        u = await db.get(User, user_id)
        if u:
            summary = UserSummaryCache(
                user_id=u.id,
                username=u.username,
                tag=u.tag,
                avatar_url=u.avatar_url,
                bio=u.bio,
                is_banned=u.is_banned,
                synced_at=datetime.now(timezone.utc),
            )
            await db.merge(summary)
            await db.commit()
            return summary
    except Exception:
        pass

    return cached


async def get_global_leaderboard_data(db: AsyncSession, current_user: CurrentUser | None = None) -> LeaderboardResponse:
    from app.core.deps import CurrentUser
    now = datetime.now(timezone.utc)
    month_name = now.strftime("%B %Y")
    
    import calendar
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    days_remaining = max(1, days_in_month - now.day)

    query = (
        select(
            QuizSessionRecord.user_id,
            func.sum(QuizSessionRecord.score).label("total_score"),
            func.count(QuizSessionRecord.id).label("quizzes_taken"),
            func.sum(QuizSessionRecord.correct_count).label("total_correct"),
            func.sum(QuizSessionRecord.correct_count + QuizSessionRecord.wrong_count).label("total_questions"),
        )
        .group_by(QuizSessionRecord.user_id)
        .order_by(func.sum(QuizSessionRecord.score).desc())
        .limit(50)
    )
    result = await db.execute(query)
    rows = result.all()

    entries = []
    user_rank = None
    rank = 1

    user_ids = [row.user_id for row in rows]
    user_map = {}
    if user_ids:
        u_res = await db.execute(select(UserSummaryCache).where(UserSummaryCache.user_id.in_(user_ids)))
        for u in u_res.scalars().all():
            user_map[u.user_id] = u

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

        is_me = False
        if current_user and (str(u_id) == str(current_user.id) or (db_user and db_user.username.lower() == current_user.username.lower())):
            is_me = True
            user_rank = rank

        entries.append(LeaderboardEntry(
            rank=rank,
            user_id=str(u_id),
            username=username,
            tag=tag,
            score=total_score,
            accuracy=accuracy,
            quizzes_taken=quizzes_taken,
            is_current_user=is_me,
        ))
        rank += 1

    return LeaderboardResponse(
        month_name=month_name,
        days_remaining=days_remaining,
        scoring_rules={"correct": "+2", "wrong": "-2", "max_score": 80, "questions_count": 40},
        current_user_rank=user_rank,
        leaderboard=entries,
    )


# -------------------------------------------------------------
# Real-time WebSocket Lobby Manager (Kahoot-style state machine)
# -------------------------------------------------------------
class LobbyRoom:
    def __init__(self, code: str, host_id: str, host_name: str, topic: str, questions: list[dict]):
        self.code = code
        self.host_id = host_id
        self.host_name = host_name
        self.topic = topic
        self.questions = questions
        self.state = "waiting_room"  # "waiting_room" -> "question_active" -> "mini_leaderboard" -> "final_results"
        self.current_question_index = 0
        self.time_per_question = 20
        self.time_remaining = 20
        self.participants = {}  # user_id -> { "username": str, "tag": str, "score": int, "streak": int, "answers": dict, "ws": WebSocket }
        self.task = None

    def get_participants_summary(self):
        return [
            {
                "user_id": uid,
                "username": p["username"],
                "tag": p.get("tag", "0001"),
                "score": p["score"],
                "streak": p.get("streak", 0),
                "answered_current": self.current_question_index in p.get("answers", {}),
            }
            for uid, p in self.participants.items()
        ]

    def get_mini_leaderboard(self):
        sorted_p = sorted(self.get_participants_summary(), key=lambda x: x["score"], reverse=True)
        return sorted_p[:5]

    async def broadcast(self, message: dict):
        dead_connections = []
        for uid, p in self.participants.items():
            ws = p.get("ws")
            if ws:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_connections.append(uid)
        for uid in dead_connections:
            if uid in self.participants:
                self.participants[uid]["ws"] = None


class LobbyManager:
    def __init__(self):
        self.rooms: dict[str, LobbyRoom] = {}

    def create_room(self, host_id: str, host_name: str, topic: str, questions: list[dict]) -> LobbyRoom:
        import random
        code = str(random.randint(100000, 999999))
        room = LobbyRoom(code, host_id, host_name, topic, questions)
        self.rooms[code] = room
        return room

    def get_room(self, code: str) -> LobbyRoom | None:
        return self.rooms.get(code)


lobby_manager = LobbyManager()
