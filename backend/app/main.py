"""
Main FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base, async_session_factory
from app.auth.router import router as auth_router
from app.history.router import router as history_router
from app.quiz.router import router as quiz_router
from app.social.router import router as social_router
from app.groups.router import router as groups_router
from app.ai_notes.router import router as notes_router
from app.chat.router import router as chat_router
from app.notification.router import router as notification_router
from app.history.sync import seed_initial_events
from app.ai_notes.wallet_service import seed_token_packs
from app.quiz.service import seed_quiz_questions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed initial data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        await seed_token_packs(session)
        await seed_initial_events(session)
        await seed_quiz_questions(session)

    yield
    # Shutdown logic if needed


app = FastAPI(
    title="HistoFacts API",
    description="Backend API for Daily Historical Facts, AI Notes & Token Economy",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount module routers
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(quiz_router)
app.include_router(social_router)
app.include_router(groups_router)
app.include_router(notes_router)
app.include_router(chat_router)
app.include_router(notification_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": "HistoFacts Backend"}
