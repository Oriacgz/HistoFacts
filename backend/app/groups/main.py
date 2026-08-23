"""
Groups Microservice (Port 8004).
Handles study group creation, membership management, and group-scoped feeds.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.groups.router import router as groups_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="HistoFacts — Groups Microservice",
    description="Microservice 4: Group creation, member roles, and group study circles.",
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

app.include_router(groups_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "groups-service", "port": 8004}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.groups.main:app", host="0.0.0.0", port=8004, reload=True)
