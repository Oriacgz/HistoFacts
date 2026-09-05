"""
Notification Microservice (Port 8007).
Handles user notifications, unread counts, and inter-service dispatch.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.notification.router import router as notification_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="HistoFacts — Notification Microservice",
    description="Microservice 7: Real-time user notifications, badge unread polling, and inter-service notifications.",
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

app.include_router(notification_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "notification-service", "port": 8007}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.notification.main:app", host="0.0.0.0", port=8007, reload=True)
