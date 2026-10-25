from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.routers import appointment_slots
from app.routers import health_packages

from app.config import get_settings
from app.middleware.security import (
    CSRFProtectionMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from app.routers import (
    admin,
    auth,
    doctor,
    documents,
    family,
    lab_orders,
    lab_tests,
    medical_records,
    medications,
    patients,
    payments,
    reminders,
    sharing,
    sleep,
    steps,
    daily_health,
    nex,
    wearables,
)
from app.routers import encryption as encryption_router

settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize server signing key in Vault (for audit log signatures)
    from app.security.vault import vault_manager
    import logging
    _log = logging.getLogger(__name__)
    try:
        vault_manager.initialize_server_key()
    except Exception as exc:
        # In production, Vault must be available for cryptographic audit signatures
        if not settings.DEBUG:
            _log.error(f"CRITICAL: Vault initialization failed in production: {exc}")
            raise
        # In development, allow graceful degradation
        _log.warning(f"Vault server key initialization skipped in debug mode: {exc}")
    yield
    # Shutdown: clean up resources if needed


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Bionex — secure patient-centric digital health record API",
    # Hide docs in production; set DEBUG=true in .env to re-enable
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ── Exception Handlers ────────────────────────────────────────────────────────

import logging
_logger = logging.getLogger(__name__)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """Convert Pydantic validation errors to 400 Bad Request instead of 422."""
    # Extract error details properly for JSON serialization
    errors = []
    for error in exc.errors():
        error_dict = {
            "type": error.get("type", "value_error"),
            "loc": list(error.get("loc", [])),
            "msg": error.get("msg", "Validation error"),
        }
        errors.append(error_dict)

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": errors},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Global exception handler to catch and log all unhandled exceptions."""
    import traceback
    
    # Log full traceback
    _logger.error(
        f"Unhandled exception in {request.method} {request.url.path}",
        exc_info=exc
    )
    
    # Return detailed error in debug mode
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": str(exc),
                "type": type(exc).__name__,
                "traceback": traceback.format_exc()
            }
        )
    
    # Return generic error in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


# ── Middleware ────────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security middleware (Enhanced Security #9, #10)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(CSRFProtectionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Sharing-Token", "X-Share-Token"],
)

# ── Health check ─────────────────────────────────────────────────────────────


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


# ── API Routers ───────────────────────────────────────────────────────────────

PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{PREFIX}/auth", tags=["auth"])
app.include_router(patients.router, prefix=f"{PREFIX}/patients", tags=["patients"])
app.include_router(family.router, prefix=f"{PREFIX}/family", tags=["family"])
app.include_router(
    medical_records.router, prefix=f"{PREFIX}/records", tags=["medical-records"]
)
app.include_router(
    medications.router, prefix=f"{PREFIX}/medications", tags=["medications"]
)
app.include_router(reminders.router, prefix=f"{PREFIX}/reminders", tags=["reminders"])
app.include_router(lab_tests.router, prefix=f"{PREFIX}/lab-tests", tags=["lab-tests"])
app.include_router(
    lab_orders.router, prefix=f"{PREFIX}/lab-orders", tags=["lab-orders"]
)
app.include_router(payments.router, prefix=f"{PREFIX}/payments", tags=["payments"])
app.include_router(sharing.router, prefix=f"{PREFIX}/sharing", tags=["sharing"])
app.include_router(steps.router, prefix=f"{PREFIX}/steps", tags=["steps"])
app.include_router(sleep.router, prefix=f"{PREFIX}/sleep", tags=["sleep"])
app.include_router(documents.router, prefix=f"{PREFIX}/documents", tags=["documents"])
app.include_router(daily_health.router, prefix=f"{PREFIX}/daily-health", tags=["daily-health"])
app.include_router(doctor.router, prefix=f"{PREFIX}/doctor", tags=["doctor"])
app.include_router(admin.router, prefix=f"{PREFIX}/admin", tags=["admin"])
app.include_router(wearables.router, prefix=f"{PREFIX}/wearables", tags=["wearables"])
app.include_router(encryption_router.router, tags=["encryption"])  # prefix already set to /api/v1/encryption
app.include_router(appointment_slots.router, prefix=f"{PREFIX}/admin/slots", tags=["Appointment Slots"])
app.include_router(health_packages.router, prefix=f"{PREFIX}/package", tags=["health-packages"])
app.include_router(nex.router, prefix=f"{PREFIX}/nex", tags=["nex"])

