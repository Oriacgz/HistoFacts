"""
Correlation ID context and middleware for distributed tracing across HistoFacts microservices.
Propagates X-Request-ID from API Gateway through downstream inter-service calls and logs.
"""

from contextvars import ContextVar
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

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


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts or generates an X-Request-ID header,
    binds it to the async contextvar for the duration of the request,
    and attaches it to the HTTP response headers.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        incoming_id = request.headers.get("X-Request-ID")
        req_id = incoming_id.strip() if incoming_id else str(uuid.uuid4())

        token = request_id_ctx.set(req_id)
        request.state.request_id = req_id

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx.reset(token)
