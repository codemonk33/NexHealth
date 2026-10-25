import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.common.config import get_settings
from libs.common.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers import payments

settings = get_settings()

app = FastAPI(
    title="Bionex Payment Service",
    version=settings.APP_VERSION,
    description="Payment transactions and order billing microservice",
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
    return {"status": "ok", "service": "payment-service"}

app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
