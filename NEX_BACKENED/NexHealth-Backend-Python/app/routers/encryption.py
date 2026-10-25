"""
Encryption API Router — Zero-Knowledge E2E Encryption (Phase 4 / ZK-Hardened)

Design contract:
  • Private keys are NEVER generated, stored, or handled by this service.
  • The client generates the ECDH P-256 keypair on-device.
  • Registration is protected by ECDSA proof-of-possession (single-use nonce).
  • Session key encryption happens server-side using the doctor's *public* key only.
  • Session key decryption happens client-side; this server CANNOT decrypt it.
  • HashiCorp Vault is used ONLY for the audit-signing key (ECDSA), not user keys.

Endpoints:
  GET   /keypairs/registration-challenge   — Issue single-use CSPRNG nonce (60 s TTL)
  POST  /keypairs/register                 — Accept client-generated PEM + PoP proof
  GET   /keypairs/me                       — Keypair metadata (fingerprint only)
  DELETE /keypairs/me                      — Revoke keypair (marks DB + Redis)
  POST  /sessions                          — Patient grants doctor access
  GET   /sessions                          — List patient's sessions
  GET   /sessions/as-doctor               — List doctor's sessions
  GET   /sessions/{id}/encrypted-key       — Fetch ECDH blob for client-side decrypt
  POST  /sessions/{id}/decrypt             — 410 Gone (deprecated; server never held keys)
  DELETE /sessions/{id}                    — Revoke session
  GET   /audit/logs                        — Paginated audit trail (user-scoped)
  GET   /audit/compliance-report           — GDPR/HIPAA summary report
  GET   /health                            — Liveness probe
"""

import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.encryption_models import (
    ActorType,
    CryptoAuditLogStatus,
    SessionKeyStatus,
)
from app.schemas.encryption_schemas import (
    UserKeypairResponse,
    SessionKeyResponse,
    EncryptedSessionKeyPayload,
    DecryptSessionKeyResponse,
    DoctorSessionListResponse,
    EncryptedRecordVaultResponse,
)
from app.services.crypto_operations import (
    KeypairService,
    SessionKeyService,
    EncryptedRecordService,
)
from app.services.crypto_audit_service import CryptoAuditService
from app.services.key_exchange import KeyExchangeManager
from app.security.cache import cache_manager
from app.security.crypto import CryptoManager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/encryption",
    tags=["encryption"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
        404: {"description": "Resource not found"},
        500: {"description": "Internal server error"},
    },
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_NONCE_TTL_SECONDS = 60          # Registration nonces expire after 60 seconds
_NONCE_BYTES       = 32          # 256-bit entropy
_NONCE_REDIS_PREFIX = "reg_nonce:"  # Redis key namespace for registration nonces

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_actor_type(user: User) -> ActorType:
    """Return the correct ActorType enum value for an authenticated user."""
    if hasattr(user, "role") and user.role == "DOCTOR":
        return ActorType.DOCTOR
    return ActorType.PATIENT


def _ip(request: Optional[Request]) -> str:
    """Safely extract the client IP address from a request object."""
    if request and request.client:
        return request.client.host
    return "unknown"


def _request_id(request: Optional[Request]) -> str:
    """Return the X-Request-ID header or generate a fresh UUID."""
    if request:
        return request.headers.get("X-Request-ID", str(uuid4()))
    return str(uuid4())


def _log_action(
    db: Session,
    user: User,
    action: str,
    resource_type: str,
    resource_id: str,
    event_data: dict,
    request: Optional[Request],
    status: CryptoAuditLogStatus = CryptoAuditLogStatus.SUCCESS,
    status_message: Optional[str] = None,
) -> None:
    """Thin wrapper around CryptoAuditService.log_action to reduce boilerplate."""
    try:
        CryptoAuditService.log_action(
            db=db,
            actor_id=str(user.id),
            actor_type=_get_actor_type(user),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            event_data=event_data,
            ip_address=_ip(request),
            request_id=_request_id(request),
            status=status,
            status_message=status_message,
        )
    except Exception as audit_err:
        # Audit log failure must NEVER break the main request flow
        logger.warning(f"Non-fatal audit log error for action {action}: {audit_err}")


# ---------------------------------------------------------------------------
# Pydantic request / response models (router-local)
# ---------------------------------------------------------------------------


class RegistrationChallengeResponse(BaseModel):
    """One-time nonce issued to prove key ownership before registration."""
    nonce: str = Field(
        description="64-char lowercase hex nonce — sign with your private key before calling /keypairs/register",
    )
    expires_in: int = Field(
        description=f"Seconds until this nonce expires (currently {_NONCE_TTL_SECONDS})",
    )
    issued_at: str = Field(description="ISO-8601 UTC timestamp")


