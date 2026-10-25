import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.common.config import get_settings
from libs.common.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers import documents, nex

settings = get_settings()

app = FastAPI(
    title="Bionex Nex AI & RAG Service",
    version=settings.APP_VERSION,
    description="Vector database, Chroma DB integration, document processing, and AI Assistant RAG microservice",
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
    return {"status": "ok", "service": "nex-ai-service"}

app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(nex.router, prefix="/api/v1/nex", tags=["nex"])
