"""
AI enrichment service for generating punchy historical hooks ("Did you know?").
Powered by Groq with allam-2-7b.
"""

import logging
import re
import httpx
from app.core.config import settings

logger = logging.getLogger("histofacts.history.enrich")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Shared HTTP client for connection pooling
_client: httpx.AsyncClient | None = None


def _get_groq_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=8.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _client


async def generate_history_hook(event_text: str) -> str | None:
    if not settings.groq_api_key:
        return None

    prompt = (
        "You are a master historical curator. Transform the following historical event "
        "into a single, captivating question starting strictly with 'Did you know that' "
        "and ending with a question mark (?).\n"
        "Requirements:\n"
        "- Exactly ONE sentence\n"
        "- Under 25 words\n"
        "- Absolutely no quotes, introductory text, or markdown\n\n"
        f"Historical Event: {event_text}"
    )

    raw_hook: str | None = None

    try:
        client = _get_groq_client()
        resp = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "allam-2-7b",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 75,
                "temperature": 0.6,
            },
        )
        if resp.status_code == 200:
            try:
                data = resp.json()
                raw_hook = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError) as parse_err:
                logger.warning(f"Failed to parse Groq response: {parse_err}")
        else:
            logger.warning(f"Groq API returned status {resp.status_code}: {resp.text[:200]}")
    except (httpx.RequestError, httpx.TimeoutException) as http_err:
        logger.warning(f"Groq API request error: {http_err}")
    except Exception as exc:
        logger.warning(f"Unexpected error calling Groq API: {exc}")

    if not raw_hook:
        return None

    # Clean and format the extracted hook
    cleaned = raw_hook.strip().strip('"\'').strip()

    # Remove any stray <think> tags if ever present
    if "<think>" in cleaned and "</think>" in cleaned:
        cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()

    if not cleaned:
        return None

    if len(cleaned) > 200:
        cut = cleaned[:200]
        last_space = cut.rfind(" ")
        if last_space > 0:
            cleaned = cut[:last_space].strip()
        else:
            cleaned = cut.strip()

    # Ensure it ends with appropriate punctuation
    if cleaned and cleaned[-1] not in ".?!":
        cleaned += "?"

    return cleaned or None

