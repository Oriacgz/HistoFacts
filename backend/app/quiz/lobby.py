"""Existing practice quizzes delivered through an authoritative Redis lobby."""
import asyncio
import math
import secrets
import time
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.websockets import WebSocketDisconnect

from app.core.database import async_session_factory
from app.core.security import decode_token
from app.quiz.generation import SCORING
from app.quiz.models import QuizQuestion, QuizSessionRecord, QuizAttempt, UserSummaryCache
from app.quiz.schemas import QuizSessionResponse
from app.quiz.sessions import public_question
from app.quiz.lobby_state import lobby_state_manager


def participants_summary(state):
    question_id = state["question_ids"][max(0, state["current_question_index"])]
    summaries = []
    for uid, participant in state["participants"].items():
        answers = participant["answers"]
        correct = sum(answer == state["questions"][qid]["correct_answer"] for qid, answer in answers.items())
        wrong = len(answers) - correct
        rules = SCORING[state["difficulty"]]
        summaries.append({"user_id": uid, "username": participant["username"], "tag": participant["tag"],
                          "score": correct * rules["correct"] + wrong * rules["wrong"],
                          "correct_count": correct, "wrong_count": wrong, "answered_current": question_id in answers})
    return sorted(summaries, key=lambda p: (-p["score"], p["user_id"]))


def lobby_snapshot(state, user_id):
    index = state["current_question_index"]
    question = state["questions"][state["question_ids"][index]] if index >= 0 else None
    participant = state["participants"].get(user_id)
    selected = participant["answers"].get(question["id"]) if question and participant else None
    summaries = participants_summary(state)
    summary = next((p for p in summaries if p["user_id"] == user_id), None)
    reveal = state["status"] in {"question_results", "final_results"}
    answer_result = None
    if question and selected is not None:
        answer_result = {"selected_option": selected, "score": summary["score"]}
        if reveal:
            answer_result.update(correct_answer=question["correct_answer"], is_correct=selected == question["correct_answer"])
    return {"type": "room_state", "code": state["code"], "version": state["version"],
            "user_id": user_id, "role": "host" if user_id == state["host_id"] else "player",
            "state": state["status"], "ended_by_host": state.get("ended_by_host", False), "host_name": state["host_name"], "topic": state["topic"],
            "difficulty": state["difficulty"], "scoring_rules": SCORING[state["difficulty"]],
            "current_question_index": index, "total_questions": len(state["question_ids"]),
            "time_remaining": max(0, math.ceil((state.get("deadline") or 0) - time.time())) if state["status"] == "question_active" else 0,
            "question": {k: v for k, v in question.items() if reveal or k != "correct_answer"} if question else None,
            "participants": summaries, "my_answer_result": answer_result,
            "leaderboard": summaries if state["status"] == "final_results" else [],
            "result": state.get("results", {}).get(user_id)}


lobby_state_manager.snapshot = lobby_snapshot


async def create_lobby(session_id, user, db):
    source = await db.get(QuizSessionRecord, session_id)
    if not source or source.user_id != user.id or source.quiz_type != "personalized" or not source.question_ids:
        raise HTTPException(404, "Choose one of your existing practice quizzes")
    questions = {q.id: {**public_question(q), "correct_answer": q.correct_answer} for q in
                 (await db.execute(select(QuizQuestion).where(QuizQuestion.id.in_(source.question_ids), QuizQuestion.is_global_pool.is_(False)))).scalars()}
    if len(questions) != len(source.question_ids):
        raise HTTPException(409, "Practice questions are unavailable")
    author = await db.get(UserSummaryCache, user.id)
    state = {"host_id": user.id, "host_name": user.username or (author.username if author else "Host"),
             "quiz_session_id": source.id, "topic": source.topic, "difficulty": source.difficulty,
             "status": "waiting_room", "participants": {}, "connections": {}, "current_question_index": -1,
             "question_ids": source.question_ids, "questions": questions, "version": 0,
             "created_at": time.time(), "instance_id": str(uuid.uuid4()), "results": {}}
    for _ in range(20):
        state["code"] = str(secrets.randbelow(900000) + 100000)
        if await lobby_state_manager.create(state["code"], state):
            return {"code": state["code"], "host_id": user.id, "host_name": state["host_name"],
                    "topic": source.topic, "quiz_session_id": source.id, "total_questions": len(questions)}
    raise HTTPException(503, "Could not allocate a lobby code; retry")


