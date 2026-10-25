"""
Public Key Encryption & Decryption Service

Encrypts and decrypts public keys stored in the database using:
  1. User signature (ECDSA signature of nonce) as entropy source
  2. HKDF-SHA256 for key derivation
  3. AES-256-GCM for authenticated encryption
  4. Base64url encoding for storage

Zero-knowledge guarantee:
  - Public key is encrypted in the database (no plaintext storage)
  - Encryption key is derived from user's signature (only they can decrypt)
  - Each public key gets a unique 96-bit nonce (stored with ciphertext)
  - Authentication tag prevents tampering
  - Decryption requires knowledge of the original signature
"""

import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend
import logging

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

# AES-256 requires 32 bytes (256 bits)
ENCRYPTION_KEY_SIZE = 32

# GCM nonce size: 96 bits (12 bytes) is standard for GCM
GCM_NONCE_SIZE = 12

# HKDF info string (domain separation)
HKDF_INFO = b"bionex_public_key_encryption_v1"

# ─── Helper: Base64url encoding/decoding (URL-safe) ────────────────────────

def _base64url_encode(data: bytes) -> str:
    """Encode bytes to base64url string (no padding)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(data: str) -> bytes:
    """Decode base64url string to bytes (handles missing padding)."""
    # Add back padding if needed
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


# ─── Encryption ───────────────────────────────────────────────────────────────

def derive_encryption_key(signature_bytes: bytes, salt: bytes = b"") -> bytes:
    """
    Derive a 256-bit encryption key from the user's ECDSA signature.

    Uses HKDF-SHA256 with:
      - IKM (input key material): signature bytes
      - Salt: optional user-specific salt (e.g., user_id)
      - Info: domain-specific info string
      - Output: 32 bytes (256 bits) for AES-256

    Args:
        signature_bytes: The ECDSA signature bytes (from nonce signing)
        salt: Optional salt for additional domain separation (e.g., user_id bytes)

    Returns:
        32-byte encryption key
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=ENCRYPTION_KEY_SIZE,
        salt=salt if salt else None,
        info=HKDF_INFO,
        backend=default_backend(),
    )
    return hkdf.derive(signature_bytes)


def encrypt_public_key(
    public_key_pem: str,
    signature_bytes: bytes,
    user_id_salt: bytes = b"",
) -> dict:
    """
    Encrypt a public key PEM using AES-256-GCM.

    The encryption key is derived from the user's signature (proof-of-possession).
    Only someone with the original signature can decrypt it.

    Args:
        public_key_pem: SPKI PEM-encoded public key (string)
        signature_bytes: ECDSA signature bytes (the nonce signature from registration)
        user_id_salt: Optional user ID bytes for domain separation

    Returns:
        Dictionary with encrypted payload:
        {
            "ciphertext": "base64url_encoded_encrypted_data",
            "nonce": "base64url_encoded_96bit_nonce",
            "algorithm": "AES-256-GCM",
            "version": 1
        }

    Raises:
        ValueError: If inputs are invalid
    """
    if not public_key_pem or not public_key_pem.strip():
        raise ValueError("public_key_pem cannot be empty")
    if not signature_bytes or len(signature_bytes) < 16:
        raise ValueError("signature_bytes must be at least 16 bytes")

    try:
        # Step 1: Derive encryption key from signature
        encryption_key = derive_encryption_key(signature_bytes, salt=user_id_salt)

        # Step 2: Generate random 96-bit nonce for this encryption
        gcm_nonce = os.urandom(GCM_NONCE_SIZE)

        # Step 3: Encrypt the public key PEM
        cipher = AESGCM(encryption_key)
        plaintext = public_key_pem.encode("utf-8")
        
        # GCM includes the authentication tag in the ciphertext
        ciphertext = cipher.encrypt(gcm_nonce, plaintext, associated_data=None)

        # Step 4: Return encrypted payload (nonce + ciphertext)
        result = {
            "ciphertext": _base64url_encode(ciphertext),
            "nonce": _base64url_encode(gcm_nonce),
            "algorithm": "AES-256-GCM",
            "version": 1,
        }

        logger.debug(
            f"Encrypted public key: {len(plaintext)} bytes plaintext → "
            f"{len(ciphertext)} bytes ciphertext (includes 16-byte auth tag)"
        )

        return result

    except Exception as e:
        logger.error(f"Failed to encrypt public key: {e}")
        raise


