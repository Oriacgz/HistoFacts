"""
FastAPI Development API Gateway for HistoFacts Microservices.
Proxies incoming requests from React frontend to the 6 microservices.
"""

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging

from app.core.config import settings

logger = logging.getLogger("histofacts.gateway")

app = FastAPI(
    title="HistoFacts — API Gateway",
    description="Unified API Gateway routing traffic to the 6 HistoFacts Microservices.",
    version="1.0.0",
)

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
    ("/api/groups", settings.groups_service_url),
    ("/api/notes", settings.notes_service_url),
    ("/api/wallet", settings.notes_service_url),
    ("/api/shop", settings.notes_service_url),
    ("/api/quiz", settings.quiz_service_url),
]


def resolve_target_service(path: str) -> tuple[str, str] | None:
    """Find matching target microservice URL for given request path."""
    for prefix, service_url in SERVICE_ROUTES:
        if path.startswith(prefix):
            return service_url, path
    return None


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_gateway(request: Request, path: str):
    full_path = f"/api/{path}"
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

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
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
async def gateway_health():
    """Check health across all 6 microservices."""
    services = {
        "auth": f"{settings.auth_service_url}/health",
        "history": f"{settings.history_service_url}/health",
        "social": f"{settings.social_service_url}/health",
        "groups": f"{settings.groups_service_url}/health",
        "notes": f"{settings.notes_service_url}/health",
        "quiz": f"{settings.quiz_service_url}/health",
    }

    status_report = {}
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in services.items():
            try:
                r = await client.get(url)
                status_report[name] = "UP" if r.status_code == 200 else f"STATUS_{r.status_code}"
            except Exception:
                status_report[name] = "DOWN"

    all_up = all(s == "UP" for s in status_report.values())
    return {
        "gateway": "UP",
        "overall_status": "HEALTHY" if all_up else "DEGRADED",
        "services": status_report,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.gateway.main:app", host="0.0.0.0", port=8000, reload=True)
