"""
Pytest fixtures and configuration for HistoFacts backend tests.
Uses an in-memory SQLite database via aiosqlite for fast, isolated test runs.
"""

import pytest
import pytest_asyncio
from types import SimpleNamespace
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_async_session
from app.main import app
from app.auth.router import limiter
from app.ai_notes.wallet_service import seed_token_packs
from app.history.sync import seed_initial_events

# Disable slowapi rate limiting during tests
limiter.enabled = False

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
TestingSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.fixture
def notes_model(monkeypatch):
    """Deterministic provider for Notes lifecycle tests, not scope/model-quality tests.

    Exercise the real generation, guardrails, budgets and persistence code without
    requiring Ollama/LM Studio or variable model-sized output on a CI runner.
    Individual scope/routing tests install their own provider expectations.
    """
    def factory(**config):
        async def create(**payload):
            messages=payload['messages']
            classify='Classify the request' in str(messages[0].get('content',''))
            text='HISTORY' if classify else 'The French Revolution began in 1789. Economic hardship and political inequality contributed to the conflict.'
            if payload.get('stream'):
                async def chunks():
                    for part in (text[:40],text[40:]):
                        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=part))])
                return chunks()
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
                                   usage=SimpleNamespace(total_tokens=80))
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr('app.ai_notes.llm_client.AsyncOpenAI',factory)


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

    # Dispose the engine so the aiosqlite worker thread ends — otherwise the
    # non-daemon thread blocks pytest's interpreter shutdown after the run.
    await test_engine.dispose()


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

