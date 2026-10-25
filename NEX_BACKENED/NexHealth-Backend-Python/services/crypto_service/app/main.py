import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.common.config import get_settings
from libs.common.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers import encryption as encryption_router

settings = get_settings()

app = FastAPI(
    title="Bionex Security & Crypto Service",
    version=settings.APP_VERSION,
    description="Vault integration, Key Exchange, Zero-Trust Access, and Field-Level Encryption microservice",
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
    return {"status": "ok", "service": "crypto-service"}

# Router already includes /api/v1/encryption prefix - don't duplicate it
app.include_router(encryption_router.router)
