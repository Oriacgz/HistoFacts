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
