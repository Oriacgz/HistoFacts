"""
FastAPI router for Quiz module endpoints and WebSocket Lobby.
"""

import asyncio
from pydantic import BaseModel
from app.core.inter_service import notify
from fastapi import APIRouter, Depends, Query, HTTPException, Request, status, WebSocket, UploadFile, File, Form
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.quiz.models import QuizAttempt, QuizSessionRecord
from app.quiz.sessions import create_personalized_session, current_global_questions, start_global_session, complete_session, generate_global_question_pool
from app.quiz.generation import extract_pdf_text
from app.quiz.lobby import create_lobby as create_shared_lobby, serve_lobby, end_lobby
from app.quiz.lobby_state import lobby_state_manager
from app.quiz.schemas import (
    QuizQuestionResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
    GenerateQuizRequest,
    QuizSessionCreateRequest,
    QuizSessionResponse,
    LeaderboardResponse,
    CompleteQuizRequest,
    GlobalPoolRequest,
    LobbyCreateRequest,
)
from app.quiz.service import (
    get_quiz_questions_by_topic,
    generate_personalized_quiz_service,
    record_quiz_attempt,
    save_quiz_session_history,
    get_user_quiz_history,
    get_quiz_session_detail,
    get_global_leaderboard_data,
)
from app.core.database import get_async_session
from app.core.deps import get_optional_current_user, CurrentUser, verify_internal_service_secret
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


def require_quiz_user(user):
    if not user:
        raise HTTPException(401, "Authentication required")
    return user.id


@router.post("/personalized/generate")
async def generate_personalized(req: GenerateQuizRequest,
                                user=Depends(get_optional_current_user),
                                db: AsyncSession = Depends(get_async_session)):
    user_id = require_quiz_user(user)
    if req.source_type != "topic":
        raise HTTPException(400, "Upload PDFs through /personalized/from-pdf")
    return await create_personalized_session(req, user_id, db)


@router.post("/personalized/from-pdf")
async def generate_pdf(file: UploadFile = File(...), difficulty: str = Form("medium"),
                       user=Depends(get_optional_current_user),
                       db: AsyncSession = Depends(get_async_session)):
    user_id = require_quiz_user(user)
    if difficulty not in {"easy", "medium", "hard"}:
        raise HTTPException(422, "Invalid difficulty")
    raw = await file.read(10 * 1024 * 1024 + 1)
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "PDF must be at most 10 MB")
    text = await asyncio.to_thread(extract_pdf_text, raw)
    req = GenerateQuizRequest(topic="History PDF", source_type="pdf", pdf_text=text, difficulty=difficulty)
    return await create_personalized_session(req, user_id, db)


@router.get("/global/current")
async def global_current(db: AsyncSession = Depends(get_async_session)):
    from app.quiz.sessions import public_question
    _, questions = await current_global_questions(db)
    return [public_question(q) for q in questions]


@router.post("/global/start")
async def global_start(user=Depends(get_optional_current_user),
                       db: AsyncSession = Depends(get_async_session)):
    return await start_global_session(require_quiz_user(user), db)


@router.post("/sessions/{session_id}/complete", response_model=QuizSessionResponse)
async def finish_session(session_id: str, req: CompleteQuizRequest,
                         user=Depends(get_optional_current_user),
                         db: AsyncSession = Depends(get_async_session)):
    return await complete_session(session_id, require_quiz_user(user), req, db)


@router.post("/internal/global/pool", dependencies=[Depends(verify_internal_service_secret)])
async def publish_global_pool(req: GlobalPoolRequest, db: AsyncSession = Depends(get_async_session)):
    await generate_global_question_pool(req.period, db)
    return {"period": req.period, "status": "ready"}


@router.get("/questions", response_model=list[QuizQuestionResponse])
async def get_questions(
    topic: str = Query("", description="Search topic e.g. Mughal, Freedom"),
    db: AsyncSession = Depends(get_async_session),
):
    questions = await get_quiz_questions_by_topic(topic, db)
    return [QuizQuestionResponse.model_validate(q) for q in questions]


@router.post("/generate", response_model=list[QuizQuestionResponse])
@limiter.limit("10/minute")
async def generate_quiz(
    request: Request,
    req: GenerateQuizRequest,
    db: AsyncSession = Depends(get_async_session),
):
    if req.source_type != "topic":
        raise HTTPException(400, "Upload PDFs through /personalized/from-pdf")
    questions = await generate_personalized_quiz_service(req, db)
    return [QuizQuestionResponse.model_validate(q) for q in questions]


