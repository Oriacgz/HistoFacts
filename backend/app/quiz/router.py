"""
FastAPI router for Quiz module endpoints and WebSocket Lobby.
"""

import asyncio
from app.core.security import decode_token
from fastapi import APIRouter, Depends, Query, HTTPException, Request, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.quiz.models import QuizQuestion, QuizAttempt
from app.quiz.schemas import (
    QuizQuestionResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
    QuizResultSummary,
    GenerateQuizRequest,
    QuizSessionCreateRequest,
    QuizSessionResponse,
    LeaderboardResponse,
)
from app.quiz.service import (
    get_quiz_questions_by_topic,
    generate_personalized_quiz_service,
    record_quiz_attempt,
    save_quiz_session_history,
    get_user_quiz_history,
    get_quiz_session_detail,
    get_global_leaderboard_data,
    lobby_manager,
)
from app.core.database import get_async_session
from app.core.deps import get_optional_current_user, CurrentUser
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


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
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    if not current_user:
        return []
    records = await get_user_quiz_history(user_id=current_user.id, db=db)
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


@router.post("/lobby/create")
async def create_lobby(
    req: GenerateQuizRequest,
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    host_id = current_user.id if current_user else "guest-host"
    host_name = current_user.username if current_user else "Host"
    questions = await generate_personalized_quiz_service(req, db)
    room = await lobby_manager.create_room_async(
        host_id=host_id,
        host_name=host_name,
        topic=req.topic or "History Trivia",
        questions=questions,
    )
    return {
        "code": room.code,
        "host_id": room.host_id,
        "host_name": room.host_name,
        "topic": room.topic,
        "total_questions": len(questions),
    }


from pydantic import BaseModel
from app.core.inter_service import notify


class LobbyInviteRequest(BaseModel):
    user_ids: list[str] = []
    user_id: str | None = None


@router.post("/lobby/{code}/invite")
async def invite_to_lobby(
    code: str,
    req: LobbyInviteRequest,
    current_user: CurrentUser | None = Depends(get_optional_current_user),
):
    room = lobby_manager.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Lobby room not found")

    target_ids = list(req.user_ids)
    if req.user_id and req.user_id not in target_ids:
        target_ids.append(req.user_id)

    if not target_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided for invitation")

    host_name = current_user.username if current_user else room.host_name
    host_id = current_user.id if current_user else room.host_id

    for uid in target_ids:
        if uid != host_id:
            await notify(
                user_id=uid,
                type="quiz_lobby_invite",
                payload={
                    "code": room.code,
                    "topic": room.topic,
                    "host_id": host_id,
                    "host_name": host_name,
                },
            )

    return {"status": "invitations_sent", "invited_count": len(target_ids)}


@router.get("/lobby/{code}")
async def get_lobby_info(code: str):
    room = lobby_manager.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Lobby room not found")
    return {
        "code": room.code,
        "host_name": room.host_name,
        "topic": room.topic,
        "state": room.state,
        "total_questions": len(room.questions),
        "participants_count": len(room.participants),
    }



# -------------------------------------------------------------
# WebSocket: Live Synchronous Kahoot-style Multiplayer Lobby
# -------------------------------------------------------------
@router.websocket("/ws/lobby/{code}")
async def websocket_lobby_endpoint(websocket: WebSocket, code: str):
    await websocket.accept()
    room = lobby_manager.get_room(code)
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return

    user_id = None
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # 1. Join / Reconnect with JWT authentication
            if msg_type == "join":
                token = data.get("token") or websocket.query_params.get("token")
                authenticated_user_id = None
                if token:
                    payload = decode_token(token)
                    if payload and payload.get("type") == "access":
                        authenticated_user_id = payload.get("sub")

                if authenticated_user_id:
                    user_id = authenticated_user_id
                    role = "host" if user_id == room.host_id else data.get("role", "player")
                else:
                    user_id = data.get("user_id") or f"guest-{str(websocket.client.host if websocket.client else 'client')}"
                    role = "player"  # Guests cannot claim host privileges

                username = data.get("username") or "Scholar"
                tag = data.get("tag") or "0001"

                # Restore or init participant state
                if user_id not in room.participants:
                    room.participants[user_id] = {
                        "username": username,
                        "tag": tag,
                        "score": 0,
                        "streak": 0,
                        "answers": {},
                        "role": role,
                        "ws": websocket,
                    }
                else:
                    # Silent reconnect!
                    room.participants[user_id]["ws"] = websocket
                    room.participants[user_id]["username"] = username
                    room.participants[user_id]["role"] = role

                # Send room snapshot to newly joined / reconnected user
                curr_q = room.questions[room.current_question_index] if room.questions else None
                await websocket.send_json({
                    "type": "room_state",
                    "code": room.code,
                    "host_id": room.host_id,
                    "host_name": room.host_name,
                    "topic": room.topic,
                    "state": room.state,
                    "current_question_index": room.current_question_index,
                    "total_questions": len(room.questions),
                    "time_remaining": room.time_remaining,
                    "question": curr_q if room.state == "question_active" else None,
                    "participants": room.get_participants_summary(),
                    "mini_leaderboard": room.get_mini_leaderboard(),
                })

                # Broadcast updated participants list
                await room.broadcast({
                    "type": "participants_update",
                    "participants": room.get_participants_summary(),
                })

            # 2. Host starts the quiz (Authorized only for room.host_id)
            elif msg_type == "start_quiz":
                if user_id != room.host_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Unauthorized: Only the lobby host can start the quiz",
                    })
                    continue

                if room.state == "waiting_room":
                    room.state = "question_active"
                    room.current_question_index = 0
                    room.time_remaining = 20
                    q = room.questions[0]
                    await room.broadcast({
                        "type": "question_start",
                        "index": 0,
                        "total": len(room.questions),
                        "question": q,
                        "time_remaining": 20,
                    })

            # 3. Player submits answer
            elif msg_type == "submit_answer":
                if user_id and user_id in room.participants and room.state == "question_active":
                    selected = data.get("selected_option")
                    q_idx = room.current_question_index
                    q = room.questions[q_idx]
                    is_correct = (selected == q["correct_answer"])

                    p = room.participants[user_id]
                    p["answers"][q_idx] = selected
                    if is_correct:
                        p["score"] += 100 + max(0, room.time_remaining * 5)
                        p["streak"] = p.get("streak", 0) + 1
                    else:
                        p["streak"] = 0

                    await websocket.send_json({
                        "type": "answer_acknowledged",
                        "is_correct": is_correct,
                        "correct_answer": q["correct_answer"],
                        "score": p["score"],
                    })

                    await room.broadcast({
                        "type": "participants_update",
                        "participants": room.get_participants_summary(),
                    })

            # 4. Host advances to next question or mini-leaderboard (Authorized only for room.host_id)
            elif msg_type == "show_leaderboard":
                if user_id != room.host_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Unauthorized: Only the lobby host can show the leaderboard",
                    })
                    continue

                room.state = "mini_leaderboard"
                await room.broadcast({
                    "type": "show_mini_leaderboard",
                    "mini_leaderboard": room.get_mini_leaderboard(),
                })

            elif msg_type == "next_question":
                if user_id != room.host_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Unauthorized: Only the lobby host can advance questions",
                    })
                    continue

                if room.current_question_index + 1 < len(room.questions):
                    room.current_question_index += 1
                    room.state = "question_active"
                    room.time_remaining = 20
                    q = room.questions[room.current_question_index]
                    await room.broadcast({
                        "type": "question_start",
                        "index": room.current_question_index,
                        "total": len(room.questions),
                        "question": q,
                        "time_remaining": 20,
                    })
                else:
                    room.state = "final_results"
                    await room.broadcast({
                        "type": "final_results",
                        "leaderboard": sorted(room.get_participants_summary(), key=lambda x: x["score"], reverse=True),
                    })

            # 5. Server time tick update (Authorized only for room.host_id)
            elif msg_type == "tick":
                if user_id == room.host_id:
                    new_time = data.get("time_remaining")
                    if new_time is not None:
                        room.time_remaining = new_time
                        await room.broadcast({
                            "type": "time_sync",
                            "time_remaining": room.time_remaining,
                        })


    except WebSocketDisconnect:
        if user_id and user_id in room.participants:
            room.participants[user_id]["ws"] = None
    except Exception:
        pass
