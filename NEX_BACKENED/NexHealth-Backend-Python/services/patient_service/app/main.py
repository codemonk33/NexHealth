import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.common.config import get_settings
from libs.common.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers import patients, family, doctor, medical_records, medications, reminders

settings = get_settings()

app = FastAPI(
    title="Bionex Patient Service",
    version=settings.APP_VERSION,
    description="Patient records, family management, doctor assignments, medications, and reminders microservice",
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
    return {"status": "ok", "service": "patient-service"}

app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(family.router, prefix="/api/v1/family", tags=["family"])
app.include_router(doctor.router, prefix="/api/v1/doctor", tags=["doctor"])
app.include_router(medical_records.router, prefix="/api/v1/records", tags=["medical-records"])
app.include_router(medications.router, prefix="/api/v1/medications", tags=["medications"])
app.include_router(reminders.router, prefix="/api/v1/reminders", tags=["reminders"])
