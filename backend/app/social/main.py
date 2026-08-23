"""
Social Discussion Microservice (Port 8003).
Handles public Chronicle posts, threaded nested comments, and like counter.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.social.router import router as social_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="HistoFacts — Social Discussion Microservice",
    description="Microservice 3: Public feed, discussions, nested threaded comments, and likes.",
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

app.include_router(social_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "social-service", "port": 8003}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.social.main:app", host="0.0.0.0", port=8003, reload=True)
