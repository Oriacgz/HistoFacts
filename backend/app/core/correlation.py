"""
Correlation ID context and middleware for distributed tracing across HistoFacts microservices.
Propagates X-Request-ID from API Gateway through downstream inter-service calls and logs.
"""

from contextvars import ContextVar
import logging
import uuid
from starlette.datastructures import Headers, MutableHeaders

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str:
    """Return the current correlation request ID, or generate a fallback if outside request context."""
    req_id = request_id_ctx.get()
    return req_id or ""


class CorrelationLogFilter(logging.Filter):
    """Logging filter that injects the active correlation request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        req_id = get_request_id()
        record.request_id = f"[{req_id}] " if req_id else ""
        return True


class CorrelationIdMiddleware:
    """
    Middleware that extracts or generates an X-Request-ID header,
    binds it to the async contextvar for the duration of the request,
    and attaches it to the HTTP response headers.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        incoming_id = Headers(scope=scope).get('X-Request-ID', '').strip()
        req_id = incoming_id or str(uuid.uuid4())

        token = request_id_ctx.set(req_id)
        scope.setdefault('state', {})['request_id'] = req_id

        async def traced_send(message):
            if message['type'] == 'http.response.start':
                MutableHeaders(scope=message)['X-Request-ID'] = req_id
            await send(message)

        try:
            # Pure ASGI preserves disconnect notifications and streaming backpressure.
            await self.app(scope, receive, traced_send)
        finally:
            request_id_ctx.reset(token)
