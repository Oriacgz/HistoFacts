"""
Tests for API Gateway routing and service resolution.
"""

import pytest
from app.gateway.main import resolve_target_service, SERVICE_ROUTES


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["notes/generate/stream", "notes/note-id/continue/stream"])
async def test_notes_proxy_forwards_without_buffering_and_closes_upstream(path):
    import httpx
    from types import SimpleNamespace
    from starlette.requests import Request
    from app.gateway.main import proxy_gateway

    class UpstreamStream(httpx.AsyncByteStream):
        consumed = False
        closed = False

        async def __aiter__(self):
            self.consumed = True
            yield b'data: {"delta":"History"}\n\n'
            yield b'data: [DONE]\n\n'

        async def aclose(self):
            self.closed = True

    stream = UpstreamStream()

    def upstream(request):
        assert request.extensions["timeout"]["read"] == 615
        assert request.headers["authorization"] == "Bearer test-token"
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=stream)

    async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
        scope = {"type": "http", "method": "POST", "path": f"/api/{path}",
                 "query_string": b"", "headers": [(b"authorization", b"Bearer test-token")],
                 "app": SimpleNamespace(state=SimpleNamespace(client=client))}

        async def receive():
            return {"type": "http.request", "body": b"{}", "more_body": False}

        response = await proxy_gateway(Request(scope, receive), path)
        assert not stream.consumed  # Headers return before generation finishes.
        assert response.headers["x-accel-buffering"] == "no"
        chunks = [chunk async for chunk in response.body_iterator]
        assert chunks == [b'data: {"delta":"History"}\n\n', b'data: [DONE]\n\n']
        assert stream.closed


@pytest.mark.asyncio
async def test_notes_proxy_preserves_auth_errors():
    import httpx
    from types import SimpleNamespace
    from starlette.requests import Request
    from app.gateway.main import proxy_gateway

    async with httpx.AsyncClient(transport=httpx.MockTransport(
        lambda request: httpx.Response(401, json={"detail": "Invalid token"})
    )) as client:
        scope = {"type": "http", "method": "POST", "path": "/api/notes/generate/stream",
                 "query_string": b"", "headers": [],
                 "app": SimpleNamespace(state=SimpleNamespace(client=client))}

        async def receive():
            return {"type": "http.request", "body": b"{}", "more_body": False}

        response = await proxy_gateway(Request(scope, receive), "notes/generate/stream")
        assert response.status_code == 401
        assert b"Invalid token" in b"".join([chunk async for chunk in response.body_iterator])


def test_gateway_route_resolution():
    # 1. Auth route
    target = resolve_target_service("/api/auth/login")
    assert target is not None
    assert target[0].endswith("8001")

    # 2. Events route
    target = resolve_target_service("/api/events/today")
    assert target is not None
    assert target[0].endswith("8002")

    # 3. Social & Chat routes
    target = resolve_target_service("/api/social/posts")
    assert target is not None
    assert target[0].endswith("8003")

    target_chat = resolve_target_service("/api/chat/conversations")
    assert target_chat is not None
    assert target_chat[0].endswith("8003")

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

    # 7. Notification route
    assert resolve_target_service("/api/notifications")[0].endswith("8007")

    # 8. Unknown route
    assert resolve_target_service("/api/unknown/endpoint") is None

