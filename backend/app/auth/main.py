"""
Auth & Identity Microservice (Port 8001).
Handles registration, login, JWT token issuance & refresh, unique tags, and user profiles.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="HistoFacts — Auth & Identity Microservice",
    description="Microservice 1: User registration, JWT authentication, handles and profiles.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "auth-service", "port": 8001}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.auth.main:app", host="0.0.0.0", port=8001, reload=True)
