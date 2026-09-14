"""
Tests for Quiz module and Histoin reward earnings.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_quiz_and_histoin_reward_flow(client: AsyncClient):
    # 1. Register a student user
    reg_resp = await client.post(
        "/api/auth/register",
        json={
            "username": "QuizChampion",
            "email": "quizchamp@example.com",
            "password": "Password123!",
        },
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get questions for topic
    q_resp = await client.get("/api/quiz/questions?topic=Mughal%20Empire", headers=headers)
    assert q_resp.status_code == 200
    questions = q_resp.json()
    assert len(questions) > 0

    first_q = questions[0]
    q_id = first_q["id"]

    # 3. Submit a quiz attempt (correct answer is index 1 for Babur)
    attempt_payload = {
        "question_id": q_id,
        "selected_option": 1,
        "session_id": "test-session-123",
    }
    att_resp = await client.post("/api/quiz/attempt", json=attempt_payload, headers=headers)
    assert att_resp.status_code == 201
    att_data = att_resp.json()
    assert att_data["is_correct"] is True

    # 4. Check wallet for Histoin reward (+20 Histoins for correct answer)
    wallet_resp = await client.get("/api/wallet/me", headers=headers)
    assert wallet_resp.status_code == 200
    w_data = wallet_resp.json()
    assert w_data["histoin_balance"] >= 20


@pytest.mark.asyncio
async def test_global_leaderboard_sql_aggregation(db_session):
    from datetime import datetime, timezone
    from app.quiz.models import QuizSessionRecord, UserSummaryCache
    from app.quiz.service import get_global_leaderboard, get_global_leaderboard_data

    # 1. Seed users
    u1 = UserSummaryCache(user_id="user-gold", username="GoldWinner", tag="0001", is_banned=False)
    u2 = UserSummaryCache(user_id="user-silver", username="SilverStar", tag="0002", is_banned=False)
    u3 = UserSummaryCache(user_id="user-bronze", username="BronzeChamp", tag="0003", is_banned=False)
    db_session.add_all([u1, u2, u3])

    # 2. Seed sessions
    # GoldWinner: two sessions with scores 50 + 60 = 110
    # SilverStar: one session with score 90
    # BronzeChamp: one session with score 40
    now = datetime.now(timezone.utc)
    s1 = QuizSessionRecord(user_id="user-gold", quiz_type="global", topic="History", score=50, correct_count=5, wrong_count=0, created_at=now)
    s2 = QuizSessionRecord(user_id="user-gold", quiz_type="global", topic="History", score=60, correct_count=6, wrong_count=0, created_at=now)
    s3 = QuizSessionRecord(user_id="user-silver", quiz_type="global", topic="History", score=90, correct_count=9, wrong_count=1, created_at=now)
    s4 = QuizSessionRecord(user_id="user-bronze", quiz_type="global", topic="History", score=40, correct_count=4, wrong_count=2, created_at=now)
    db_session.add_all([s1, s2, s3, s4])
    await db_session.commit()

    # 3. Test get_global_leaderboard SQL window function aggregation
    leaderboard = await get_global_leaderboard(db_session)
    assert len(leaderboard) == 3
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[0]["score"] == 110
    assert leaderboard[0]["user"].username == "GoldWinner"

    assert leaderboard[1]["rank"] == 2
    assert leaderboard[1]["score"] == 90
    assert leaderboard[1]["user"].username == "SilverStar"

    assert leaderboard[2]["rank"] == 3
    assert leaderboard[2]["score"] == 40
    assert leaderboard[2]["user"].username == "BronzeChamp"

    # 4. Test get_global_leaderboard_data
    res = await get_global_leaderboard_data(db_session)
    assert len(res.leaderboard) == 3
    assert res.leaderboard[0].rank == 1
    assert res.leaderboard[0].score == 110
    assert res.leaderboard[1].rank == 2
    assert res.leaderboard[1].score == 90
    assert res.leaderboard[2].rank == 3
    assert res.leaderboard[2].score == 40

