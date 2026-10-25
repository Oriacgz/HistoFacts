"""Isolated browser-test platform: real routes/auth, disposable SQLite DB, fixture model.

Run from backend: venv/Scripts/python.exe tests/quiz_platform_server.py
Sign in with quizaudit@example.com / QuizAudit2026!
No application database or external model is used.
"""
import os
import sys
import json
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
fixture_db = Path(__file__).resolve().parents[1] / ".pytest_cache" / "quiz-part2-platform.sqlite3"
fixture_db.parent.mkdir(exist_ok=True)
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + fixture_db.as_posix()
os.environ["LLM_BASE_URL"] = "http://127.0.0.1:8008/audit-model/v1"
os.environ["REDIS_URL"] = "redis://127.0.0.1:6389/0"
os.environ["CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"

import uvicorn
from fastapi import Request
from app.main import app, lifespan
from app.core.database import async_session_factory, engine
from sqlalchemy import select
from app.auth.models import User
from app.auth.service import register_user
from app.auth.schemas import UserRegisterRequest
from app.quiz.generation import fallback_questions
from app.quiz.models import GlobalQuizPool, QuizQuestion, UserSummaryCache


@asynccontextmanager
async def audit_lifespan(application):
    async with lifespan(application):
        async with async_session_factory() as db:
            for name, email in [("QuizAudit", "quizaudit@example.com"), ("QuizPlayer", "quizplayer@example.com")]:
                if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
                    continue
                user, _, _ = await register_user(UserRegisterRequest(
                    username=name, email=email, password="QuizAudit2026!"), db)
                db.add(UserSummaryCache(user_id=user.id, username=user.username, tag=user.tag))
            period = datetime.now(timezone.utc).strftime("%Y-%m")
            if not await db.get(GlobalQuizPool, period):
                db.add(GlobalQuizPool(period=period))
                db.add_all([QuizQuestion(topic="Global History", difficulty="medium", is_global_pool=True,
                                    global_period=period, **question) for question in fallback_questions(40)])
            await db.commit()
        yield
    await engine.dispose()


app.router.lifespan_context = audit_lifespan


@app.post("/audit-model/v1/chat/completions", include_in_schema=False)
async def fixture_model(request: Request):
    await asyncio.sleep(float(os.environ.get("QUIZ_AUDIT_MODEL_DELAY", "0")))
    payload = await request.json()
    content = json.dumps(fallback_questions(40 if "Generate 40" in payload["messages"][-1]["content"] else 10))
    return {"id": "quiz-audit", "object": "chat.completion", "created": 0, "model": "quiz-fixture",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 100, "total_tokens": 110}}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[1]) if len(sys.argv) > 1 else 8008)
