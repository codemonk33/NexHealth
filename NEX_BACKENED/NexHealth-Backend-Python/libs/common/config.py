from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Bionex Microservice"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── Service Specific Ports / URLs ─────────────────────────────────────────
    GATEWAY_PORT: int = 8000
    AUTH_SERVICE_URL: str = "http://auth-service:8001"
    PATIENT_SERVICE_URL: str = "http://patient-service:8002"
    LAB_SERVICE_URL: str = "http://lab-service:8003"
    PAYMENT_SERVICE_URL: str = "http://payment-service:8004"
    CRYPTO_SERVICE_URL: str = "http://crypto-service:8005"
    SHARING_SERVICE_URL: str = "http://sharing-service:8006"
    HEALTH_SERVICE_URL: str = "http://health-service:8007"
    NEX_AI_SERVICE_URL: str = "http://nex-ai-service:8008"

    # ── JWT Security ──────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-in-production-to-a-secure-random-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SHARING_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Databases & External Infra ───────────────────────────────────────────
    DATABASE_URL: str = "postgresql://bionex:bionex@postgres:5432/bionex"
    FIELD_ENCRYPTION_KEY: str = ""
    REDIS_URL: str = "redis://redis:6379/0"
    VAULT_ADDR: str = "http://vault:8200"
    VAULT_TOKEN: str = "bionex-dev-root-token"
    VAULT_NAMESPACE: str = "bionex"
    OPENAI_KEY: str = "YOUR-OPENAI-KEY-HERE"

    # ── File Uploads ─────────────────────────────────────────────────────────
    UPLOADS_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 52_428_800  # 50 MB
    MAX_SHARE_UPLOAD_FILES: int = 5

    # ── CORS & Security Limits ────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8080,http://localhost:19006,http://localhost:19000,http://10.243.32.226:19006,http://10.243.32.226:19000,http://10.243.32.226:8081"
    RATE_LIMIT_AUTH: str = "30/minute"
    RATE_LIMIT_DEFAULT: str = "1000/minute"
    RATE_LIMIT_SENSITIVE: str = "5/minute"

    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 15
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_EXPIRY_DAYS: int = 90
    PASSWORD_REUSE_COUNT: int = 5

    SESSION_TIMEOUT_MINUTES: int = 30
    SESSION_TIMEOUT_DOCTOR_MINUTES: int = 120
    SESSION_KEY_TTL_DAYS: int = 7

    ADMIN_IP_WHITELIST: str = ""

    # ── Vector DB (ChromaDB) ─────────────────────────────────────────────────
    CHROMA_API_KEY: str = "ck-Fr3Y2cLmGvL6nh8yD4NDAtFUw3qb6qwx2iwfQsaHKdLc"
    CHROMA_TENANT: str = "bb919c7b-d033-4985-a14b-969748665578"
    CHROMA_DATABASE: str = "Dev"
    CHROMA_COLLECTION_NAME: str = "medical_dialogues"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def admin_ip_whitelist_list(self) -> List[str]:
        if not self.ADMIN_IP_WHITELIST.strip():
            return []
        return [ip.strip() for ip in self.ADMIN_IP_WHITELIST.split(",") if ip.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
