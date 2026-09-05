"""
History Content Microservice (Port 8002).
Handles today's events, calendar date browsing, full-text search, bookmarks, and Wikimedia sync.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import async_session_factory
from app.history.router import router as history_router
from app.history.sync import seed_initial_events


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as session:
        await seed_initial_events(session)
    yield


app = FastAPI(
    title="HistoFacts — History Content Microservice",
    description="Microservice 2: Daily events feed, date search, bookmarks, and external sync.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

from app.core.correlation import CorrelationIdMiddleware

app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(history_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "history-service", "port": 8002}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.history.main:app", host="0.0.0.0", port=8002, reload=True)
