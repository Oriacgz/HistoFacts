"""
Sync job service for pulling daily historical facts from external APIs
(Wikimedia On This Day API) into local PostgreSQL database.
"""

import httpx
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.history.models import HistoricalEvent
from app.history.enrich import generate_history_hook

WIKIMEDIA_ON_THIS_DAY_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/{month}/{day}"
WIKIMEDIA_EVENTS_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/{month}/{day}"
WIKIMEDIA_BIRTHS_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/births/{month}/{day}"
WIKIMEDIA_DEATHS_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/deaths/{month}/{day}"
WIKIMEDIA_HOLIDAYS_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/holidays/{month}/{day}"

SAMPLE_EVENTS = [
    {
        "date": "03-17",
        "year": "461 AD",
        "title": "Death of Saint Patrick",
        "description": "Saint Patrick, the patron saint of Ireland, dies in Saul. His life, mission, and legend shaped the spiritual and cultural landscape of Ireland and the Western world for centuries.",
        "category": "Religion & Culture",
        "country": "Ireland",
        "source": "Wikimedia",
        "source_url": "https://en.wikipedia.org/wiki/Saint_Patrick",
    },
    {
        "date": "03-17",
        "year": "1801",
        "title": "First Meeting of Union Parliament",
        "description": "The Union Parliament meets for the first time, following the Act of Union between Great Britain and Ireland.",
        "category": "Politics",
        "country": "United Kingdom",
        "source": "Wikimedia",
        "source_url": "https://en.wikipedia.org/wiki/Acts_of_Union_1800",
    },
    {
        "date": "03-17",
        "year": "1959",
        "title": "Dalai Lama Flees Tibet",
        "description": "Tenzin Gyatso, the 14th Dalai Lama, flees Tibet for India during the Tibetan uprising.",
        "category": "World History",
        "country": "India / Tibet",
        "source": "Wikimedia",
        "source_url": "https://en.wikipedia.org/wiki/14th_Dalai_Lama",
    },
    {
        "date": "08-15",
        "year": "1947",
        "title": "Indian Independence",
        "description": "India gains independence from British rule after decades of freedom movement led by Mahatma Gandhi and other nationalist leaders.",
        "category": "Independence & Freedom",
        "country": "India",
        "source": "Wikimedia",
        "source_url": "https://en.wikipedia.org/wiki/Indian_Independence_Act_1947",
    },
    {
        "date": "01-26",
        "year": "1950",
        "title": "Republic Day of India",
        "description": "The Constitution of India comes into effect, replacing the Government of India Act 1935 and turning the nation into a newly formed republic.",
        "category": "Constitution & Governance",
        "country": "India",
        "source": "Wikimedia",
        "source_url": "https://en.wikipedia.org/wiki/Republic_Day_(India)",
    },
]


async def seed_initial_events(db: AsyncSession):
    """Seed initial sample events if table is empty."""
    res = await db.execute(select(HistoricalEvent).limit(1))
    if res.scalar_one_or_none():
        return

    for item in SAMPLE_EVENTS:
        event = HistoricalEvent(
            date=item["date"],
            year=item["year"],
            title=item["title"],
            description=item["description"],
            category=item["category"],
            country=item["country"],
            source=item["source"],
            source_url=item["source_url"],
        )
        db.add(event)
    await db.commit()


import asyncio
import logging

logger = logging.getLogger("histofacts.history.sync")


async def _sync_category(
    url_template: str,
    category_label: str,
    category_json_key: str,
    month: str,
    day: str,
    db: AsyncSession,
    max_retries: int = 3,
    initial_delay: float = 1.0,
) -> int:
    """
    Fetch events from Wikimedia 'On This Day' feed for a specific category and date,
    and upsert into PostgreSQL historical_events table with exponential backoff retry.

    Returns:
        int: Number of new events inserted.
    """
    url = url_template.format(month=month.zfill(2), day=day.zfill(2))
    date_key = f"{month.zfill(2)}-{day.zfill(2)}"
    events_inserted = 0

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                headers = {"User-Agent": "HistoFacts/1.0 (Educational Project; mailto:contact@histofacts.org)"}
                if settings.wikimedia_api_token:
                    headers["Authorization"] = f"Bearer {settings.wikimedia_api_token}"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401 and settings.wikimedia_api_token and "." not in settings.wikimedia_api_token:
                    resp = await client.get(url, headers={"User-Agent": headers["User-Agent"], "Authorization": settings.wikimedia_api_token})

                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", initial_delay * (2 ** (attempt - 1))))
                    logger.warning(f"Rate limited by Wikimedia API (429). Retrying in {retry_after}s...")
                    await asyncio.sleep(retry_after)
                    continue

                if resp.status_code != 200:
                    logger.warning(f"Wikimedia API returned status {resp.status_code} on attempt {attempt}")
                    if attempt < max_retries:
                        await asyncio.sleep(initial_delay * (2 ** (attempt - 1)))
                        continue
                    return 0

                data = resp.json()
                events = data.get(category_json_key, [])

                for item in events:
                    text = item.get("text", "")
                    year = str(item.get("year", ""))
                    pages = item.get("pages", [])
                    source_url = pages[0]["content_urls"]["desktop"]["page"] if pages else None
                    title = pages[0]["title"] if pages else text[:50]

                    # Check if event already exists
                    existing = await db.execute(
                        select(HistoricalEvent).where(
                            HistoricalEvent.date == date_key,
                            HistoricalEvent.title == title,
                        )
                    )
                    if not existing.scalar_one_or_none():
                        hook = await generate_history_hook(text)
                        event = HistoricalEvent(
                            date=date_key,
                            year=year,
                            title=title,
                            description=text,
                            category=category_label,
                            source="Wikimedia",
                            source_url=source_url,
                            ai_hook=hook,
                        )
                        db.add(event)
                        events_inserted += 1

                if events_inserted > 0:
                    await db.commit()
                return events_inserted

        except httpx.RequestError as req_err:
            logger.warning(f"Network error syncing Wikimedia events on attempt {attempt}: {req_err}")
            if attempt < max_retries:
                await asyncio.sleep(initial_delay * (2 ** (attempt - 1)))
            else:
                logger.error(f"Failed to sync Wikimedia events for {date_key} ({category_label}) after {max_retries} attempts.")
        except Exception as err:
            logger.error(f"Unexpected error syncing Wikimedia events for {date_key} ({category_label}): {err}")
            break

    return events_inserted


async def sync_wikimedia_events_for_date(
    month: str,
    day: str,
    db: AsyncSession,
    max_retries: int = 3,
    initial_delay: float = 1.0,
) -> int:
    """
    Fetch events from Wikimedia 'On This Day' feed for month and day across
    selected, events, births, deaths, and holidays, and upsert into PostgreSQL.

    Returns:
        int: Total number of new events inserted across all categories.
    """
    categories = [
        (WIKIMEDIA_ON_THIS_DAY_URL, "World History", "selected"),
        (WIKIMEDIA_EVENTS_URL, "World History", "events"),
        (WIKIMEDIA_BIRTHS_URL, "Births", "births"),
        (WIKIMEDIA_DEATHS_URL, "Deaths", "deaths"),
        (WIKIMEDIA_HOLIDAYS_URL, "Holidays", "holidays"),
    ]

    total_inserted = 0
    for url_tmpl, label, json_key in categories:
        inserted = await _sync_category(
            url_template=url_tmpl,
            category_label=label,
            category_json_key=json_key,
            month=month,
            day=day,
            db=db,
            max_retries=max_retries,
            initial_delay=initial_delay,
        )
        total_inserted += inserted

    return total_inserted