def join_participant(state, user_id, username, tag, connection_id):
    if user_id != state["host_id"] and user_id not in state["participants"]:
        if state["status"] != "waiting_room":
            raise HTTPException(409, "The match has started; only existing players can reconnect")
        if len(state["participants"]) >= 100:
            raise HTTPException(409, "Lobby is full")
        state["participants"][user_id] = {"username": username[:50], "tag": tag[:10], "answers": {}}
    state["connections"][user_id] = connection_id


def end_match(state, user_id):
    if user_id != state["host_id"]:
        raise HTTPException(403, "Only the authenticated host can control the match")
    if state["status"] == "final_results":
        return
    now = time.time()
    state.update(status="final_results", ended_by_host=True, finished_at=now, deadline=None)
    state.setdefault("started_at", now)


async def end_lobby(code, user_id):
    state = await lobby_state_manager.mutate(code, lambda s: end_match(s, user_id))
    state = await finalize_if_needed(code, state)
    await lobby_state_manager.broadcast_to_lobby(code)
    return lobby_snapshot(state, user_id)


def apply_action(state, user_id, message, connection_id):
    if state["connections"].get(user_id) != connection_id:
        raise HTTPException(409, "This connection was replaced; reconnect to resume")
    action = message.get("action")
    if action == "end_quiz":
        end_match(state, user_id)
        return
    if action == "submit_answer":
        if user_id == state["host_id"] or user_id not in state["participants"]:
            raise HTTPException(403, "The host manages this match and does not submit answers")
        if state["status"] != "question_active" or time.time() >= state["deadline"]:
            raise HTTPException(409, "Question is closed")
        qid = state["question_ids"][state["current_question_index"]]
        if message.get("question_id") != qid:
            raise HTTPException(400, "Answer must match the current question")
        option = message.get("selected_option")
        if type(option) is not int or not 0 <= option <= 3:
            raise HTTPException(400, "Choose an option from 0 to 3")
        answers = state["participants"][user_id]["answers"]
        if qid in answers:
            raise HTTPException(409, "Answer already submitted")
        answers[qid] = option
        return
    if action not in {"start_quiz", "advance_question"}:
        raise HTTPException(400, "Unknown lobby action")
    if user_id != state["host_id"]:
        raise HTTPException(403, "Only the authenticated host can control the match")
    if action == "start_quiz":
        if state["status"] != "waiting_room" or not state["participants"]:
            raise HTTPException(409, "Start requires a waiting room with at least one player")
        state["started_at"] = time.time()
        state["current_question_index"] = 0
    elif state["status"] == "question_active":
        state["status"] = "question_results"
        return
    elif state["status"] == "question_results":
        if state["current_question_index"] + 1 == len(state["question_ids"]):
            state["status"] = "final_results"
            state["finished_at"] = time.time()
            return
        state["current_question_index"] += 1
    else:
        raise HTTPException(409, "This match cannot advance from its current state")
    state["status"] = "question_active"
    state["deadline"] = time.time() + 20


