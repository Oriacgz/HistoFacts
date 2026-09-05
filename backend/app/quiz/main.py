"""
Quiz & Assessment Microservice (Port 8006).
Handles historical quizzes, attempt recording, score evaluation, and Histoin rewards.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import async_session_factory
from app.quiz.router import router as quiz_router
from app.quiz.service import seed_quiz_questions


limiter = Limiter(key_func=get_remote_address, default_limits=[])


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as session:
        await seed_quiz_questions(session)
    yield


app = FastAPI(
    title="HistoFacts — Quiz & Assessment Microservice",
    description="Microservice 6: Topic question bank, evaluation, accuracy scores, and reward integration.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.core.correlation import CorrelationIdMiddleware

app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "quiz-service", "port": 8006}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.quiz.main:app", host="0.0.0.0", port=8006, reload=True)
