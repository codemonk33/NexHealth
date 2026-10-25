import os
import sys

# Ensure root workspace and libs are on sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import httpx
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from libs.common.config import get_settings
from libs.common.middleware import (
    CSRFProtectionMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)

settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
)

app = FastAPI(
    title="Bionex API Gateway",
    version=settings.APP_VERSION,
    description="Central API Gateway for Bionex Microservices Architecture",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(CSRFProtectionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Sharing-Token", "X-Share-Token", "X-Request-ID"],
)

# Route Map: Route Prefix -> Target Service Base URL
ROUTE_MAP = {
    "/api/v1/auth": settings.AUTH_SERVICE_URL,
    "/api/v1/admin/slots": settings.LAB_SERVICE_URL,
    "/api/v1/admin": settings.AUTH_SERVICE_URL,
    "/api/v1/patients": settings.PATIENT_SERVICE_URL,
    "/api/v1/family": settings.PATIENT_SERVICE_URL,
    "/api/v1/doctor": settings.PATIENT_SERVICE_URL,
    "/api/v1/records": settings.PATIENT_SERVICE_URL,
    "/api/v1/medications": settings.PATIENT_SERVICE_URL,
    "/api/v1/reminders": settings.PATIENT_SERVICE_URL,
    "/api/v1/lab-tests": settings.LAB_SERVICE_URL,
    "/api/v1/lab-orders": settings.LAB_SERVICE_URL,
    "/api/v1/package": settings.LAB_SERVICE_URL,
    "/api/v1/payments": settings.PAYMENT_SERVICE_URL,
    "/api/v1/encryption": settings.CRYPTO_SERVICE_URL,
    "/api/v1/sharing": settings.SHARING_SERVICE_URL,
    "/api/v1/steps": settings.HEALTH_SERVICE_URL,
    "/api/v1/sleep": settings.HEALTH_SERVICE_URL,
    "/api/v1/daily-health": settings.HEALTH_SERVICE_URL,
    "/api/v1/documents": settings.NEX_AI_SERVICE_URL,
    "/api/v1/nex": settings.NEX_AI_SERVICE_URL,
}

client = httpx.AsyncClient(timeout=60.0)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "api-gateway", "version": settings.APP_VERSION}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def gateway_proxy(request: Request, path: str):
    full_path = f"/{path}"

    target_service_url = None
    # Sort keys by length descending to match longest path prefix first (e.g. /api/v1/admin/slots vs /api/v1/admin)
    for prefix in sorted(ROUTE_MAP.keys(), key=len, reverse=True):
        if full_path.startswith(prefix):
            target_service_url = ROUTE_MAP[prefix]
            break

    if not target_service_url:
        return Response(content='{"detail": "Route not found"}', status_code=status.HTTP_404_NOT_FOUND, media_type="application/json")

    url = f"{target_service_url}{full_path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = dict(request.headers)
    headers.pop("host", None)
    if hasattr(request.state, "request_id"):
        headers["x-request-id"] = request.state.request_id

    body = await request.body()

    try:
        req = client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
        )
        res = await client.send(req)

        # Filter out hop-by-hop response headers
        excluded_headers = ["content-encoding", "content-length", "transfer-encoding", "connection"]
        res_headers = [(k, v) for k, v in res.headers.items() if k.lower() not in excluded_headers]

        return Response(
            content=res.content,
            status_code=res.status_code,
            headers=dict(res_headers),
            media_type=res.headers.get("content-type"),
        )
    except httpx.RequestError as exc:
        return Response(
            content=f'{{"detail": "Service unavailable: {str(exc)}"}}',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json",
        )
