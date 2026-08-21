"""
Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.auth.router import router as auth_router
from app.history.router import router as history_router
from app.quiz.router import router as quiz_router
from app.social.router import router as social_router
from app.groups.router import router as groups_router
from app.ai_notes.router import router as notes_router

app = FastAPI(
    title="HistoFacts API",
    description="Backend API for Daily Historical Facts & Stories",
    version="1.0.0",
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


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": "HistoFacts Backend"}
