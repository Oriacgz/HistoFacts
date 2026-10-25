"""Opt-in live gateway/model/Redis smoke test using disposable test identities.

Run manually from backend: venv/Scripts/python.exe tests/quiz_live_smoke.py
Use --reuse-model-proof to retest lobbies with saved real-model output.
Signs short-lived tokens for new test subjects; never impersonates existing users.
Deletes only its own quiz records and Redis room when done.
"""
import asyncio
import os
import json
import sys
import time
import uuid
import secrets
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import redis.asyncio as redis
import websockets
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import async_session_factory, engine
from app.core.security import create_access_token, hash_password
from app.auth.models import User
from app.quiz.models import QuizAttempt, QuizQuestion, QuizSessionRecord, UserSummaryCache


async def snapshot(socket, predicate):
    async with asyncio.timeout(15):
        while True:
            message = json.loads(await socket.recv())
            if message.get("type") == "error":
                raise AssertionError(message["message"])
            if message.get("type") == "room_state" and predicate(message):
                return message


async def main():
    base_url = os.environ.get("QUIZ_SMOKE_BASE_URL", "http://127.0.0.1:8000")
    ws_base = base_url.replace("http://", "ws://").replace("https://", "wss://")
    host_id, player_id = str(uuid.uuid4()), str(uuid.uuid4())
    tokens = [create_access_token({"sub": uid, "username": name, "tag": "0001"},
                                 expires_delta=timedelta(minutes=15))
              for uid, name in [(host_id, "QuizSmokeHost"), (player_id, "QuizSmokePlayer")]]
    question_ids, code = [], None
    redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    try:
        # PostgreSQL retains the initial schema's attempt-to-user foreign key.
        async with async_session_factory() as db:
            db.add_all([User(id=uid, username="QuizSmoke_" + uid[:8], tag="0001",
                             email=uid + "@quiz-smoke.invalid", password_hash=hash_password(secrets.token_urlsafe(32)))
                        for uid in [host_id, player_id]])
            await db.commit()
        async with httpx.AsyncClient(base_url=base_url, timeout=615) as client:
            headers = {"Authorization": f"Bearer {tokens[0]}"}
            started = time.monotonic()
            if "--reuse-model-proof" in sys.argv:
                proof = Path(__file__).resolve().parents[1] / ".pytest_cache/quiz-live-generation.json"
                from app.quiz.generation import valid_questions
                data = json.loads(proof.read_text(encoding="utf-8"))
                assert valid_questions(data, 10)
                async with async_session_factory() as db:
                    questions = [QuizQuestion(topic="Live model smoke proof", difficulty="medium", **item) for item in data]
                    db.add_all(questions)
                    await db.flush()
                    source = QuizSessionRecord(user_id=host_id, quiz_type="personalized", topic="Live model smoke proof",
                                               difficulty="medium", completed=False, question_ids=[q.id for q in questions])
                    db.add(source)
                    await db.commit()
                    quiz = {"session_id": source.id, "questions": [{"id": q.id} for q in questions]}
                print("Reusing saved real-model output for lobby/recording tests", flush=True)
            else:
                response = await client.post("/api/quiz/personalized/generate", headers=headers,
                                             json={"topic": "Ancient Roman emperors and well-established dates", "difficulty": "medium"})
                response.raise_for_status()
                quiz = response.json()
            question_ids = [q["id"] for q in quiz["questions"]]
            assert len(question_ids) == 10 and all("correct_answer" not in q for q in quiz["questions"])
            if "--reuse-model-proof" not in sys.argv:
                print(f"LIVE gateway generation: 10 questions in {time.monotonic() - started:.1f}s", flush=True)
            response = await client.post("/api/quiz/lobby/create", headers=headers,
                                         json={"quiz_session_id": quiz["session_id"]})
            response.raise_for_status()
            code = response.json()["code"]
            async with websockets.connect(f"{ws_base}/api/quiz/lobby/{code}/ws") as host:
                await host.send(json.dumps({"action": "join", "token": tokens[0]}))
                await snapshot(host, lambda m: m["role"] == "host")
                async with websockets.connect(f"{ws_base}/api/quiz/lobby/{code}/ws") as player:
                    await player.send(json.dumps({"action": "join", "token": tokens[1]}))
                    await snapshot(player, lambda m: m["role"] == "player")
                    await snapshot(host, lambda m: len(m["participants"]) == 1)
                    await host.send(json.dumps({"action": "start_quiz"}))
                    first = await snapshot(player, lambda m: m["state"] == "question_active")
                    assert "correct_answer" not in first["question"]
                    await player.send(json.dumps({"action": "submit_answer", "question_id": first["question"]["id"], "selected_option": 0}))
                    await snapshot(player, lambda m: m["my_answer_result"] is not None)
                    if "--end-early" in sys.argv:
                        stopped = await client.post(f"/api/quiz/lobby/{code}/end", headers=headers)
                        stopped.raise_for_status()
                        assert stopped.json()["ended_by_host"]
                        await snapshot(host, lambda m: m["state"] == "final_results" and m["ended_by_host"])
                    else:
                        for index in range(10):
                            await host.send(json.dumps({"action": "advance_question"}))
                            await snapshot(host, lambda m: m["state"] == "question_results" and m["current_question_index"] == index)
                            await host.send(json.dumps({"action": "advance_question"}))
                            await snapshot(host, lambda m: m["state"] == ("final_results" if index == 9 else "question_active")
                                           and m["current_question_index"] == (9 if index == 9 else index + 1))
                    final = await snapshot(player, lambda m: m["state"] == "final_results" and m["result"] is not None)
                    assert len(final["result"]["details"]) == 10
                    if "--end-early" in sys.argv:
                        assert final["ended_by_host"] and len(final["leaderboard"]) == 1
                        assert final["current_question_index"] == 0 and final["time_remaining"] == 0
                        print("LIVE host stop delivered final score and leaderboard to player: passed", flush=True)
            player_headers = {"Authorization": f"Bearer {tokens[1]}"}
            response = await client.get("/api/quiz/history", headers=player_headers)
            response.raise_for_status()
            history = response.json()
            assert len(history) == 1 and history[0]["quiz_type"] == "lobby"
            detail = await client.get(f'/api/quiz/history/{history[0]["id"]}', headers=player_headers)
            detail.raise_for_status()
            assert len(detail.json()["details"]) == 10
            assert sum(item["selected_option"] is None for item in detail.json()["details"]) == 9
            foreign = await client.get(f'/api/quiz/history/{history[0]["id"]}', headers=headers)
            assert foreign.status_code == 404
            print("LIVE Redis lobby, gateway WebSockets, answer submission, final history and ownership: passed", flush=True)
            payload = {"answers": {qid: 0 for qid in question_ids}, "total_time_seconds": 10}
            result = await client.post(f'/api/quiz/sessions/{quiz["session_id"]}/complete', headers=headers, json=payload)
            result.raise_for_status()
            again = await client.post(f'/api/quiz/sessions/{quiz["session_id"]}/complete', headers=headers, json=payload)
            again.raise_for_status()
            assert result.json()["score"] == again.json()["score"]
            assert len(result.json()["details"]) == 10
            print("LIVE practice completion and idempotent scoring: passed", flush=True)
    finally:
        if code:
            raw = await redis_client.get(f"lobby:{code}")
            if raw and json.loads(raw).get("host_id") == host_id:
                await redis_client.delete(f"lobby:{code}")
        await redis_client.aclose()
        async with async_session_factory() as db:
            owned_questions = (await db.execute(select(QuizSessionRecord.question_ids).where(
                QuizSessionRecord.user_id.in_([host_id, player_id])))).scalars()
            question_ids = list({qid for ids in owned_questions if ids for qid in ids})
            await db.execute(delete(QuizAttempt).where(QuizAttempt.user_id.in_([host_id, player_id])))
            await db.execute(delete(QuizSessionRecord).where(QuizSessionRecord.user_id.in_([host_id, player_id])))
            if question_ids:
                await db.execute(delete(QuizQuestion).where(QuizQuestion.id.in_(question_ids)))
            await db.execute(delete(UserSummaryCache).where(UserSummaryCache.user_id.in_([host_id, player_id])))
            await db.execute(delete(User).where(User.id.in_([host_id, player_id])))
            await db.commit()
        await engine.dispose()
        print("Disposable smoke-test data cleaned up", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
