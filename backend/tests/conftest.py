"""
Pytest fixtures and configuration for HistoFacts backend tests.
Uses an in-memory SQLite database via aiosqlite for fast, isolated test runs.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_async_session
from app.main import app
from app.ai_notes.wallet_service import seed_token_packs
from app.history.sync import seed_initial_events

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
TestingSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Create all tables and seed initial data for each test run."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        await seed_token_packs(session)
        await seed_initial_events(session)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """Provides a transactional database session for tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    """HTTP client bound to the FastAPI app with test DB override."""
    async def override_get_session():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_async_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

