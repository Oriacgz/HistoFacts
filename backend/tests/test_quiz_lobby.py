"""Redis-authoritative lobby regression and replica-failure tests."""
import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import fakeredis
import fakeredis.aioredis
import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select, func

from app.quiz import lobby
from app.quiz.lobby_state import LobbyStateManager
from app.quiz.models import QuizQuestion, QuizSessionRecord, QuizAttempt
from app.quiz.generation import fallback_questions
from app.quiz.service import get_global_leaderboard_data, get_user_quiz_history
from app.ai_notes.models import HistoinLedger, HistoinWallet


@pytest_asyncio.fixture
async def replicas(monkeypatch):
    server = fakeredis.FakeServer()
    managers = [LobbyStateManager(redis_client=fakeredis.aioredis.FakeRedis(server=server, decode_responses=True)) for _ in range(2)]
    for manager in managers:
        manager.snapshot = lobby.lobby_snapshot
    monkeypatch.setattr(lobby, "lobby_state_manager", managers[0])
    yield managers
    for manager in managers:
        await manager.close()


async def seed_room(db, replicas, difficulty="medium"):
    questions = [QuizQuestion(topic="History", difficulty=difficulty, **item) for item in fallback_questions(10)]
    db.add_all(questions)
    await db.flush()
    source = QuizSessionRecord(user_id="host", quiz_type="personalized", topic="History", difficulty=difficulty,
                               question_ids=[q.id for q in questions], completed=False)
    db.add(source)
    await db.commit()
    room = await lobby.create_lobby(source.id, SimpleNamespace(id="host", username="Host"), db)
    code = room["code"]
    await replicas[0].mutate(code, lambda s: lobby.join_participant(s, "host", "Host", "0001", "host-connection"))
    await replicas[1].mutate(code, lambda s: lobby.join_participant(s, "player", "Player", "0002", "player-connection"))
    return code, source, questions


async def act(manager, code, action, user="host", **fields):
    return await manager.mutate(code, lambda s: lobby.apply_action(s, user, {"action": action, **fields}, f"{user}-connection"))


@pytest.mark.asyncio
async def test_existing_quiz_is_reused_and_owner_required(db_session, replicas):
    code, source, questions = await seed_room(db_session, replicas)
    state = await replicas[1].get_lobby(code)
    assert state["quiz_session_id"] == source.id
    assert state["question_ids"] == [q.id for q in questions]
    assert (await db_session.execute(select(func.count(QuizQuestion.id)))).scalar_one() == 10
    for invalid in ["missing", source.id]:
        with pytest.raises(HTTPException) as exc:
            await lobby.create_lobby(invalid, SimpleNamespace(id="foreign", username="Other"), db_session)
        assert exc.value.status_code == 404
    assert await replicas[0].redis.ttl(f"lobby:{code}") > 3500


