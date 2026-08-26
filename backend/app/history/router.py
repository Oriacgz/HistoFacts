"""
FastAPI router for History endpoints (today's events, date browser, search, bookmarks).
"""

from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.history.models import HistoricalEvent, Bookmark
from app.history.schemas import HistoricalEventResponse, BookmarkResponse
from app.history.sync import seed_initial_events, sync_wikimedia_events_for_date
from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.auth.models import User

router = APIRouter(prefix="/api/events", tags=["History"])


@router.get("/today", response_model=list[HistoricalEventResponse])
async def get_today_events(db: AsyncSession = Depends(get_async_session)):
    now = datetime.now()
    date_key = f"{now.month:02d}-{now.day:02d}"

    res = await db.execute(
        select(HistoricalEvent)
        .where(HistoricalEvent.date == date_key)
        .order_by(HistoricalEvent.synced_at.desc())
    )
    events = res.scalars().all()

    # Fallback to general historical events if date has no specific events
    if not events:
        res = await db.execute(select(HistoricalEvent).limit(10))
        events = res.scalars().all()

    return events


@router.get("/date/{month}/{day}", response_model=list[HistoricalEventResponse])
async def get_events_by_date(month: int, day: int, db: AsyncSession = Depends(get_async_session)):
    date_key = f"{month:02d}-{day:02d}"
    res = await db.execute(
        select(HistoricalEvent)
        .where(HistoricalEvent.date == date_key)
        .order_by(HistoricalEvent.synced_at.desc())
    )
    events = res.scalars().all()

    if not events:
        res = await db.execute(select(HistoricalEvent).limit(10))
        events = res.scalars().all()

    return events


@router.get("/search", response_model=list[HistoricalEventResponse])
async def search_events(
    q: str = Query(..., min_length=1),
    category: str | None = None,
    country: str | None = None,
    db: AsyncSession = Depends(get_async_session),
):
    query = select(HistoricalEvent).where(
        or_(
            HistoricalEvent.title.ilike(f"%{q}%"),
            HistoricalEvent.description.ilike(f"%{q}%"),
            HistoricalEvent.year.ilike(f"%{q}%"),
        )
    )

    if category:
        query = query.where(HistoricalEvent.category.ilike(f"%{category}%"))
    if country:
        query = query.where(HistoricalEvent.country.ilike(f"%{country}%"))

    res = await db.execute(query.limit(20))
    return res.scalars().all()


# ── Bookmarks Endpoints ─────────────────────────────────────
@router.post("/bookmarks/{event_id}", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def add_bookmark(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    # Verify event exists
    res = await db.execute(select(HistoricalEvent).where(HistoricalEvent.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Historical event not found")

    # Check existing
    existing = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.event_id == event_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Event already bookmarked")

    bm = Bookmark(user_id=current_user.id, event_id=event_id)
    db.add(bm)
    await db.commit()
    await db.refresh(bm)

    return BookmarkResponse(
        id=bm.id,
        user_id=bm.user_id,
        event_id=bm.event_id,
        created_at=bm.created_at,
        event=HistoricalEventResponse.model_validate(event),
    )


@router.delete("/bookmarks/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    res = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.event_id == event_id,
        )
    )
    bm = res.scalar_one_or_none()
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    await db.delete(bm)
    await db.commit()



@router.get("/bookmarks/me", response_model=list[BookmarkResponse])
async def get_my_bookmarks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    query = (
        select(Bookmark, HistoricalEvent)
        .join(HistoricalEvent, Bookmark.event_id == HistoricalEvent.id)
        .where(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
    )
    res = await db.execute(query)
    rows = res.all()
    return [
        BookmarkResponse(
            id=bm.id,
            user_id=bm.user_id,
            event_id=bm.event_id,
            created_at=bm.created_at,
            event=HistoricalEventResponse.model_validate(ev),
        )
        for bm, ev in rows
    ]

