import asyncio
import httpx
import pytest

from app.ai_notes.research.providers import TavilyProvider, FixtureProvider, SearchResult, ResearchUnavailable
from app.ai_notes.research.queries import plan_query


def test_query_uses_only_question_and_minimal_root():
    assert plan_query("Why did he do that?", "Ashoka and Kalinga").startswith("Ashoka and Kalinga")
    assert "example.com" not in plan_query("Ashoka me@example.com https://example.com/private")
    assert len(plan_query("a" * 4000)) <= 360


@pytest.mark.asyncio
async def test_missing_key_never_attempts_network():
    with pytest.raises(ResearchUnavailable, match="search key"):
        await TavilyProvider("").search("Ashoka")


@pytest.mark.asyncio
async def test_adapter_discovery_dedup_and_fixed_free_depth():
    async def handler(request):
        import json
        body = json.loads(request.content)
        assert body["search_depth"] == "basic"
        assert body["include_raw_content"] is False
        assert body["auto_parameters"] is False
        return httpx.Response(200, json={"results": [
            {"url": "https://museum.org/history#one", "title": "History"},
            {"url": "https://museum.org/history#two"},
            {"url": "file:///secret"}, {"url": "https://user:pass@museum.org/"},
        ]})
    rows = await TavilyProvider("private", httpx.MockTransport(handler)).search("Ashoka")
    assert [row.url for row in rows] == ["https://museum.org/history"]
    assert not rows[0].fixture


@pytest.mark.asyncio
@pytest.mark.parametrize("code", [401, 403, 429, 432, 500])
async def test_provider_errors_are_safe(code):
    transport = httpx.MockTransport(lambda req: httpx.Response(code, text="private response"))
    with pytest.raises(ResearchUnavailable) as error:
        await TavilyProvider("secret", transport).search("Ashoka")
    assert "private response" not in str(error.value)
    assert "secret" not in str(error.value)


@pytest.mark.asyncio
async def test_malformed_response_and_cancellation():
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json={"results": "invalid"}))
    with pytest.raises(ResearchUnavailable):
        await TavilyProvider("key", transport).search("Ashoka")
    async def cancelled(request):
        raise asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):
        await TavilyProvider("key", httpx.MockTransport(cancelled)).search("Ashoka")


@pytest.mark.asyncio
async def test_fixture_is_labelled():
    rows = await FixtureProvider([SearchResult("https://museum.org/", "Museum")]).search("Ashoka")
    assert rows[0].fixture
