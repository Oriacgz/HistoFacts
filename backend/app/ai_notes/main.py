"""
AI Notes & Token Economy Microservice (Port 8005).
Handles curriculum note generation, handwritten notes conversion, token quotas, and Histoins shop.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import async_session_factory
from app.ai_notes.router import router as notes_router
from app.ai_notes.wallet_service import seed_token_packs


limiter = Limiter(key_func=get_remote_address, default_limits=[])


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as session:
        await seed_token_packs(session)
    yield


app = FastAPI(
    title="HistoFacts — AI Notes & Token Economy Microservice",
    description="Microservice 5: LLM note generation, handwritten styling, token wallets, and Histoins shop.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.core.correlation import CorrelationIdMiddleware

app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "notes-service", "port": 8005}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.ai_notes.main:app", host="0.0.0.0", port=8005, reload=True)