@router.post("/attempt", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED)
async def submit_attempt(
    req: QuizAttemptRequest,
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    try:
        user_id = current_user.id if current_user else None
        attempt, correct_answer = await record_quiz_attempt(req, user_id=user_id, db=db)
        return QuizAttemptResponse(
            id=attempt.id,
            question_id=attempt.question_id,
            selected_option=attempt.selected_option,
            is_correct=attempt.is_correct,
            correct_answer=correct_answer,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/session", response_model=QuizSessionResponse, status_code=status.HTTP_201_CREATED)
async def save_session_record(
    req: QuizSessionCreateRequest,
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    user_id = current_user.id if current_user else "anonymous"
    record = await save_quiz_session_history(user_id=user_id, req=req, db=db)
    return QuizSessionResponse.model_validate(record)


@router.get("/history", response_model=list[QuizSessionResponse])
async def get_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    records = await get_user_quiz_history(user_id=current_user.id, db=db, limit=limit, offset=offset)
    return [QuizSessionResponse.model_validate(r) for r in records]


@router.get("/history/{session_id}", response_model=QuizSessionResponse)
async def get_history_detail(
    session_id: str,
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    record = await get_quiz_session_detail(session_id=session_id, user_id=current_user.id, db=db)
    if not record:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
    return QuizSessionResponse.model_validate(record)


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_global_leaderboard(
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    return await get_global_leaderboard_data(db=db, current_user=current_user)


@router.get("/lobby/quizzes")
async def hostable_quizzes(user=Depends(get_optional_current_user), db: AsyncSession = Depends(get_async_session)):
    user_id = require_quiz_user(user)
    fields = (QuizSessionRecord.id, QuizSessionRecord.topic, QuizSessionRecord.difficulty, QuizSessionRecord.created_at)
    rows = (await db.execute(select(*fields).where(
        QuizSessionRecord.user_id == user_id, QuizSessionRecord.quiz_type == "personalized",
        QuizSessionRecord.question_ids.is_not(None)
    ).order_by(QuizSessionRecord.created_at.desc()).limit(50))).mappings()
    return [dict(row) for row in rows]


@router.post("/lobby/create")
async def create_lobby(req: LobbyCreateRequest, user=Depends(get_optional_current_user),
                       db: AsyncSession = Depends(get_async_session)):
    require_quiz_user(user)
    return await create_shared_lobby(str(req.quiz_session_id), user, db)


@router.post("/lobby/{code}/end")
async def end_lobby_endpoint(code: str, user=Depends(get_optional_current_user)):
    return await end_lobby(code, require_quiz_user(user))


class LobbyInviteRequest(BaseModel):
    user_ids: list[str] = []
    user_id: str | None = None


@router.post("/lobby/{code}/invite")
async def invite_to_lobby(
    code: str,
    req: LobbyInviteRequest,
    current_user: CurrentUser | None = Depends(get_optional_current_user),
):
    room = await lobby_state_manager.get_lobby(code)
    if not room:
        raise HTTPException(status_code=404, detail="Lobby room not found")

    if require_quiz_user(current_user) != room["host_id"]:
        raise HTTPException(403, "Only the host can invite participants")

    target_ids = list(req.user_ids)
    if req.user_id and req.user_id not in target_ids:
        target_ids.append(req.user_id)

    if not target_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided for invitation")

    host_name = current_user.username if current_user else room["host_name"]
    host_id = current_user.id if current_user else room["host_id"]

    for uid in target_ids:
        if uid != host_id:
            await notify(
                user_id=uid,
                type="quiz_lobby_invite",
                payload={
                    "code": room["code"],
                    "topic": room["topic"],
                    "host_id": host_id,
                    "host_name": host_name,
                },
            )

    return {"status": "invitations_sent", "invited_count": len(target_ids)}


@router.get("/lobby/{code}")
async def get_lobby_info(code: str):
    room = await lobby_state_manager.get_lobby(code)
    if not room:
        raise HTTPException(status_code=404, detail="Lobby room not found")
    return {
        "code": room["code"],
        "host_name": room["host_name"],
        "topic": room["topic"],
        "state": room["status"],
        "total_questions": len(room["question_ids"]),
        "participants_count": len(room["participants"]),
    }


# -------------------------------------------------------------
# WebSocket: Live Synchronous Kahoot-style Multiplayer Lobby
# -------------------------------------------------------------
@router.websocket("/lobby/{code}/ws")
@router.websocket("/ws/lobby/{code}")
async def websocket_lobby_endpoint(websocket: WebSocket, code: str):
    await serve_lobby(websocket, code)


# ── Internal Purge and Export Endpoints ──────────────────────────────────────

internal_router = APIRouter(tags=["Quiz Internal"])


@internal_router.post(
    "/internal/users/{user_id}/purge",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def purge_user_quiz(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Internal purge: delete personal attempts and sessions for user."""
    await db.execute(delete(QuizAttempt).where(QuizAttempt.user_id == user_id))
    await db.execute(delete(QuizSessionRecord).where(QuizSessionRecord.user_id == user_id))
    await db.commit()
    return {"status": "purged", "service": "quiz"}


@internal_router.get(
    "/internal/users/{user_id}/export",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def export_user_quiz(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    res = await db.execute(select(QuizSessionRecord).where(QuizSessionRecord.user_id == user_id))
    return {
        "sessions": [
            {"id": s.id, "score": s.score, "max_score": s.max_score, "created_at": str(s.created_at)}
            for s in res.scalars().all()
        ]
    }


main_quiz_router = APIRouter()
main_quiz_router.include_router(router)
main_quiz_router.include_router(internal_router)
router = main_quiz_router