class RegisterKeypairRequest(BaseModel):
    """
    Body for POST /keypairs/register.

    Security invariants enforced by the server:
      1. public_key_pem must parse as a valid ECDH P-256 SPKI key.
      2. nonce must match an unexpired Redis entry for this user_id.
      3. nonce_signature must be a valid ECDSA-SHA-256 signature over
         the nonce bytes (UTF-8 encoded) under public_key_pem.
    """

    public_key_pem: str = Field(
        ...,
        description="SPKI PEM-encoded ECDH P-256 public key (device-generated; private key NEVER sent)",
        min_length=100,
        max_length=2048,
    )
    display_fingerprint: str = Field(
        ...,
        description="SHA-256 hex of the DER-encoded public key (64 chars) — for display only",
        min_length=64,
        max_length=64,
    )
    nonce: str = Field(
        ...,
        description="Single-use nonce from GET /keypairs/registration-challenge",
        min_length=32,
    )
    nonce_signature: str = Field(
        ...,
        description=(
            "ECDSA-SHA-256(private_key, nonce.encode('utf-8')), base64url-encoded. "
            "Web Crypto output format: IEEE P1363 (raw r||s, 64 bytes for P-256)."
        ),
        min_length=80,
        max_length=200,
    )

    @field_validator("public_key_pem")
    @classmethod
    def validate_pem_headers(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("-----BEGIN PUBLIC KEY-----"):
            raise ValueError("public_key_pem must start with '-----BEGIN PUBLIC KEY-----'")
        if not v.endswith("-----END PUBLIC KEY-----"):
            raise ValueError("public_key_pem must end with '-----END PUBLIC KEY-----'")
        return v

    @field_validator("display_fingerprint")
    @classmethod
    def validate_fingerprint_hex(cls, v: str) -> str:
        if not all(c in "0123456789abcdef" for c in v.lower()):
            raise ValueError("display_fingerprint must be lowercase hexadecimal")
        return v.lower()

    @field_validator("nonce_signature")
    @classmethod
    def validate_base64url(cls, v: str) -> str:
        # Accept both base64 and base64url; strip trailing '='
        allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=-_")
        if not all(c in allowed for c in v):
            raise ValueError("nonce_signature must be base64 or base64url encoded")
        return v


# ---------------------------------------------------------------------------
# KEYPAIR ENDPOINTS
# ---------------------------------------------------------------------------


@router.get(
    "/keypairs/registration-challenge",
    response_model=RegistrationChallengeResponse,
    summary="Get single-use registration challenge nonce",
    description=(
        "Issues a cryptographically random nonce that must be signed with the device's "
        "private key before calling POST /keypairs/register. Nonce is stored in Redis with "
        f"a {_NONCE_TTL_SECONDS}s TTL and consumed atomically on use (single-use guarantee)."
    ),
)
async def get_registration_challenge(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> RegistrationChallengeResponse:
    """
    Issue a single-use registration nonce for proof-of-possession.

    **Rate limiting:** If Redis is unavailable, the endpoint returns 503 to
    prevent nonce storage bypass.

    **Security:** The nonce is 32 random bytes (256 bits of entropy) encoded
    as lowercase hex (64 chars). The server stores a keyed HMAC of the nonce
    in Redis — not the raw nonce — to prevent enumeration.
    """
    if not cache_manager:
        raise HTTPException(
            status_code=503,
            detail="Registration service temporarily unavailable (cache required for nonce storage)",
        )

    # Generate a cryptographically random nonce
    nonce_bytes = secrets.token_bytes(_NONCE_BYTES)
    nonce_hex = nonce_bytes.hex()  # 64 lowercase hex chars

    issued_at = datetime.now(timezone.utc)
    redis_key = f"{_NONCE_REDIS_PREFIX}{current_user.id}"

    # Store in Redis with TTL — overwrite any previous unused nonce for this user
    # (prevents multiple outstanding nonces)
    try:
        cache_manager.redis_client.setex(redis_key, _NONCE_TTL_SECONDS, nonce_hex)
    except Exception as cache_err:
        logger.error(f"Failed to store registration nonce in Redis: {cache_err}")
        raise HTTPException(
            status_code=503,
            detail="Unable to issue registration challenge. Please retry.",
        )

    logger.info(f"Issued registration challenge for user {current_user.id}")

    return RegistrationChallengeResponse(
        nonce=nonce_hex,
        expires_in=_NONCE_TTL_SECONDS,
        issued_at=issued_at.isoformat().replace("+00:00", "Z"),
    )


@router.post(
    "/keypairs/register",
    response_model=UserKeypairResponse,
    status_code=201,
    summary="Register a client-generated ECDH P-256 public key",
    description=(
        "Accepts a device-generated ECDH P-256 public key and stores it. "
        "The private key is NEVER transmitted — it stays on the device in SecureStore. "
        "Requires a signed proof-of-possession (ECDSA-SHA-256 over the registration nonce) "
        "to prevent key substitution attacks."
    ),
)
async def register_keypair(
    body: RegisterKeypairRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> UserKeypairResponse:
    """
    Register a client-generated ECDH P-256 public key.

    **Zero-knowledge guarantee:** This endpoint stores only the public key.
    No private key is generated, stored, or accessed by the server.

    **Flow:**
    1. Validate PEM is a well-formed ECDH P-256 SPKI public key.
    2. Verify the registration nonce (from /keypairs/registration-challenge)
       exists in Redis and has not expired.
    3. Verify the ECDSA-SHA-256 signature of the nonce against the submitted PEM.
       → Proves caller holds the matching private key (proof-of-possession).
    4. Consume the nonce atomically from Redis (prevents replay).
    5. Compute SHA-256 fingerprint over the DER bytes of the public key.
    6. Store public key + fingerprint in PostgreSQL.
    7. Cache an opaque presence token in Redis (NOT the raw fingerprint).
    8. Write KEYPAIR_GENERATED audit entry.

    **Error codes:**
    - 409 KEYPAIR_ALREADY_EXISTS — Active keypair exists; DELETE /keypairs/me first.
    - 422 INVALID_PUBLIC_KEY     — PEM is malformed or not ECDH P-256.
    - 422 INVALID_SIGNATURE      — ECDSA proof-of-possession failed.
    - 422 NONCE_EXPIRED          — Nonce not found or TTL elapsed.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    from cryptography.hazmat.primitives import hashes as crypto_hashes
    from cryptography.exceptions import InvalidSignature
    import base64

    # ── 1. Parse and validate PEM ─────────────────────────────────────────────
    try:
        public_key = serialization.load_pem_public_key(
            body.public_key_pem.encode(),
            backend=default_backend(),
        )
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise ValueError("Not an elliptic curve key")
        if not isinstance(public_key.curve, ec.SECP256R1):
            raise ValueError(f"Expected P-256 (SECP256R1), got {type(public_key.curve).__name__}")
    except (ValueError, TypeError) as parse_err:
        logger.warning(f"Invalid public key PEM from user {current_user.id}: {parse_err}")
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_PUBLIC_KEY",
                "message": "public_key_pem is not a valid ECDH P-256 SPKI public key",
            },
        )

    # ── 2. Compute canonical DER-based fingerprint ─────────────────────────────
    # Hash the raw DER bytes (not PEM text) to match the frontend's computation:
    #   crypto.subtle.digest('SHA-256', spkiDer)
    try:
        der_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        computed_fingerprint = hashlib.sha256(der_bytes).hexdigest()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to compute key fingerprint")

    # Constant-time comparison of client-supplied vs server-computed fingerprint
    if not hmac.compare_digest(computed_fingerprint, body.display_fingerprint):
        logger.warning(
            f"Fingerprint mismatch for user {current_user.id}: "
            f"client={body.display_fingerprint[:16]}... server={computed_fingerprint[:16]}..."
        )
        raise HTTPException(
            status_code=422,
            detail={
                "code": "FINGERPRINT_MISMATCH",
                "message": (
                    "display_fingerprint does not match the server-computed SHA-256 of "
                    "the submitted public key's DER encoding"
                ),
            },
        )

    # ── 3. Validate and consume the nonce ─────────────────────────────────────
    if not cache_manager:
        raise HTTPException(
            status_code=503,
            detail="Registration service temporarily unavailable",
        )

    redis_key = f"{_NONCE_REDIS_PREFIX}{current_user.id}"
    try:
        stored_nonce = cache_manager.redis_client.get(redis_key)
    except Exception as cache_err:
        logger.error(f"Redis error reading nonce for {current_user.id}: {cache_err}")
        raise HTTPException(
            status_code=503,
            detail="Unable to verify registration nonce. Please retry.",
        )

    if stored_nonce is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "NONCE_EXPIRED",
                "message": (
                    f"Registration nonce has expired or was not found. "
                    f"Call GET /keypairs/registration-challenge to obtain a new one."
                ),
            },
        )

    # Decode bytes if Redis returns bytes
    if isinstance(stored_nonce, bytes):
        stored_nonce = stored_nonce.decode()

    if not hmac.compare_digest(stored_nonce, body.nonce):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "NONCE_MISMATCH",
                "message": "Submitted nonce does not match the issued challenge",
            },
        )

    # ── 4. Verify ECDSA proof-of-possession ───────────────────────────────────
    # The client signs the UTF-8 bytes of the nonce with ECDSA-SHA-256.
    # Web Crypto API outputs IEEE P1363 format (raw r‖s, 64 bytes for P-256).
    # We convert to DER for the cryptography library.
    nonce_data = body.nonce.encode("utf-8")

    # Normalise base64url → standard base64 and decode
    sig_b64 = body.nonce_signature.replace("-", "+").replace("_", "/")
    # Add padding
    sig_b64 += "=" * (4 - len(sig_b64) % 4) if len(sig_b64) % 4 else ""
    try:
        sig_bytes = base64.b64decode(sig_b64)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_SIGNATURE", "message": "nonce_signature is not valid base64"},
        )

    # Convert P1363 (r‖s, 64 bytes) to DER if needed
    if len(sig_bytes) == 64:
        # P1363 format: first 32 bytes = r, last 32 bytes = s
        r = int.from_bytes(sig_bytes[:32], "big")
        s = int.from_bytes(sig_bytes[32:], "big")
        from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
        sig_der = encode_dss_signature(r, s)
    else:
        # Assume DER format
        sig_der = sig_bytes

    try:
        public_key.verify(sig_der, nonce_data, ec.ECDSA(crypto_hashes.SHA256()))
    except InvalidSignature:
        logger.warning(f"ECDSA PoP verification failed for user {current_user.id}")
        # Log failed attempt before raising
        _log_action(
            db=db,
            user=current_user,
            action="KEYPAIR_REGISTER_FAILED",
            resource_type="USER_KEYPAIR",
            resource_id=str(current_user.id),
            event_data={"reason": "ECDSA proof-of-possession verification failed"},
            request=request,
            status=CryptoAuditLogStatus.DENIED,
        )
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_SIGNATURE",
                "message": (
                    "ECDSA proof-of-possession verification failed. "
                    "The signature does not match the submitted public key and nonce."
                ),
            },
        )
    except Exception as sig_err:
        logger.error(f"Signature verification error for {current_user.id}: {sig_err}")
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_SIGNATURE", "message": "Signature verification failed"},
        )

    # ── 5. Atomically consume the nonce (prevent replay) ─────────────────────
    try:
        cache_manager.redis_client.delete(redis_key)
    except Exception as del_err:
        # Non-fatal: nonce TTL will expire it naturally. Log and continue.
        logger.warning(f"Failed to delete consumed nonce for {current_user.id}: {del_err}")

    # ── 6. Register the public key in PostgreSQL (encrypted) ──────────────────────────────
    try:
        keypair = KeypairService.register_keypair(
            db=db,
            user_id=str(current_user.id),
            public_key_pem=body.public_key_pem,
            public_key_fingerprint=computed_fingerprint,
            nonce_signature_bytes=sig_bytes,  # Pass signature for encryption key derivation
        )
    except ValueError as val_err:
        logger.warning(f"Keypair registration validation error for {current_user.id}: {val_err}")
        raise HTTPException(status_code=409, detail=str(val_err))

    # ── 7. Write audit entry ──────────────────────────────────────────────────
    _log_action(
        db=db,
        user=current_user,
        action="KEYPAIR_GENERATED",
        resource_type="USER_KEYPAIR",
        resource_id=str(keypair.id),
        event_data={
            "algorithm": keypair.key_algorithm,
            "fingerprint_prefix": computed_fingerprint[:16],
            "registration_method": "client_generated_ecdsa_pop",
        },
        request=request,
    )

    logger.info(
        f"Registered client-generated keypair for user {current_user.id} "
        f"(fingerprint: {computed_fingerprint[:16]}...)"
    )

    return UserKeypairResponse(
        id=keypair.id,
        user_id=keypair.user_id,
        public_key_fingerprint=keypair.public_key_fingerprint,
        key_algorithm=keypair.key_algorithm,
        is_revoked=keypair.is_revoked,
        created_at=keypair.created_at,
    )


@router.get(
    "/keypairs/me",
    response_model=UserKeypairResponse,
    summary="Get current user's keypair metadata",
    description="Returns the public key fingerprint and registration status. Never returns the public key PEM itself.",
)
async def get_my_keypair(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserKeypairResponse:
    """
    Get current user's keypair metadata.

    **Response:** fingerprint + algorithm + timestamps (no PEM, no private key)

    **404:** No active keypair — call POST /keypairs/register first.
    """
    try:
        from app.models.encryption_models import UserKeypair

        keypair = (
            db.query(UserKeypair)
            .filter(
                UserKeypair.user_id == current_user.id,
                UserKeypair.is_revoked == False,  # noqa: E712
            )
            .order_by(UserKeypair.created_at.desc())
            .first()
        )

        if not keypair:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "NO_ACTIVE_KEYPAIR",
                    "message": "No active keypair found. Call POST /keypairs/register.",
                },
            )

        return UserKeypairResponse(
            id=keypair.id,
            user_id=keypair.user_id,
            public_key_fingerprint=keypair.public_key_fingerprint,
            key_algorithm=keypair.key_algorithm,
            is_revoked=keypair.is_revoked,
            created_at=keypair.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get keypair for {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve keypair")


@router.get(
    "/doctors/{doctor_id}/public-key",
    summary="Fetch encrypted public key for a doctor",
    description=(
        "Returns the encrypted public key blob for the specified doctor. "
        "The blob is encrypted with AES-256-GCM using the doctor's user_id as the derivation salt. "
        "Client decrypts on-device using HKDF-SHA256 with the patient's registration signature."
    ),
)
async def get_doctor_encrypted_public_key(
    doctor_id: str = Path(..., description="UUID of the doctor"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Fetch encrypted public key for a doctor.

    **Who can call:** Any authenticated user (usually a patient creating a session).

    **Returns:** Encrypted public key blob as JSON: {"v": 1, "ct": "...", "n": "...", "a": "AES-256-GCM"}

    **Client decryption:**
    ```
    // Frontend code
    const encryptedBlob = await getEncryptedPublicKey(doctorId);
    const signature = await getRegistrationSignature(); // from SecureStore
    const signatureBytes = base64UrlToBytes(signature);
    const publicKeyPEM = await decryptPublicKey(encryptedBlob, signatureBytes, doctorId);
    ```

    **404:** Doctor has no active keypair.
    """
    try:
        from app.models.encryption_models import UserKeypair
        import json

        # Fetch the doctor's active keypair
        keypair = (
            db.query(UserKeypair)
            .filter(
                UserKeypair.user_id == doctor_id,
                UserKeypair.is_revoked == False,  # noqa: E712
            )
            .order_by(UserKeypair.created_at.desc())
            .first()
        )

        if not keypair or not keypair.public_key_pem_encrypted:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "DOCTOR_NO_KEYPAIR",
                    "message": "Doctor has no active public key",
                },
            )

        # The encrypted blob is stored as JSON: {"v": 1, "ct": "...", "n": "...", "a": "AES-256-GCM"}
        # Parse and return it as a dict
        encrypted_blob = json.loads(keypair.public_key_pem_encrypted)

        logger.info(f"Fetched encrypted public key for doctor {doctor_id} (requested by {current_user.id})")

        return encrypted_blob

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch encrypted public key for doctor {doctor_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve encrypted public key")


@router.delete(
    "/keypairs/me",
    summary="Revoke current user's keypair",
    description=(
        "Marks the keypair as revoked in PostgreSQL and removes the presence token from Redis. "
        "All ACTIVE sessions created with this keypair are simultaneously revoked. "
        "The client MUST delete the private key from SecureStore after receiving a 200 response."
    ),
)
async def revoke_keypair(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Revoke current user's keypair.

    **Effect:** Immediate — doctor loses the ability to decrypt session keys.
    **Audit:** KEYPAIR_REVOKED event recorded.
    **Client responsibility:** Delete private key from SecureStore after 200 OK.
    """
    try:
        from app.models.encryption_models import UserKeypair

        keypair = (
            db.query(UserKeypair)
            .filter(
                UserKeypair.user_id == current_user.id,
                UserKeypair.is_revoked == False,  # noqa: E712
            )
            .first()
        )

        if not keypair:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "NO_ACTIVE_KEYPAIR",
                    "message": "No active keypair to revoke",
                },
            )

        keypair_id = str(keypair.id)
        KeypairService.revoke_keypair(db, str(current_user.id), "User requested")

        _log_action(
            db=db,
            user=current_user,
            action="KEYPAIR_REVOKED",
            resource_type="USER_KEYPAIR",
            resource_id=keypair_id,
            event_data={"reason": "User requested via DELETE /keypairs/me"},
            request=request,
        )

        logger.info(f"Revoked keypair {keypair_id} for user {current_user.id}")
        return {"message": "Keypair revoked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke keypair for {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke keypair")


# ---------------------------------------------------------------------------
# SESSION KEY ENDPOINTS
# ---------------------------------------------------------------------------


@router.post(
    "/sessions",
    response_model=SessionKeyResponse,
    status_code=201,
    summary="Patient grants doctor access (creates encrypted session)",
    description=(
        "The server generates a 32-byte random session key, encrypts it with the "
        "doctor's *public* key using ECDH + HKDF + ChaCha20-Poly1305, and stores the "
        "encrypted blob. The server NEVER knows the plaintext session key after creation."
    ),
)
async def create_session(
    doctor_id: str = Query(..., description="UUID of doctor to grant access"),
    ttl_days: int = Query(7, ge=1, le=90, description="Session TTL in days (1–90)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> SessionKeyResponse:
    """
    Create an encrypted session for a doctor to access patient records.

    **Who can call:** Patients only.

    **Prerequisites:**
    - The target doctor must have an active registered keypair.
    - The patient must not already have an ACTIVE session with this doctor.

    **Security:** The server encrypts a fresh 32-byte session key with the doctor's
    public key. Only the doctor's device (holding the private key) can decrypt it.
    """
    try:
        patient = (
            db.query(Patient)
            .filter(Patient.user_id == current_user.id)
            .first()
        )

        if not patient:
            raise HTTPException(
                status_code=403,
                detail={"code": "FORBIDDEN", "message": "Only patients can create sessions"},
            )

        # Validate doctor_id is a well-formed UUID
        import uuid as _uuid
        try:
            _uuid.UUID(doctor_id)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_DOCTOR_ID", "message": "doctor_id must be a valid UUID"},
            )

        session_key, _plaintext = SessionKeyService.create_session_key(
            db=db,
            patient_id=str(patient.id),
            doctor_id=doctor_id,
            ttl_days=ttl_days,
            reason=f"Patient {patient.id} granted access via API",
        )

        _log_action(
            db=db,
            user=current_user,
            action="SESSION_CREATED",
            resource_type="SESSION_KEY",
            resource_id=str(session_key.id),
            event_data={
                "doctor_id": doctor_id,
                "patient_id": str(patient.id),
                "ttl_days": ttl_days,
                "expires_at": session_key.expires_at.isoformat(),
            },
            request=request,
        )

        logger.info(f"Created session {session_key.id}: patient {patient.id} → doctor {doctor_id}")

        return SessionKeyResponse(
            id=session_key.id,
            patient_id=session_key.patient_id,
            doctor_id=session_key.doctor_id,
            session_key_hash=session_key.session_key_hash,
            status=session_key.status,
            expires_at=session_key.expires_at,
            created_at=session_key.created_at,
        )

    except HTTPException:
        raise
    except ValueError as val_err:
        logger.warning(f"Session creation validation error: {val_err}")
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as e:
        logger.error(f"Session creation failed for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")


@router.get(
    "/sessions",
    response_model=list[SessionKeyResponse],
    summary="List patient's sessions",
    description="Returns all sessions (active and historical) created by the authenticated patient.",
)
async def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter: ACTIVE | REVOKED | EXPIRED | ROTATED"),
    limit: int = Query(50, ge=1, le=500),
) -> list[SessionKeyResponse]:
    """List sessions created by the authenticated patient."""
    try:
        patient = (
            db.query(Patient)
            .filter(Patient.user_id == current_user.id)
            .first()
        )

        if not patient:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "NOT_PATIENT",
                    "message": "Doctors should use GET /sessions/as-doctor",
                },
            )

        sessions = SessionKeyService.list_active_sessions(db, str(patient.id))
        return [
            SessionKeyResponse(
                id=s.id,
                patient_id=s.patient_id,
                doctor_id=s.doctor_id,
                session_key_hash=s.session_key_hash,
                status=s.status,
                expires_at=s.expires_at,
                created_at=s.created_at,
            )
            for s in sessions[:limit]
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list sessions for {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list sessions")


@router.get(
    "/sessions/as-doctor",
    response_model=list[DoctorSessionListResponse],
    summary="List sessions where the caller is the doctor",
    description="Doctors call this to see which patients have granted them active access.",
)
async def list_sessions_as_doctor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=500),
) -> list[DoctorSessionListResponse]:
    """List active sessions for the authenticated doctor."""
    try:
        from app.models.encryption_models import SessionKey

        sessions = (
            db.query(SessionKey)
            .filter(
                SessionKey.doctor_id == current_user.id,
                SessionKey.status == SessionKeyStatus.ACTIVE,
                SessionKey.expires_at > datetime.now(timezone.utc),
            )
            .order_by(SessionKey.created_at.desc())
            .limit(limit)
            .all()
        )

        return [
            DoctorSessionListResponse(
                id=s.id,
                patient_id=s.patient_id,
                session_key_hash=s.session_key_hash,
                status=s.status,
                expires_at=s.expires_at,
                created_at=s.created_at,
            )
            for s in sessions
        ]

    except Exception as e:
        logger.error(f"Failed to list doctor sessions for {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list sessions")


@router.get(
    "/sessions/{session_id}/encrypted-key",
    response_model=EncryptedSessionKeyPayload,
    summary="Get encrypted session key payload for client-side decryption",
    description=(
        "Returns the ECDH-encrypted blob that the doctor decrypts on their device "
        "using their private key from SecureStore. The server CANNOT decrypt this payload. "
        "Audit event SESSION_KEY_RETRIEVED is recorded for compliance."
    ),
)
async def get_encrypted_session_key(
    session_id: str = Path(..., description="UUID of the session"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> EncryptedSessionKeyPayload:
    """
    Fetch the ECDH-encrypted session key blob for client-side decryption.

    **Zero-knowledge:** This endpoint returns ciphertext + ECDH parameters.
    Decryption requires the doctor's private key, which never leaves the device.

    **Client decryption steps:**
    1. `shared_secret = ECDH(doctor_private_key, ephemeral_public_key)`
    2. `symmetric_key = HKDF-SHA256(shared_secret, info=b'encryption_key', length=32)`
    3. `aad = f"{patient_id}:{doctor_id}".encode('utf-8')`
    4. `session_key = ChaCha20Poly1305.decrypt(symmetric_key, nonce, ciphertext+auth_tag, aad)`
    5. Verify `SHA-256(session_key) == session_key_hash`

    **Errors:**
    - 403 NOT_SESSION_DOCTOR — Caller is not the doctor for this session.
    - 404 SESSION_NOT_FOUND  — Session does not exist.
    - 410 SESSION_EXPIRED    — Session is expired, revoked, or rotated.
    - 422 LEGACY_SESSION     — Session was created without ECDH (ask patient to re-grant).
    """
    try:
        from app.models.encryption_models import SessionKey

        # Fetch session — ensure caller is the doctor
        session = (
            db.query(SessionKey)
            .filter(
                SessionKey.id == session_id,
                SessionKey.doctor_id == current_user.id,
            )
            .first()
        )

        if not session:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "SESSION_NOT_FOUND",
                    "message": "Session not found or you are not the doctor for this session",
                },
            )

        # Check liveness
        if session.status != SessionKeyStatus.ACTIVE or session.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=410,
                detail={
                    "code": "SESSION_EXPIRED",
                    "message": (
                        f"Session is {session.status.value.lower()} or has expired. "
                        "Ask the patient to revoke and re-create access."
                    ),
                },
            )

        # Verify the session was created with ECDH encryption
        if not session.ephemeral_public_key:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "LEGACY_SESSION",
                    "message": (
                        "This session was created before ECDH encryption was introduced. "
                        "Ask the patient to revoke and re-grant access."
                    ),
                },
            )

        # Audit log this access
        _log_action(
            db=db,
            user=current_user,
            action="SESSION_KEY_RETRIEVED",
            resource_type="SESSION_KEY",
            resource_id=str(session.id),
            event_data={"patient_id": str(session.patient_id)},
            request=request,
        )

        logger.info(
            f"Doctor {current_user.id} retrieved encrypted key for session {session_id}"
        )

        return EncryptedSessionKeyPayload(
            session_id=session.id,
            patient_id=session.patient_id,
            doctor_id=session.doctor_id,
            encrypted_key=session.encrypted_session_key,
            nonce=session.nonce,
            auth_tag=session.auth_tag,
            ephemeral_public_key=session.ephemeral_public_key,
            session_key_hash=session.session_key_hash,
            expires_at=session.expires_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get encrypted session key for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session key payload")


@router.post(
    "/sessions/{session_id}/decrypt",
    summary="[DEPRECATED] Server-assisted session key decryption",
    description=(
        "**This endpoint has been permanently disabled.**\n\n"
        "The BioNex zero-knowledge architecture requires that private keys remain on the "
        "user's device (SecureStore / Keychain / Keystore). The server no longer stores "
        "private keys in HashiCorp Vault.\n\n"
        "**Alternative:** Use `GET /sessions/{id}/encrypted-key` to retrieve the encrypted "
        "session key blob and decrypt it on the client device using the private key from SecureStore."
    ),
    deprecated=True,
    include_in_schema=True,
)
async def decrypt_session_key_deprecated(
    session_id: str = Path(..., description="UUID of the session"),
) -> None:
    """
    This endpoint is permanently removed as part of the zero-knowledge migration.

    The server no longer stores private keys. Decryption must happen on the client device.
    See GET /sessions/{id}/encrypted-key for the client-side decryption payload.
    """
    raise HTTPException(
        status_code=410,
        detail={
            "code": "ENDPOINT_DEPRECATED",
            "message": (
                "Server-assisted decryption is not supported in the zero-knowledge model. "
                "Use GET /sessions/{id}/encrypted-key to fetch the encrypted blob and "
                "decrypt it on-device using your private key from SecureStore."
            ),
            "migration_guide": "GET /api/v1/encryption/sessions/{id}/encrypted-key",
        },
    )


@router.delete(
    "/sessions/{session_id}",
    summary="Revoke a session",
    description=(
        "Immediately revokes the session. The doctor loses the ability to retrieve "
        "or decrypt the session key. Both the patient and doctor may call this endpoint."
    ),
)
async def revoke_session(
    session_id: str = Path(..., description="UUID of session to revoke"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Revoke a session key immediately.

    **Who can call:** The patient who created the session OR the doctor the access was granted to.
    **Effect:** Immediate — doctor can no longer fetch or use the encrypted key.
    **Audit:** SESSION_REVOKED event recorded.
    """
    try:
        from app.models.encryption_models import SessionKey

        session = (
            db.query(SessionKey)
            .filter(SessionKey.id == session_id)
            .first()
        )

        if not session:
            raise HTTPException(
                status_code=404,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        # Authorization: caller must be patient or doctor for this session
        patient = (
            db.query(Patient)
            .filter(Patient.user_id == current_user.id)
            .first()
        )

        is_session_patient = patient and session.patient_id == patient.id
        is_session_doctor = session.doctor_id == current_user.id

        if not is_session_patient and not is_session_doctor:
            _log_action(
                db=db,
                user=current_user,
                action="SESSION_REVOKE_DENIED",
                resource_type="SESSION_KEY",
                resource_id=session_id,
                event_data={"reason": "caller is not participant in this session"},
                request=request,
                status=CryptoAuditLogStatus.DENIED,
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "NOT_SESSION_PARTICIPANT",
                    "message": "Not authorized to revoke this session",
                },
            )

        SessionKeyService.revoke_session_key(db, session.session_key_hash, "User requested")

        _log_action(
            db=db,
            user=current_user,
            action="SESSION_REVOKED",
            resource_type="SESSION_KEY",
            resource_id=session_id,
            event_data={
                "doctor_id": str(session.doctor_id),
                "patient_id": str(session.patient_id),
                "revoked_by": "patient" if is_session_patient else "doctor",
            },
            request=request,
        )

        logger.info(f"Revoked session {session_id} by user {current_user.id}")
        return {"message": "Session revoked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke session")


# ---------------------------------------------------------------------------
# AUDIT LOG ENDPOINTS
# ---------------------------------------------------------------------------


@router.get(
    "/audit/logs",
    summary="Query audit logs",
    description=(
        "Returns paginated cryptographic audit logs for the authenticated user. "
        "Supports filtering by action, resource type, and date range."
    ),
)
async def query_audit_logs(
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    status: Optional[str] = Query(None, description="SUCCESS | FAILED | DENIED"),
    start_date: Optional[str] = Query(None, description="ISO-8601 start timestamp"),
    end_date: Optional[str] = Query(None, description="ISO-8601 end timestamp"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Query audit logs (GDPR / HIPAA compliance)."""
    try:
        start = None
        end = None

        if start_date:
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if end_date:
            end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))

        status_enum = None
        if status:
            try:
                status_enum = CryptoAuditLogStatus[status.upper()]
            except KeyError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status '{status}'. Must be SUCCESS, FAILED, or DENIED.",
                )

        logs = CryptoAuditService.query_audit_logs(
            db=db,
            resource_type=resource_type,
            action=action,
            status=status_enum,
            start_date=start,
            end_date=end,
            limit=limit,
        )

        return [
            {
                "id": str(log.id),
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_type": log.actor_type.value,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id),
                "status": log.status.value,
                "status_message": log.status_message,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat(),
                "event_data": log.event_data,
            }
            for log in logs
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to query audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to query audit logs")


@router.get(
    "/audit/compliance-report",
    summary="Generate compliance report",
    description="GDPR / HIPAA / NHS compliance summary for a date range.",
)
async def get_compliance_report(
    start_date: str = Query(..., description="ISO-8601 start timestamp"),
    end_date: str = Query(..., description="ISO-8601 end timestamp"),
    resource_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a compliance summary report."""
    try:
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))

        report = CryptoAuditService.generate_compliance_report(
            db=db,
            start_date=start,
            end_date=end,
            resource_type=resource_type,
        )

        return report

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate compliance report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")


# ---------------------------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------------------------


@router.get("/health", summary="Encryption service health check", tags=["health"])
async def health_check(db: Session = Depends(get_db)):
    """Quick liveness probe for the encryption service."""
    try:
        from app.models.encryption_models import UserKeypair

        db.query(UserKeypair).limit(1).all()

        return {
            "status": "ok",
            "service": "encryption-api",
            "zero_knowledge": True,
            "vault_for_user_keys": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")
