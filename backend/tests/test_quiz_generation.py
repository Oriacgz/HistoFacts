from datetime import datetime, timezone
import json
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select, func

from app.quiz import generation, sessions
from app.quiz.models import QuizQuestion, QuizSessionRecord
from app.quiz.schemas import GenerateQuizRequest, CompleteQuizRequest
from app.ai_notes.models import HistoinWallet, HistoinLedger


@pytest.mark.asyncio
async def test_malformed_output_retries_then_reports_failure(monkeypatch):
    model = AsyncMock(side_effect=[("{}", 1), ('[{"question": false}]', 1)])
    monkeypatch.setattr(generation, "_chat_complete", model)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json("history")
    assert exc.value.status_code == 502
    assert model.await_count == 2
    assert generation.valid_questions(generation.fallback_questions(40), 40)


@pytest.mark.asyncio
async def test_retry_accepts_valid_response(monkeypatch):
    import json
    data = generation.fallback_questions(10)
    model = AsyncMock(side_effect=[("null", 1), (json.dumps(data), 1)])
    monkeypatch.setattr(generation, "_chat_complete", model)
    assert await generation.generate_and_parse_quiz_json("history") == data
    assert model.await_count == 2


@pytest.mark.parametrize("answer", [True, -1, 4, "0", None])
def test_invalid_answer_keys_rejected(answer):
    data = generation.fallback_questions(10)
    data[0] = {**data[0], "correct_answer": answer}
    assert not generation.valid_questions(data, 10)


@pytest.mark.asyncio
async def test_off_topic_rejected_before_generation(monkeypatch, db_session):
    monkeypatch.setattr(sessions, "is_history_related", AsyncMock(return_value=False))
    model = AsyncMock()
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", model)
    with pytest.raises(HTTPException) as exc:
        await sessions.create_personalized_session(GenerateQuizRequest(topic="Pizza recipes"), "user", db_session)
    assert exc.value.status_code == 400
    model.assert_not_awaited()


def test_pdf_content_validation():
    with pytest.raises(HTTPException) as exc:
        generation.extract_pdf_text(b"This is a text file named history.pdf")
    assert exc.value.status_code == 415
    with pytest.raises(HTTPException) as exc:
        generation.extract_pdf_text(b"%PDF-1.7\ninvalid")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_pool_shared_idempotent_no_answer_leak(monkeypatch, db_session):
    model = AsyncMock(return_value=generation.fallback_questions(40))
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", model)
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    await sessions.generate_global_question_pool(period, db_session)
    await sessions.generate_global_question_pool(period, db_session)
    model.assert_awaited_once()
    first = await sessions.start_global_session("first", db_session)
    second = await sessions.start_global_session("second", db_session)
    assert first["questions"] == second["questions"]
    assert len({q["id"] for q in first["questions"]}) == 40
    assert all("correct_answer" not in q for q in first["questions"])


@pytest.mark.asyncio
async def test_missing_pool_returns_unavailable(db_session):
    with pytest.raises(HTTPException) as exc:
        await sessions.current_global_questions(db_session)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_unavailable_model_does_not_save_static_questions(monkeypatch, db_session):
    model = AsyncMock(side_effect=ConnectionError("Offline"))
    monkeypatch.setattr(generation, "_chat_complete", model)
    with pytest.raises(HTTPException) as exc:
        await sessions.create_personalized_session(GenerateQuizRequest(topic="French Revolution"), "reader", db_session)
    assert exc.value.status_code == 503
    assert (await db_session.execute(select(func.count(QuizQuestion.id)))).scalar_one() == 0
    assert (await db_session.execute(select(func.count(QuizSessionRecord.id)))).scalar_one() == 0


@pytest.mark.asyncio
async def test_distinct_model_responses_are_preserved_and_reasoning_budgeted(monkeypatch):
    first = generation.fallback_questions(10)
    second = [{**item, "question": "New question: " + item["question"]} for item in first]
    model = AsyncMock(side_effect=[(json.dumps(first), 100), ("```\n" + json.dumps(second) + "\n```", 100)])
    monkeypatch.setattr(generation, "_chat_complete", model)
    monkeypatch.setattr(generation.settings, "llm_model", "qwen3-vl-4b-thinking")
    monkeypatch.setattr(generation.settings, "quiz_llm_model", None)
    assert await generation.generate_and_parse_quiz_json("French Revolution") == first
    assert await generation.generate_and_parse_quiz_json("Roman Empire") == second
    assert model.call_args.kwargs["max_tokens"] == 8000