@pytest.mark.asyncio
async def test_player_controls_rejected_and_answers_private(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    for action in ["start_quiz", "advance_question"]:
        with pytest.raises(HTTPException) as exc:
            await act(replicas[1], code, action, "player")
        assert exc.value.status_code == 403
    state = await act(replicas[0], code, "start_quiz")
    qid = state["question_ids"][0]
    state = await act(replicas[1], code, "submit_answer", "player", question_id=qid, selected_option=1)
    snapshot = lobby.lobby_snapshot(state, "player")
    assert "correct_answer" not in snapshot["question"]
    assert "correct_answer" not in snapshot["my_answer_result"]
    state = await act(replicas[0], code, "advance_question")
    assert state["status"] == "question_results"
    assert lobby.lobby_snapshot(state, "player")["question"]["correct_answer"] == 1


@pytest.mark.asyncio
async def test_invalid_duplicate_expired_and_foreign_answers(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    state = await act(replicas[0], code, "start_quiz")
    qid = state["question_ids"][0]
    for value in [True, "1", -1, 4]:
        with pytest.raises(HTTPException):
            await act(replicas[1], code, "submit_answer", "player", question_id=qid, selected_option=value)
    with pytest.raises(HTTPException):
        await act(replicas[1], code, "submit_answer", "player", question_id="foreign", selected_option=1)
    await act(replicas[1], code, "submit_answer", "player", question_id=qid, selected_option=1)
    with pytest.raises(HTTPException):
        await act(replicas[1], code, "submit_answer", "player", question_id=qid, selected_option=1)
    await act(replicas[0], code, "advance_question")
    state = await act(replicas[0], code, "advance_question")
    await replicas[0].mutate(code, lambda s: s.update(deadline=time.time()-1))
    with pytest.raises(HTTPException):
        await act(replicas[1], code, "submit_answer", "player", question_id=state["question_ids"][1], selected_option=0)
    state = await replicas[0].get_lobby(code)
    assert state["status"] == "question_active"  # Expiry never auto-advances; the host does.


@pytest.mark.asyncio
@pytest.mark.parametrize("difficulty,expected", [("easy", 2), ("medium", 1), ("hard", -1)])
async def test_flat_scoring_and_persisted_history_without_rewards(db_session, replicas, difficulty, expected):
    code, _, _ = await seed_room(db_session, replicas, difficulty)
    state = await act(replicas[0], code, "start_quiz")
    for index in range(10):
        qid = state["question_ids"][index]
        if index < 2:
            await act(replicas[1], code, "submit_answer", "player", question_id=qid,
                      selected_option=state["questions"][qid]["correct_answer"] if index == 0 else 1)
        await act(replicas[0], code, "advance_question")
        state = await act(replicas[0], code, "advance_question")
    assert state["status"] == "final_results"
    first = await lobby.persist_results(state, db_session)
    second = await lobby.persist_results(state, db_session)
    assert first == second
    result = first["player"]
    assert result["score"] == expected and result["max_score"] == 20
    assert result["correct_count"] == 1 and result["wrong_count"] == 1 and len(result["details"]) == 10
    assert (await db_session.execute(select(func.count(QuizAttempt.id)))).scalar_one() == 2
    assert (await db_session.execute(select(func.count(HistoinLedger.id)))).scalar_one() == 0
    assert (await db_session.execute(select(func.count(HistoinWallet.user_id)))).scalar_one() == 0
    assert not (await get_global_leaderboard_data(db_session)).leaderboard
    assert (await get_user_quiz_history("player", db_session))[0]["quiz_type"] == "lobby"


@pytest.mark.asyncio
async def test_parallel_replica_updates_preserve_all_players(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    await asyncio.gather(*[replicas[i % 2].mutate(code, lambda s, i=i:
        lobby.join_participant(s, f"scholar-{i}", f"Scholar {i}", "0001", str(i))) for i in range(12)])
    state = await replicas[0].get_lobby(code)
    assert len(state["participants"]) == 13
    assert state["version"] == 14


@pytest.mark.asyncio
async def test_replica_termination_pubsub_and_reconnect_preserve_answers(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    host_socket = SimpleNamespace(send_json=AsyncMock(), close=AsyncMock())
    player_socket = SimpleNamespace(send_json=AsyncMock(), close=AsyncMock())
    await replicas[0].register_local_socket(code, "host", host_socket)
    await replicas[1].register_local_socket(code, "player", player_socket)
    await act(replicas[0], code, "start_quiz")
    state = await replicas[0].get_lobby(code)
    qid = state["question_ids"][0]
    await act(replicas[1], code, "submit_answer", "player", question_id=qid, selected_option=1)
    await replicas[0].broadcast_to_lobby(code)
    for _ in range(100):
        if player_socket.send_json.await_count and host_socket.send_json.await_count:
            break
        await asyncio.sleep(0.01)
    assert player_socket.send_json.await_count == 1 and host_socket.send_json.await_count == 1
    await replicas[0].close()  # Transport/process state disappears; shared Redis survives.
    state = await replicas[1].get_lobby(code)
    assert state["status"] == "question_active"
    await replicas[1].mutate(code, lambda s: lobby.join_participant(s, "player", "Player", "0002", "replacement"))
    state = await replicas[1].get_lobby(code)
    snapshot = lobby.lobby_snapshot(state, "player")
    assert snapshot["current_question_index"] == 0 and snapshot["my_answer_result"]["selected_option"] == 1
    assert snapshot["participants"][0]["score"] == 2
    assert len(state["participants"]) == 1
    with pytest.raises(HTTPException):
        await act(replicas[1], code, "submit_answer", "player", question_id=qid, selected_option=1)


@pytest.mark.asyncio
async def test_no_stale_memory_fallback_after_redis_expiry(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    await replicas[0].redis.delete(f"lobby:{code}")
    assert await replicas[1].get_lobby(code) is None
    with pytest.raises(HTTPException) as exc:
        await act(replicas[1], code, "start_quiz")
    assert exc.value.status_code == 404


class TestSocket:
    __test__ = False

    def __init__(self, messages):
        self.messages = iter(messages)
        self.sent = []
        self.close_code = None

    async def accept(self):
        pass

    async def receive_json(self):
        from starlette.websockets import WebSocketDisconnect
        try:
            return next(self.messages)
        except StopIteration:
            raise WebSocketDisconnect()

    async def send_json(self, message):
        self.sent.append(message)

    async def close(self, code=1000):
        self.close_code = code


@pytest.mark.asyncio
async def test_unauthenticated_socket_cannot_spoof_host(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    socket = TestSocket([{"action": "join", "user_id": "host", "role": "host"}])
    await lobby.serve_lobby(socket, code)
    assert socket.close_code == 4401
    assert socket.sent[0]["type"] == "error"
    assert (await replicas[0].get_lobby(code))["status"] == "waiting_room"


@pytest.mark.asyncio
async def test_authenticated_player_socket_control_and_disconnect(monkeypatch, db_session, replicas):
    from sqlalchemy.ext.asyncio import async_sessionmaker
    code, _, _ = await seed_room(db_session, replicas)
    monkeypatch.setattr(lobby, "async_session_factory", async_sessionmaker(db_session.bind, expire_on_commit=False))
    monkeypatch.setattr(lobby, "decode_token", lambda token: {"type": "access", "sub": "player", "exp": 1e10})
    socket = TestSocket([{"action": "join", "token": "test", "role": "host", "user_id": "host"},
                         {"action": "start_quiz"}])
    await lobby.serve_lobby(socket, code)
    assert any(m.get("message") == "Only the authenticated host can control the match" for m in socket.sent)
    state = await replicas[0].get_lobby(code)
    assert state["status"] == "waiting_room" and "player" in state["participants"]
    assert socket.sent[0]["role"] == "player"
    assert code not in replicas[0]._local_connections


@pytest.mark.asyncio
@pytest.mark.parametrize("phase", ["waiting_room", "question_active", "question_results"])
async def test_host_end_finalizes_every_player_and_reconnect(db_session, replicas, monkeypatch, phase):
    from sqlalchemy.ext.asyncio import async_sessionmaker
    monkeypatch.setattr(lobby, "async_session_factory", async_sessionmaker(db_session.bind, expire_on_commit=False))
    code, _, questions = await seed_room(db_session, replicas)
    await replicas[1].mutate(code, lambda s: lobby.join_participant(s, "second", "Second", "0003", "second-connection"))
    player_socket = SimpleNamespace(send_json=AsyncMock(), close=AsyncMock())
    await replicas[1].register_local_socket(code, "second", player_socket)
    if phase != "waiting_room":
        await act(replicas[0], code, "start_quiz")
        await act(replicas[1], code, "submit_answer", "player", question_id=questions[0].id,
                  selected_option=questions[0].correct_answer)
        if phase == "question_results":
            await act(replicas[0], code, "advance_question")
    with pytest.raises(HTTPException) as exc:
        await lobby.end_lobby(code, "player")
    assert exc.value.status_code == 403
    snapshot = await lobby.end_lobby(code, "host")
    assert snapshot["state"] == "final_results" and snapshot["ended_by_host"]
    assert len(snapshot["leaderboard"]) == 2 and snapshot["time_remaining"] == 0
    for _ in range(100):
        if player_socket.send_json.await_count:
            break
        await asyncio.sleep(0.01)
    assert player_socket.send_json.call_args.args[0]["ended_by_host"]
    assert player_socket.send_json.call_args.args[0]["state"] == "final_results"
    state = await replicas[1].get_lobby(code)
    assert state["results"]["player"]["score"] == (0 if phase == "waiting_room" else 2)
    assert state["results"]["second"]["score"] == 0
    assert len(state["results"]["second"]["details"]) == 10
    finished_at = state["finished_at"]
    assert (await lobby.end_lobby(code, "host"))["leaderboard"] == snapshot["leaderboard"]
    assert (await replicas[0].get_lobby(code))["finished_at"] == finished_at
    with pytest.raises(HTTPException):
        await act(replicas[1], code, "submit_answer", "second", question_id=questions[0].id, selected_option=0)
    with pytest.raises(HTTPException):
        await act(replicas[0], code, "advance_question")
    await replicas[1].mutate(code, lambda s: lobby.join_participant(s, "second", "Second", "0003", "reconnected"))
    assert lobby.lobby_snapshot(await replicas[1].get_lobby(code), "second")["ended_by_host"]
    assert (await db_session.execute(select(func.count(QuizSessionRecord.id)).where(QuizSessionRecord.quiz_type == "lobby"))).scalar_one() == 2
    assert (await db_session.execute(select(func.count(HistoinLedger.id)))).scalar_one() == 0


@pytest.mark.asyncio
async def test_socket_host_end_is_authorized_and_natural_finish_not_relabelled(db_session, replicas):
    code, _, _ = await seed_room(db_session, replicas)
    with pytest.raises(HTTPException) as exc:
        await act(replicas[1], code, "end_quiz", "player")
    assert exc.value.status_code == 403
    state = await act(replicas[0], code, "end_quiz")
    assert state["status"] == "final_results" and state["ended_by_host"]
    await replicas[0].mutate(code, lambda s: s.update(ended_by_host=False))
    state = await act(replicas[0], code, "end_quiz")
    assert not lobby.lobby_snapshot(state, "player")["ended_by_host"]
