"""
FastAPI Development API Gateway for HistoFacts Microservices.
Proxies incoming requests and WebSockets from React frontend to the 6 microservices.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
import websockets
import logging

from app.core.config import settings
from app.core.correlation import CorrelationIdMiddleware, get_request_id

logger = logging.getLogger("histofacts.gateway")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Persistent connection pool across gateway requests
    app.state.client = httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=50, max_connections=200),
    )
    yield
    await app.state.client.aclose()


app = FastAPI(
    title="HistoFacts — API Gateway",
    description="Unified API Gateway routing traffic to the 6 HistoFacts Microservices.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route prefix to target service URL mapping
SERVICE_ROUTES = [
    ("/api/auth", settings.auth_service_url),
    ("/api/events", settings.history_service_url),
    ("/api/social", settings.social_service_url),
    ("/api/chat", settings.social_service_url),
    ("/api/groups", settings.groups_service_url),
    ("/api/notes", settings.notes_service_url),
    ("/api/wallet", settings.notes_service_url),
    ("/api/shop", settings.notes_service_url),
    ("/api/quiz", settings.quiz_service_url),
    ("/api/notifications", settings.notification_service_url),
]


def resolve_target_service(path: str) -> tuple[str, str] | None:
    """Find matching target microservice URL for given request path."""
    for prefix, service_url in SERVICE_ROUTES:
        if path.startswith(prefix):
            return service_url, path
    return None


@app.websocket("/api/quiz/ws/lobby/{code}")
async def proxy_quiz_websocket(websocket: WebSocket, code: str):
    """Proxy real-time WebSocket connection to Quiz microservice lobby."""
    await websocket.accept()
    target_ws_base = settings.quiz_service_url.replace("http://", "ws://").replace("https://", "wss://")
    target_ws_url = f"{target_ws_base}/api/quiz/ws/lobby/{code}"

    try:
        async with websockets.connect(target_ws_url) as backend_ws:
            async def forward_client_to_backend():
                try:
                    while True:
                        msg = await websocket.receive_text()
                        await backend_ws.send(msg)
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except Exception as err:
                    logger.debug(f"Client to backend WS closed: {err}")

            async def forward_backend_to_client():
                try:
                    async for msg in backend_ws:
                        await websocket.send_text(msg)
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except Exception as err:
                    logger.debug(f"Backend to client WS closed: {err}")

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(forward_client_to_backend()),
                    asyncio.create_task(forward_backend_to_client()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception as e:
        logger.warning(f"Gateway WebSocket proxy error for {target_ws_url}: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_gateway(request: Request, path: str):
    full_path = f"/api/{path}"

    # Block public access to internal inter-service endpoints
    if "/internal/" in full_path or full_path.endswith("/internal"):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Direct access to internal microservice endpoints via API gateway is forbidden",
        )

    target = resolve_target_service(full_path)

    if not target:
        raise HTTPException(status_code=404, detail=f"No microservice registered for route: {full_path}")

    service_base, route_path = target
    target_url = f"{service_base}{route_path}"

    # Forward query parameters
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = await request.body()
    headers = dict(request.headers)
    # Remove host header so destination service receives proper host
    headers.pop("host", None)
    req_id = getattr(request.state, "request_id", None) or get_request_id()
    if req_id:
        headers["X-Request-ID"] = req_id

    try:
        client: httpx.AsyncClient = request.app.state.client
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
        )

        # Filter response headers
        excluded_headers = ["content-encoding", "content-length", "transfer-encoding", "connection"]
        response_headers = {
            k: v for k, v in resp.headers.items() if k.lower() not in excluded_headers
        }

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=response_headers,
            media_type=resp.headers.get("content-type"),
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Target microservice unavailable at {service_base} for route {full_path}",
        )
    except Exception as e:
        logger.error(f"Gateway proxy error for {target_url}: {e}")
        raise HTTPException(status_code=502, detail=f"Gateway proxy error: {str(e)}")


@app.get("/health", tags=["System"])
async def gateway_health(request: Request):
    """Check health across all 6 microservices."""
    services = {
        "auth": f"{settings.auth_service_url}/health",
        "history": f"{settings.history_service_url}/health",
        "social": f"{settings.social_service_url}/health",
        "groups": f"{settings.groups_service_url}/health",
        "notes": f"{settings.notes_service_url}/health",
        "quiz": f"{settings.quiz_service_url}/health",
        "notifications": f"{settings.notification_service_url}/health",
    }

    status_report = {}
    client: httpx.AsyncClient = getattr(request.app.state, "client", None)
    own_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=3.0)
        own_client = True

    try:
        for name, url in services.items():
            try:
                r = await client.get(url, timeout=3.0)
                status_report[name] = "UP" if r.status_code == 200 else f"STATUS_{r.status_code}"
            except Exception:
                status_report[name] = "DOWN"
    finally:
        if own_client:
            await client.aclose()

    all_up = all(s == "UP" for s in status_report.values())
    return {
        "gateway": "UP",
        "overall_status": "HEALTHY" if all_up else "DEGRADED",
        "services": status_report,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.gateway.main:app", host="0.0.0.0", port=8000, reload=True)