@pytest.mark.asyncio
async def test_quiz_generation_gateway_timeout_does_not_change_other_routes(monkeypatch):
    from types import SimpleNamespace
    from app.gateway.main import proxy_gateway
    import httpx
    client = SimpleNamespace(request=AsyncMock(return_value=httpx.Response(200, json={})))
    request = SimpleNamespace(method="POST", url=SimpleNamespace(query=""), headers={},
                              state=SimpleNamespace(request_id="test"), body=AsyncMock(return_value=b"{}"),
                              app=SimpleNamespace(state=SimpleNamespace(client=client)))
    await proxy_gateway(request, "quiz/personalized/generate")
    assert client.request.call_args.kwargs["timeout"].read == 615
    await proxy_gateway(request, "quiz/history")
    assert "timeout" not in client.request.call_args.kwargs


@pytest.mark.asyncio
async def test_model_timeout_reports_timeout_without_static_quiz(monkeypatch):
    import httpx
    model = AsyncMock(side_effect=httpx.ReadTimeout("Model took too long"))
    monkeypatch.setattr(generation, "_chat_complete", model)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json("History")
    assert exc.value.status_code == 504
    model.assert_awaited_once()


@pytest.mark.asyncio
async def test_history_requires_authentication_instead_of_hiding_expired_login(client):
    response = await client.get("/api/quiz/history")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_completion_authoritative_single_reward(monkeypatch, db_session):
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", AsyncMock(return_value=generation.fallback_questions(40)))
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    await sessions.generate_global_question_pool(period, db_session)
    quiz = await sessions.start_global_session("winner", db_session)
    questions = list((await db_session.execute(select(QuizQuestion))).scalars())
    answers = {q.id: q.correct_answer for q in questions}
    req = CompleteQuizRequest(answers=answers, total_time_seconds=120)
    with pytest.raises(HTTPException) as exc:
        await sessions.complete_session(quiz["session_id"], "other-user", req, db_session)
    assert exc.value.status_code == 404
    result = await sessions.complete_session(quiz["session_id"], "winner", req, db_session)
    assert (result.score, result.max_score, result.correct_count) == (80, 80, 40)
    await sessions.complete_session(quiz["session_id"], "winner", req, db_session)
    assert (await db_session.get(HistoinWallet, "winner")).balance == 80
    assert (await db_session.execute(select(func.count(HistoinLedger.id)))).scalar_one() == 1
    with pytest.raises(HTTPException) as exc:
        await sessions.start_global_session("winner", db_session)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("difficulty,expected", [("easy", 0), ("medium", -10), ("hard", -30)])
async def test_personalized_negative_scores(monkeypatch, db_session, difficulty, expected):
    monkeypatch.setattr(sessions, "is_history_related", AsyncMock(return_value=True))
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", AsyncMock(return_value=generation.fallback_questions(10)))
    quiz = await sessions.create_personalized_session(GenerateQuizRequest(topic="History", difficulty=difficulty), "student", db_session)
    rows = list((await db_session.execute(select(QuizQuestion))).scalars())
    result = await sessions.complete_session(quiz["session_id"], "student",
        CompleteQuizRequest(answers={q.id: (q.correct_answer + 1) % 4 for q in rows}), db_session)
    assert result.score == expected
    assert result.wrong_count == 10
    assert (await db_session.execute(select(func.count(HistoinLedger.id)))).scalar_one() == 0


@pytest.mark.asyncio
async def test_leaderboard_excludes_personalized_unfinished_future(db_session):
    from app.quiz.service import get_global_leaderboard, get_global_leaderboard_data
    db_session.add_all([
        QuizSessionRecord(user_id="official", quiz_type="global", topic="History", score=10),
        QuizSessionRecord(user_id="personal", quiz_type="personalized", topic="History", score=200),
        QuizSessionRecord(user_id="unfinished", quiz_type="global", topic="History", score=200, completed=False),
        QuizSessionRecord(user_id="future", quiz_type="global", topic="History", score=200,
                          created_at=datetime(2099, 1, 1, tzinfo=timezone.utc)),
    ])
    await db_session.commit()
    ranked = await get_global_leaderboard(db_session)
    assert len(ranked) == 1 and ranked[0]["score"] == 10
    response = await get_global_leaderboard_data(db_session)
    assert [r.user_id for r in response.leaderboard] == ["official"]


