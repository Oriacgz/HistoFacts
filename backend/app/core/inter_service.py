"""
Inter-service HTTP client for microservice communication.
Allows services to talk across HTTP boundaries or fallback to local in-process calls.
"""

import httpx
import logging
from app.core.config import settings
from app.core.correlation import get_request_id

logger = logging.getLogger("histofacts.inter_service")


def _get_internal_headers() -> dict[str, str]:
    headers = {"X-Internal-Secret": settings.secret_key}
    req_id = get_request_id()
    if req_id:
        headers["X-Request-ID"] = req_id
    return headers


async def call_auth_get_user_summary(user_id: str) -> dict | None:
    """Fetch user summary from Auth service internal API."""
    headers = _get_internal_headers()
    urls = [
        f"{settings.auth_service_url}/api/auth/internal/users/{user_id}/summary",
        f"{settings.auth_service_url}/internal/users/{user_id}/summary",
    ]
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.warning(f"Inter-service HTTP call to {url} failed: {e}")
    return None


async def call_notes_init_wallet(user_id: str) -> bool:
    """Notify AI Notes Service to initialize a new user's wallet with signup bonus."""
    url = f"{settings.notes_service_url}/api/wallet/internal/init"
    headers = _get_internal_headers()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json={"user_id": user_id}, headers=headers)
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.warning(f"Inter-service HTTP call to {url} failed: {e}. Falling back to in-process logic.")
        return False


async def call_notes_reward_quiz(user_id: str, amount: int = 20) -> bool:
    """Notify AI Notes Service to credit Histoins for correct quiz attempt."""
    url = f"{settings.notes_service_url}/api/wallet/internal/reward-quiz"
    headers = _get_internal_headers()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json={"user_id": user_id, "amount": amount}, headers=headers)
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.warning(f"Inter-service HTTP call to {url} failed: {e}. Falling back to in-process logic.")
        return False


async def notify(user_id: str, type: str, payload: dict) -> None:
    """Fire-and-forget. A notification-service outage must never break the action that triggered it."""
    url = f"{settings.notification_service_url}/internal/notifications"
    headers = _get_internal_headers()
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                url,
                json={"user_id": str(user_id), "type": type, "payload": payload},
                headers=headers,
            )
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning(f"Notification service unreachable — skipped '{type}' for user {user_id}: {e}")
    except Exception as e:
        logger.warning(f"Unexpected error calling notification service for user {user_id}: {e}")