async def persist_results(state, db):
    """Deterministic IDs make finalization idempotent across replicas/reconnects."""
    summaries = participants_summary(state)
    session_ids = {p["user_id"]: str(uuid.uuid5(uuid.NAMESPACE_URL, state["instance_id"] + p["user_id"])) for p in summaries}
    existing = set((await db.execute(select(QuizSessionRecord.id).where(QuizSessionRecord.id.in_(session_ids.values())))).scalars())
    for rank, participant in enumerate(summaries, 1):
        uid = participant["user_id"]
        session_id = session_ids[uid]
        if session_id in existing:
            continue
        answers = state["participants"][uid]["answers"]
        details = [{**state["questions"][qid], "question_id": qid, "selected_option": answers.get(qid),
                    "is_correct": answers.get(qid) == state["questions"][qid]["correct_answer"]} for qid in state["question_ids"]]
        db.add(QuizSessionRecord(id=session_id, user_id=uid, quiz_type="lobby", topic=state["topic"],
                                 difficulty=state["difficulty"], score=participant["score"], max_score=len(details) * 2,
                                 correct_count=participant["correct_count"], wrong_count=participant["wrong_count"],
                                 total_time_seconds=max(0, int(state["finished_at"] - state["started_at"])),
                                 rank=rank, details=details, question_ids=state["question_ids"], completed=True))
        db.add_all([QuizAttempt(id=str(uuid.uuid5(uuid.NAMESPACE_URL, session_id + qid)),
                               session_id=session_id, user_id=uid, question_id=qid, selected_option=answer,
                               is_correct=answer == state["questions"][qid]["correct_answer"])
                    for qid, answer in answers.items()])
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        committed = set((await db.execute(select(QuizSessionRecord.id).where(QuizSessionRecord.id.in_(session_ids.values())))).scalars())
        if committed != set(session_ids.values()):
            raise
    records = (await db.execute(select(QuizSessionRecord).where(QuizSessionRecord.id.in_(session_ids.values())))).scalars()
    return {record.user_id: QuizSessionResponse.model_validate(record).model_dump(mode="json") for record in records}


async def finalize_if_needed(code, state):
    if state["status"] == "final_results" and not state["results"]:
        async with async_session_factory() as db:
            results = await persist_results(state, db)
        state = await lobby_state_manager.mutate(code, lambda s: s.update(results=results))
    return state


async def serve_lobby(websocket, code):
    await websocket.accept()
    user_id = None
    connection_id = str(uuid.uuid4())
    try:
        join = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if not isinstance(join, dict) or join.get("action") != "join":
            raise HTTPException(401, "Authenticate before joining")
        claims = decode_token(join.get("token")) if join.get("token") else None
        if not claims or claims.get("type") != "access" or not claims.get("sub"):
            raise HTTPException(401, "Sign in to join this lobby")
        user_id = claims["sub"]
        async with async_session_factory() as db:
            author = await db.get(UserSummaryCache, user_id)
            username = claims.get("username") or (author.username if author else str(join.get("username") or "Scholar"))
            tag = claims.get("tag") or (author.tag if author else str(join.get("tag") or "0001"))
        state = await lobby_state_manager.mutate(code, lambda s: join_participant(s, user_id, username, tag, connection_id))
        await lobby_state_manager.register_local_socket(code, user_id, websocket)
        state = await finalize_if_needed(code, state)
        await websocket.send_json(lobby_snapshot(state, user_id))
        await lobby_state_manager.broadcast_to_lobby(code)
        while True:
            if claims.get("exp", 0) < time.time():
                raise HTTPException(401, "Session expired; sign in again")
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=1)
            except asyncio.TimeoutError:
                # Polling recovers missed pub/sub events and replica failures.
                state = await lobby_state_manager.get_lobby(code)
                if not state:
                    raise HTTPException(404, "Lobby has expired")
                if state["connections"].get(user_id) != connection_id:
                    raise HTTPException(409, "Connection replaced")
                state = await finalize_if_needed(code, state)
                await websocket.send_json(lobby_snapshot(state, user_id))
                continue
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "message": "Invalid message"})
                continue
            try:
                state = await lobby_state_manager.mutate(code, lambda s: apply_action(s, user_id, message, connection_id))
                state = await finalize_if_needed(code, state)
                await lobby_state_manager.broadcast_to_lobby(code)
            except HTTPException as exc:
                await websocket.send_json({"type": "error", "message": exc.detail})
    except WebSocketDisconnect:
        pass
    except (HTTPException, asyncio.TimeoutError) as exc:
        try:
            await websocket.send_json({"type": "error", "message": getattr(exc, "detail", "Join timed out")})
            await websocket.close(code=4401 if getattr(exc, "status_code", 0) == 401 else 1013)
        except WebSocketDisconnect:
            pass
    finally:
        if user_id:
            await lobby_state_manager.unregister_local_socket(code, user_id, websocket)
