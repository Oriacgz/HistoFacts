"""
AI enrichment service for generating punchy historical hooks ("Did you know?").
Supports Google Gemini with fallback to Groq.
"""

import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("histofacts.history.enrich")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def generate_history_hook(event_text: str) -> str | None:
    prompt = (
        f"In under 20 words, write one punchy 'did you know' style hook sentence "
        f"based on this historical event. Return ONLY the sentence, no quotes, no preamble.\n\n"
        f"Event: {event_text}"
    )

    raw_hook: str | None = None

    # 1. Attempt Gemini first if key is non-empty
    # TODO: Gemini migrated to the Interactions API (different endpoint/response shape) — re-implement later, using Groq only for now.
    if False and settings.gemini_api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    GEMINI_URL,
                    headers={
                        "x-goog-api-key": settings.gemini_api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {"text": prompt}
                                ]
                            }
                        ]
                    },
                )
                if resp.status_code == 200:
                    try:
                        data = resp.json()
                        raw_hook = data["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError, TypeError) as parse_err:
                        logger.warning(f"Failed to parse Gemini response: {parse_err}")
                else:
                    logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text[:200]}")
        except (httpx.RequestError, httpx.TimeoutException) as http_err:
            logger.warning(f"Gemini API request error: {http_err}")
        except Exception as exc:
            logger.warning(f"Unexpected error calling Gemini API: {exc}")

    # 2. If Gemini failed or was skipped, attempt Groq if key is non-empty
    if not raw_hook and settings.groq_api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
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
                        "max_tokens": 50,
                        "temperature": 0.7,
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

    # 3. If both providers failed or both keys were empty, return None
    if not raw_hook:
        return None

    # 4. Clean and format the extracted hook
    cleaned = raw_hook.strip().strip('"\'').strip()
    if not cleaned:
        return None

    if len(cleaned) > 200:
        cut = cleaned[:200]
        last_space = cut.rfind(" ")
        if last_space > 0:
            cleaned = cut[:last_space].strip()
        else:
            cleaned = cut.strip()

    return cleaned or None
