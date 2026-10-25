from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Bionex API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = ""  # MUST be set in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Sharing sessions (NFC / Bluetooth) ────────────────────────────────────
    SHARING_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://bionex:bionex@localhost:5432/bionex"

    # ── Field-level encryption (Fernet key) ───────────────────────────────────
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    FIELD_ENCRYPTION_KEY: str = ""

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    # ── File uploads ─────────────────────────────────────────────────────────
    UPLOADS_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 52_428_800  # 50 MB per file

    # ── Share-intent uploads ──────────────────────────────────────────────────
    SHARE_TOKEN_EXPIRE_MINUTES: int = 5
    MAX_SHARE_UPLOAD_FILES: int = 5
    # ── CORS — comma-separated origins ────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8080"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_AUTH: str = "30/minute"
    RATE_LIMIT_DEFAULT: str = "1000/minute"
    RATE_LIMIT_SENSITIVE: str = "5/minute"  # For password change, 2FA, etc.

    # ── Enhanced Security Settings (Phase 2 & Enhanced Security) ─────────────
    # Account Lockout (Enhanced Security #1)
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 15

    # Password Policy (Enhanced Security #3)
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_EXPIRY_DAYS: int = 90
    PASSWORD_REUSE_COUNT: int = 5

    # Session Management (Enhanced Security #7)
    SESSION_TIMEOUT_MINUTES: int = 30          # For patients
    SESSION_TIMEOUT_DOCTOR_MINUTES: int = 120  # For doctors (longer)
    SESSION_KEY_TTL_DAYS: int = 7              # Crypto session key lifetime (days)

    # IP Whitelisting for Admin (Enhanced Security #13)
    ADMIN_IP_WHITELIST: str = ""  # Comma-separated, empty = all IPs

    # ── Chroma DB (RAG) ───────────────────────────────────────────────────────
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

    def validate_config(self) -> None:
        """Validate critical configuration settings."""
        # Validate SECRET_KEY
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "ERROR: SECRET_KEY must be configured in .env file and be at least 32 characters. "
                "Generate with: python scripts/generate_secrets.py"
            )
        
        # Reject known insecure defaults
        insecure_keys = [
            "CHANGE_ME",
            "REPLACE_WITH",
            "change-me-in-production",
            "-dev-secret-key-for-local-testing-only-32chars",
            "test-secret-key",
            "bTKhRVg0weqv6ktXUn80oFx2fxCTPbsF6YGh4sjoBsA",  # Old hardcoded value
        ]
        if any(insecure in self.SECRET_KEY for insecure in insecure_keys):
            raise ValueError(
                "ERROR: SECRET_KEY contains an insecure default value. "
                "Generate a secure secret with: python scripts/generate_secrets.py"
            )
        
        # Validate FIELD_ENCRYPTION_KEY
        if not self.DEBUG and not self.FIELD_ENCRYPTION_KEY:
            raise ValueError(
                "ERROR: FIELD_ENCRYPTION_KEY must be configured in production. "
                "Generate with: python scripts/generate_secrets.py"
            )
        
        if self.FIELD_ENCRYPTION_KEY:
            # Reject known insecure defaults
            insecure_encryption_keys = [
                "CHANGE_ME",
                "REPLACE_WITH",
                "Dq_pEM07P3BWUTGn-dHJx-xaqb-KWuZXYm-rwR_C9bY=",  # Old hardcoded value
            ]
            if any(insecure in self.FIELD_ENCRYPTION_KEY for insecure in insecure_encryption_keys):
                raise ValueError(
                    "ERROR: FIELD_ENCRYPTION_KEY contains an insecure default value. "
                    "Generate a secure key with: python scripts/generate_secrets.py"
                )
            
            # Validate Fernet key format (must be 44 bytes base64-encoded)
            try:
                from cryptography.fernet import Fernet
                Fernet(self.FIELD_ENCRYPTION_KEY.encode())
            except Exception:
                raise ValueError(
                    "ERROR: FIELD_ENCRYPTION_KEY is not a valid Fernet key. "
                    "Generate with: python scripts/generate_secrets.py"
                )


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_config()
    return settings
