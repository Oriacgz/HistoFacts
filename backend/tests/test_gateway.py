"""
Tests for API Gateway routing and service resolution.
"""

import pytest
from app.gateway.main import resolve_target_service, SERVICE_ROUTES


def test_gateway_route_resolution():
    # 1. Auth route
    target = resolve_target_service("/api/auth/login")
    assert target is not None
    assert target[0].endswith("8001")

    # 2. Events route
    target = resolve_target_service("/api/events/today")
    assert target is not None
    assert target[0].endswith("8002")

    # 3. Social route
    target = resolve_target_service("/api/social/posts")
    assert target is not None
    assert target[0].endswith("8003")

    # 4. Groups route
    target = resolve_target_service("/api/groups")
    assert target is not None
    assert target[0].endswith("8004")

    # 5. Notes, Wallet, Shop routes
    assert resolve_target_service("/api/notes/generate")[0].endswith("8005")
    assert resolve_target_service("/api/wallet/me")[0].endswith("8005")
    assert resolve_target_service("/api/shop/packs")[0].endswith("8005")

    # 6. Quiz route
    assert resolve_target_service("/api/quiz/questions")[0].endswith("8006")

    # 7. Unknown route
    assert resolve_target_service("/api/unknown/endpoint") is None
