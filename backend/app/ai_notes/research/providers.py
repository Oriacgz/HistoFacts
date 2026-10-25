"""Search discovery only: snippets must never be treated as fetched evidence."""
import asyncio
import json
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlsplit, urlunsplit

import httpx


class ResearchUnavailable(Exception):
    """Safe, user-visible research failure with no provider response disclosure."""


@dataclass(frozen=True)
class SearchResult:
    url: str
    title: str
    fixture: bool = False


class SearchProvider(Protocol):
    async def search(self, query: str) -> list[SearchResult]: ...


def canonical_url(value: str) -> str | None:
    try:
        parts = urlsplit(value)
        if (parts.scheme not in {"http", "https"} or not parts.hostname
                or parts.username or parts.password or parts.port not in {None, 80, 443}):
            return None
        return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path or "/", parts.query, ""))
    except (ValueError, TypeError):
        return None


class TavilyProvider:
    def __init__(self, api_key: str, transport=None):
        self.api_key = api_key
        self.transport = transport

    async def search(self, query: str) -> list[SearchResult]:
        if not self.api_key:
            raise ResearchUnavailable("Web Research is unavailable until a search key is configured. Ordinary Notes is still available.")
        try:
            async with httpx.AsyncClient(timeout=15, trust_env=False, transport=self.transport) as client:
                async with asyncio.timeout(20):
                    async with client.stream("POST",
                        "https://api.tavily.com/search",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        json={"query": query, "search_depth": "basic", "max_results": 6,
                              "include_answer": False, "include_raw_content": False,
                              "auto_parameters": False},
                    ) as response:
                        if response.status_code in {401, 403, 429, 432}:
                            raise ResearchUnavailable("Search access or free quota is unavailable. Please try ordinary Notes.")
                        response.raise_for_status()
                        raw = bytearray()
                        async for chunk in response.aiter_bytes():
                            raw.extend(chunk)
                            if len(raw) > 2_000_000:
                                raise ResearchUnavailable("Search response exceeded its size limit.")
                        payload = json.loads(raw)
            rows = payload.get("results") if isinstance(payload, dict) else None
            if not isinstance(rows, list):
                raise ValueError("Malformed search results")
            results, seen = [], set()
            for row in rows[:12]:
                if not isinstance(row, dict):
                    continue
                url = canonical_url(row.get("url"))
                if url and url not in seen:
                    seen.add(url)
                    results.append(SearchResult(url, str(row.get("title") or url)[:300]))
            return results[:6]
        except (httpx.HTTPError, ValueError, TimeoutError) as error:
            raise ResearchUnavailable("Search did not complete. Please retry or use ordinary Notes.") from error


class FixtureProvider:
    """Explicitly injected by tests only; never selected by production settings."""
    def __init__(self, rows: list[SearchResult]):
        self.rows = rows

    async def search(self, query: str) -> list[SearchResult]:
        return [SearchResult(row.url, row.title, fixture=True) for row in self.rows[:6]]