def decrypt_public_key(
    encrypted_payload: dict,
    signature_bytes: bytes,
    user_id_salt: bytes = b"",
) -> str:
    """
    Decrypt a public key PEM from an encrypted payload.

    Reverses the encryption process using the signature-derived key.
    Verifies authentication tag (GCM ensures integrity).

    Args:
        encrypted_payload: Dictionary with "ciphertext" and "nonce" (base64url)
        signature_bytes: Original ECDSA signature bytes (same as used for encryption)
        user_id_salt: Optional user ID bytes (must match encryption)

    Returns:
        Decrypted public key PEM string

    Raises:
        ValueError: If decryption fails or authentication tag is invalid
    """
    if not isinstance(encrypted_payload, dict):
        raise ValueError("encrypted_payload must be a dictionary")

    try:
        # Extract algorithm and version (for future compatibility)
        algorithm = encrypted_payload.get("algorithm", "AES-256-GCM")
        version = encrypted_payload.get("version", 1)

        if algorithm != "AES-256-GCM":
            raise ValueError(f"Unsupported algorithm: {algorithm}")
        if version != 1:
            raise ValueError(f"Unsupported version: {version}")

        # Step 1: Decode base64url to get ciphertext and nonce
        ciphertext = _base64url_decode(encrypted_payload["ciphertext"])
        gcm_nonce = _base64url_decode(encrypted_payload["nonce"])

        if len(gcm_nonce) != GCM_NONCE_SIZE:
            raise ValueError(
                f"Invalid nonce size: expected {GCM_NONCE_SIZE}, got {len(gcm_nonce)}"
            )

        # Step 2: Derive the same encryption key
        encryption_key = derive_encryption_key(signature_bytes, salt=user_id_salt)

        # Step 3: Decrypt and verify authentication tag
        cipher = AESGCM(encryption_key)
        plaintext = cipher.decrypt(gcm_nonce, ciphertext, associated_data=None)

        # Step 4: Convert back to PEM string
        public_key_pem = plaintext.decode("utf-8")

        logger.debug(
            f"Decrypted public key: {len(ciphertext)} bytes ciphertext → "
            f"{len(plaintext)} bytes plaintext"
        )

        return public_key_pem

    except Exception as e:
        logger.error(f"Failed to decrypt public key: {e}")
        raise


# ─── Storage Format ───────────────────────────────────────────────────────────

def create_encrypted_storage_blob(
    public_key_pem: str,
    signature_bytes: bytes,
    user_id_salt: bytes = b"",
) -> str:
    """
    Create a complete encrypted storage blob (JSON-serialized and base64url encoded).

    This is what gets stored in the database:
      {
        "v": 1,
        "ct": "base64url_ciphertext",
        "n": "base64url_nonce",
        "a": "AES-256-GCM"
      }

    Args:
        public_key_pem: SPKI PEM-encoded public key
        signature_bytes: ECDSA signature bytes
        user_id_salt: Optional user ID bytes

    Returns:
        Compact JSON string (ready for database storage)
    """
    import json

    encrypted = encrypt_public_key(public_key_pem, signature_bytes, user_id_salt)

    # Compact JSON with minimal keys (v=version, ct=ciphertext, n=nonce, a=algorithm)
    storage_blob = {
        "v": encrypted["version"],
        "ct": encrypted["ciphertext"],
        "n": encrypted["nonce"],
        "a": encrypted["algorithm"],
    }

    return json.dumps(storage_blob, separators=(",", ":"))


def extract_and_decrypt_storage_blob(
    storage_blob_json: str,
    signature_bytes: bytes,
    user_id_salt: bytes = b"",
) -> str:
    """
    Parse and decrypt a storage blob from the database.

    Args:
        storage_blob_json: Compact JSON from database
        signature_bytes: ECDSA signature bytes
        user_id_salt: Optional user ID bytes

    Returns:
        Decrypted public key PEM string
    """
    import json

    blob = json.loads(storage_blob_json)

    encrypted_payload = {
        "version": blob["v"],
        "ciphertext": blob["ct"],
        "nonce": blob["n"],
        "algorithm": blob["a"],
    }

    return decrypt_public_key(encrypted_payload, signature_bytes, user_id_salt)
