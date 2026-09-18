"""
SQLAlchemy async engine, session factory, and declarative base.

Usage:
    from app.core.database import get_async_session, Base
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Engine ────────────────────────────────────────────────────
engine_kwargs = {"echo": False}
if "sqlite" not in settings.database_url:
    engine_kwargs.update({
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    settings.database_url,
    **engine_kwargs,
)

# ── Session factory ───────────────────────────────────────────
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative base ─────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""
    pass


# ── Dependency ────────────────────────────────────────────────
async def get_async_session() -> AsyncSession:
    """
    FastAPI dependency that yields a database session.

    Usage in a router:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_async_session)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


from contextlib import asynccontextmanager

@asynccontextmanager
async def streaming_session_scope():
    """
    Session context manager for background/streaming generators.
    Honors FastAPI app.dependency_overrides[get_async_session] in tests.
    """
    from app.main import app
    if get_async_session in app.dependency_overrides:
        override = app.dependency_overrides[get_async_session]
        gen = override()
        try:
            session = await anext(gen)
            yield session
        finally:
            await gen.aclose()
    else:
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
