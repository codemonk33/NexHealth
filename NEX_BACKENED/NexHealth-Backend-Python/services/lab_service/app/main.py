import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.common.config import get_settings
from libs.common.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers import lab_tests, lab_orders, health_packages, appointment_slots

settings = get_settings()

app = FastAPI(
    title="Bionex Lab Service",
    version=settings.APP_VERSION,
    description="Lab test catalog, lab orders, appointment slots, and health package microservice",
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
    return {"status": "ok", "service": "lab-service"}

app.include_router(lab_tests.router, prefix="/api/v1/lab-tests", tags=["lab-tests"])
app.include_router(lab_orders.router, prefix="/api/v1/lab-orders", tags=["lab-orders"])
app.include_router(health_packages.router, prefix="/api/v1/package", tags=["health-packages"])
app.include_router(appointment_slots.router, prefix="/api/v1/admin/slots", tags=["Appointment Slots"])