@pytest.mark.asyncio
async def test_official_api_and_legacy_answer_isolation(monkeypatch, client, db_session):
    from types import SimpleNamespace
    from app.main import app
    from app.core.deps import get_optional_current_user
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", AsyncMock(return_value=generation.fallback_questions(40)))
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    await sessions.generate_global_question_pool(period, db_session)
    public = await client.get("/api/quiz/global/current")
    assert public.status_code == 200 and len(public.json()) == 40
    assert all("correct_answer" not in q for q in public.json())
    legacy = await client.get("/api/quiz/questions")
    official_ids = {q["id"] for q in public.json()}
    assert not official_ids.intersection(q["id"] for q in legacy.json())
    unauthenticated = await client.post("/api/quiz/global/start")
    assert unauthenticated.status_code == 401
    app.dependency_overrides[get_optional_current_user] = lambda: SimpleNamespace(id="api-user")
    start = await client.post("/api/quiz/global/start")
    assert start.status_code == 200
    complete = await client.post(f'/api/quiz/sessions/{start.json()["session_id"]}/complete', json={"answers": {}})
    assert complete.status_code == 200
    assert complete.json()["difficulty"] is None
    assert complete.json()["score"] == 0
    assert complete.json()["rank"] == 1
    invalid_pdf = await client.post("/api/quiz/personalized/from-pdf",
        files={"file": ("history.pdf", b"not a PDF", "application/pdf")})
    assert invalid_pdf.status_code == 415


@pytest.mark.asyncio
async def test_compact_model_output_preserves_public_schema(monkeypatch):
    from types import SimpleNamespace
    questions = generation.fallback_questions(10)
    compact = [{"q": q["question"], "o": q["options"], "a": q["correct_answer"]} for q in questions]
    create = AsyncMock(return_value=SimpleNamespace(
        choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=json.dumps(compact)))],
        usage=SimpleNamespace(total_tokens=900)))
    model = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    context = AsyncMock()
    context.__aenter__.return_value = model
    monkeypatch.setattr(generation, "AsyncOpenAI", lambda **kwargs: context)
    result = await generation.generate_and_parse_quiz_json(generation.QUIZ_PROMPT.format(count=10, difficulty="easy", topic="History"))
    assert result == questions
    schema = create.call_args.kwargs["response_format"]["json_schema"]["schema"]
    assert schema["items"]["required"] == ["q", "o", "a"]
    assert schema["minItems"] == schema["maxItems"] == 10


@pytest.mark.asyncio
async def test_invalid_compact_answers_still_rejected(monkeypatch):
    from types import SimpleNamespace
    compact = [{"q": str(i), "o": ["A", "B", "C", "D"], "a": True} for i in range(10)]
    create = AsyncMock(return_value=SimpleNamespace(
        choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=json.dumps(compact)))], usage=None))
    context = AsyncMock()
    context.__aenter__.return_value = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(generation, "AsyncOpenAI", lambda **kwargs: context)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json("History", max_retries=1)
    assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_repairs_only_missing_questions_without_regenerating_valid_rows(monkeypatch):
    data = generation.fallback_questions(10)
    broken = [*data[:8], data[0], {**data[8], "options": ["A", "A", "B", "C"]}]
    model = AsyncMock(side_effect=[(json.dumps(broken), 900), (json.dumps(data[8:]), 180)])
    monkeypatch.setattr(generation, "_chat_complete", model)
    monkeypatch.setattr(generation.settings, "quiz_llm_model", "qwen3-vl-4b")
    assert await generation.generate_and_parse_quiz_json("History") == data
    assert model.await_args_list[0].kwargs["count"] == 10
    assert model.await_args_list[1].kwargs["count"] == 2
    assert model.await_args_list[1].kwargs["max_tokens"] == 600
    assert "Do not repeat" in model.await_args_list[1].args[0][-1]["content"]


@pytest.mark.asyncio
async def test_partial_repair_never_returns_incomplete_quiz(monkeypatch):
    data = generation.fallback_questions(10)
    model = AsyncMock(return_value=(json.dumps(data[:9]), 900))
    monkeypatch.setattr(generation, "_chat_complete", model)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json("History")
    assert exc.value.status_code == 502
    assert model.await_args_list[1].kwargs["count"] == 1
