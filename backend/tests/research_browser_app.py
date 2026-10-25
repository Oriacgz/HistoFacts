"""Manual browser fixture app. NEVER use as the normal application entrypoint.

Run only with an isolated DATABASE_URL. No public web requests or real model
calls are made by researched answers. Every source is explicitly fixture-labelled.
"""
import json
import asyncio
from app.main import app
from app.core.config import settings
from app.ai_notes.research import lifecycle
from app.ai_notes.research.service import research_answer
from app.ai_notes.research.providers import FixtureProvider, SearchResult
from app.ai_notes.research.fetcher import Page

if not any(name in settings.database_url for name in ["research-browser-qa.local.db", "research-completion-qa.local.db"]):
    raise RuntimeError("Browser fixtures require the dedicated research QA database")

settings.tavily_api_key = "fixture-only-not-a-real-key"
TEXT = "Ashoka fought the Kalinga war and later supported Buddhism throughout his empire."


async def fetch(url, *, check_policy=None, allow_pdf=False):
    if check_policy:
        await check_policy(url)
    return Page(url, b"User-agent: *\nAllow: /" if url.endswith("robots.txt") else TEXT.encode(), "text/plain")


async def complete(messages, **options):
    if "query" in (options.get("response_schema") or {}).get("properties",{}):
        return json.dumps({"query":"Ashoka Kalinga Buddhism","needs_clarification":False}),20
    return json.dumps({"paragraphs": [{"text": "Ashoka supported Buddhism throughout his empire.",
        "evidence": [{"passage_id": "S1P1", "quote": "Ashoka fought the Kalinga war"}]}]}), 120


async def fixture_answer(question, root_topic=None, think=False, progress=None, depth="standard", context_topics=None):
    await asyncio.sleep(20)  # Deliberate fixture delay makes Stop/progress browser-testable.
    async def assess(raw, sources):
        return {"source_disagreement":False,"model_tokens":0}
    return await research_answer(question, root_topic, think, progress,
        FixtureProvider([SearchResult("https://museum.example/ashoka", "Museum historical evidence (fixture)")]),
        fetch, complete, depth=depth, assess=assess, context_topics=context_topics)


lifecycle.research_answer = fixture_answer

