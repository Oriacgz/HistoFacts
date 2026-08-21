"""
Sync job service for pulling daily historical facts from external APIs
(Wikimedia On This Day API) into local PostgreSQL database.
"""

import httpx
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.history.models import HistoricalEvent

WIKIMEDIA_ON_THIS_DAY_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/{month}/{day}"

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


async def sync_wikimedia_events_for_date(month: str, day: str, db: AsyncSession):
    """
    Fetch events from Wikimedia 'On This Day' feed for month and day (e.g. month='03', day='17')
    and upsert into PostgreSQL historical_events table.
    """
    url = WIKIMEDIA_ON_THIS_DAY_URL.format(month=month.zfill(2), day=day.zfill(2))
    date_key = f"{month.zfill(2)}-{day.zfill(2)}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "HistoFacts/1.0"})
            if resp.status_code != 200:
                return

            data = resp.json()
            events = data.get("selected", [])

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
                    event = HistoricalEvent(
                        date=date_key,
                        year=year,
                        title=title,
                        description=text,
                        category="World History",
                        source="Wikimedia",
                        source_url=source_url,
                    )
                    db.add(event)

            await db.commit()
    except Exception as err:
        print(f"Error syncing Wikimedia events for {date_key}: {err}")
