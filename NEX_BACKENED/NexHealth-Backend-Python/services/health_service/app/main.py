import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.common.config import get_settings
from libs.common.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers import steps, sleep, daily_health

settings = get_settings()

app = FastAPI(
    title="Bionex Health Tracking & Analytics Service",
    version=settings.APP_VERSION,
    description="Step count, sleep tracking, and composite daily health metrics microservice",
    docs_url="/docs" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "health-service"}

app.include_router(steps.router, prefix="/api/v1/steps", tags=["steps"])
app.include_router(sleep.router, prefix="/api/v1/sleep", tags=["sleep"])
app.include_router(daily_health.router, prefix="/api/v1/daily-health", tags=["daily-health"])
