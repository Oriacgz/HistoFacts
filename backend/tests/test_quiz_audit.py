from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from sqlalchemy import select, func, event

from app.quiz import sessions, generation
from app.quiz.models import QuizSessionRecord, QuizQuestion, GlobalQuizPool, UserSummaryCache
from app.quiz.schemas import GenerateQuizRequest, CompleteQuizRequest
from app.quiz.service import get_global_leaderboard_data
from app.ai_notes.models import HistoinLedger


@pytest.mark.asyncio
async def test_rank_beyond_limit_and_batched_queries(db_session):
    db_session.add_all([
        QuizSessionRecord(user_id=uid, quiz_type="global", topic="History", score=score)
        for uid, score in [("gold", 20), ("silver", 10), ("bronze", 2)]
    ])
    db_session.add_all([UserSummaryCache(user_id=uid, username=uid, tag="0001")
                        for uid in ["gold", "silver", "bronze"]])
    await db_session.commit()
    statements = []

    def record_statement(conn, cursor, statement, parameters, context, many):
        statements.append(statement)

    engine = db_session.bind.sync_engine
    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        result = await get_global_leaderboard_data(db_session, SimpleNamespace(id="bronze"), limit=1)
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)
    assert result.current_user_rank == 3
    assert [row.user_id for row in result.leaderboard] == ["gold"]
    assert len(statements) == 2
    assert "rank() OVER" in statements[0]


@pytest.mark.asyncio
async def test_global_negative_score_has_no_reward(monkeypatch, db_session):
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", AsyncMock(return_value=generation.fallback_questions(40)))
    from datetime import datetime, timezone
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    await sessions.generate_global_question_pool(period, db_session)
    quiz = await sessions.start_global_session("learner", db_session)
    questions = list((await db_session.execute(select(QuizQuestion))).scalars())
    result = await sessions.complete_session(quiz["session_id"], "learner", CompleteQuizRequest(
        answers={q.id: (q.correct_answer + 1) % 4 for q in questions}), db_session)
    assert result.score == -80 and result.wrong_count == 40
    assert (await db_session.execute(select(func.count(HistoinLedger.id)))).scalar_one() == 0


@pytest.mark.asyncio
async def test_foreign_question_rejected_without_completing(monkeypatch, db_session):
    monkeypatch.setattr(sessions, "is_history_related", AsyncMock(return_value=True))
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", AsyncMock(return_value=generation.fallback_questions(10)))
    quiz = await sessions.create_personalized_session(GenerateQuizRequest(topic="History"), "learner", db_session)
    with pytest.raises(HTTPException) as exc:
        await sessions.complete_session(quiz["session_id"], "learner", CompleteQuizRequest(answers={"foreign": 0}), db_session)
    assert exc.value.status_code == 400
    assert not (await db_session.get(QuizSessionRecord, quiz["session_id"])).completed


@pytest.mark.asyncio
async def test_corrupt_published_pool_is_not_reported_ready(db_session):
    db_session.add(GlobalQuizPool(period="2026-10"))
    await db_session.commit()
    with pytest.raises(HTTPException) as exc:
        await sessions.generate_global_question_pool("2026-10", db_session)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_blank_topic_does_not_call_classifier(monkeypatch, db_session):
    classifier = AsyncMock()
    monkeypatch.setattr(sessions, "is_history_related", classifier)
    with pytest.raises(HTTPException):
        await sessions.personalized_questions(GenerateQuizRequest(topic="   "), db_session)
    classifier.assert_not_awaited()


@pytest.mark.asyncio
async def test_provider_failure_reports_unavailable_without_repeated_timeout(monkeypatch):
    model = AsyncMock(side_effect=ConnectionError("Unavailable"))
    monkeypatch.setattr(generation, "_chat_complete", model)
    with pytest.raises(HTTPException) as exc:
        await generation.generate_and_parse_quiz_json("History", max_retries=3)
    assert exc.value.status_code == 503
    model.assert_awaited_once()


def test_real_pdf_extraction_and_context_limit():
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({
        NameObject("/F1"): DictionaryObject({NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})})})
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 750 Td (" + b"World History Roman Empire " * 200 + b") Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    extracted = generation.extract_pdf_text(output.getvalue())
    assert extracted.startswith("World History") and len(extracted) == 4000
    writer.encrypt("secret")
    output = BytesIO()
    writer.write(output)
    with pytest.raises(HTTPException) as exc:
        generation.extract_pdf_text(output.getvalue())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_history_pages_summaries_and_protects_unfinished_details(db_session):
    from app.quiz.service import get_user_quiz_history, get_quiz_session_detail
    records = [QuizSessionRecord(user_id="reader", quiz_type="personalized", topic=str(i),
                                  details=[{"question": "Large answer review"}]) for i in range(3)]
    draft = QuizSessionRecord(user_id="reader", quiz_type="personalized", topic="Draft", completed=False)
    other = QuizSessionRecord(user_id="other", quiz_type="personalized", topic="Private")
    db_session.add_all([*records, draft, other])
    await db_session.commit()
    first = await get_user_quiz_history("reader", db_session, limit=2)
    last = await get_user_quiz_history("reader", db_session, limit=2, offset=2)
    assert len(first) == 2 and len(last) == 1
    assert len({row["id"] for row in first + last}) == 3
    assert all("details" not in row for row in first + last)
    assert await get_quiz_session_detail(draft.id, "reader", db_session) is None
    assert await get_quiz_session_detail(other.id, "reader", db_session) is None
    assert (await get_quiz_session_detail(records[0].id, "reader", db_session)).details


@pytest.mark.asyncio
async def test_history_join_preserves_order_unanswered_and_constant_query_count(monkeypatch, db_session):
    from app.quiz.service import get_user_quiz_history, get_quiz_session_detail
    monkeypatch.setattr(sessions, "is_history_related", AsyncMock(return_value=True))
    monkeypatch.setattr(sessions, "generate_and_parse_quiz_json", AsyncMock(return_value=generation.fallback_questions(10)))
    quiz = await sessions.create_personalized_session(GenerateQuizRequest(topic="History"), "reader", db_session)
    ids = [question["id"] for question in quiz["questions"]]
    await sessions.complete_session(quiz["session_id"], "reader", CompleteQuizRequest(answers={ids[0]: 0}), db_session)
    statements = []
    def record(conn, cursor, statement, parameters, context, many):
        statements.append(statement)
    engine = db_session.bind.sync_engine
    event.listen(engine, "before_cursor_execute", record)
    try:
        history = await get_user_quiz_history("reader", db_session)
        assert len(history) == 1 and len(statements) == 1
        statements.clear()
        detail = await get_quiz_session_detail(quiz["session_id"], "reader", db_session)
        assert len(statements) == 2  # Ownership lookup, then one joined breakdown.
        assert "LEFT OUTER JOIN quiz_attempts" in statements[1]
        assert [item["question_id"] for item in detail.details] == ids
        assert detail.details[0]["selected_option"] == 0
        assert all(item["selected_option"] is None and item["points"] == 0 for item in detail.details[1:])
        assert not db_session.dirty
    finally:
        event.remove(engine, "before_cursor_execute", record)
