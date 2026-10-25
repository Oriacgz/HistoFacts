"""Bounded excerpt retention. Public reference URLs survive with the saved note."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from app.ai_notes.models import NoteResearchRun
from app.core.database import async_session_factory

logger = logging.getLogger(__name__)


async def expire_research_records(db):
    now = datetime.now(timezone.utc)
    await db.execute(update(NoteResearchRun).where(NoteResearchRun.state == "running",
        NoteResearchRun.created_at < now - timedelta(minutes=4)).values(state="failed"))
    await db.execute(delete(NoteResearchRun).where(NoteResearchRun.note_id.is_(None),
        NoteResearchRun.created_at < now - timedelta(days=7)))
    rows = (await db.execute(select(NoteResearchRun).where(NoteResearchRun.state == "complete",
        NoteResearchRun.created_at < now - timedelta(days=30)).limit(200))).scalars().all()
    for run in rows:
        run.sources = [{**source, "passages": [], "citations": [], "excerpts_expired": True} for source in run.sources]
        run.state = "excerpts_expired"
    await db.commit()


async def retention_worker():
    while True:
        try:
            async with async_session_factory() as db:
                await expire_research_records(db)
        except Exception:
            logger.exception("Research retention pass failed; check the Notes schema migration")
        await asyncio.sleep(3600)
