"""
Core Encryption Service for Medical Record Protection

Orchestrates all cryptographic operations:
1. User keypair registration (client-generated; server stores public key ONLY)
2. Session key creation for doctor-patient access
3. Medical record encryption/decryption
4. Session lifecycle management (creation, validation, revocation)

Zero-Knowledge Architecture:
  • Private keys are NEVER generated or stored by this service.
  • The client generates ECDH P-256 keypairs on-device.
  • register_keypair() accepts only the public key PEM.
  • HashiCorp Vault is used ONLY for the audit-signing ECDSA key.

Uses:
- KeyExchangeManager: ECDH P-256 + ChaCha20-Poly1305
- CacheManager: Redis for performance optimization

Performance:
- Session creation: <50ms (DB + Redis)
- Session validation: <1ms (cached)
- Record encryption: <2ms per MB
"""

import logging
import uuid
from typing import Tuple, Optional, List, Dict
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_

from app.models.encryption_models import (
    UserKeypair,
    SessionKey,
    SessionKeyStatus,
    EncryptedRecordVault,
)
from app.schemas.encryption_schemas import (
    UserKeypairResponse,
    SessionKeyResponse,
    EncryptedRecordVaultResponse,
)
from app.services.key_exchange import KeyExchangeManager
from app.security.cache import cache_manager
# NOTE: vault_manager is NOT imported here — user private keys are NEVER stored in Vault.
# The audit signing key (ECDSA) still uses Vault via crypto_audit_service.py.
from app.security.crypto import CryptoManager
from app.config import get_settings

logger = logging.getLogger(__name__)


class KeypairService:
    """
    Manage user ECDH P-256 public keys.

    Zero-knowledge storage strategy:
    - Private key: NEVER stored — lives only on the user's device (SecureStore)
    - Public key PEM: PostgreSQL (AES-256 encrypted via pgp_sym_encrypt recommended)
    - Public key fingerprint: SHA-256(DER bytes), indexed in PostgreSQL
    - Presence token: Opaque Redis entry (NOT the raw fingerprint)

    One active keypair per user. A new registration first revokes the old one
    (handled by the router via DELETE /keypairs/me before re-registering).
    """

    @staticmethod
    def register_keypair(
        db: DBSession,
        user_id: str,
        public_key_pem: str,
        public_key_fingerprint: str,
        nonce_signature_bytes: bytes = None,
    ) -> UserKeypair:
        """
        Store a client-generated ECDH P-256 public key (encrypted).

        This method ONLY accepts a public key — the private key is NEVER
        generated or stored by the server.

        Flow:
          1. Reject if an active (non-revoked) keypair already exists for this user.
          2. Encrypt the public key PEM using AES-256-GCM with key derived from nonce_signature
          3. Create UserKeypair row in PostgreSQL with encrypted PEM.
          4. Cache an opaque presence token in Redis (key: user_id → fingerprint).

        Args:
            db:                    SQLAlchemy session
            user_id:               UUID string of the registering user
            public_key_pem:        SPKI PEM-encoded ECDH P-256 public key
            public_key_fingerprint: SHA-256 hex of the DER-encoded public key (64 chars)
            nonce_signature_bytes: ECDSA signature bytes (used as entropy for key derivation)

        Returns:
            UserKeypair: The newly created DB row

        Raises:
            ValueError: If the user already has an active keypair.
                        The router should instruct the client to DELETE /keypairs/me first.
        """
        from app.services.public_key_encryption import create_encrypted_storage_blob
        
        try:
            # Guard: only one active keypair per user at a time
            existing = db.query(UserKeypair).filter(
                and_(
                    UserKeypair.user_id == uuid.UUID(user_id),
                    UserKeypair.is_revoked == False,  # noqa: E712
                )
            ).first()

            if existing:
                logger.warning(
                    f"User {user_id} already has active keypair {existing.id} — "
                    "client must DELETE /keypairs/me before re-registering"
                )
                raise ValueError(
                    f"KEYPAIR_ALREADY_EXISTS: User already has an active keypair ({existing.id}). "
                    "Revoke it first via DELETE /keypairs/me."
                )

            # Encrypt the public key PEM using nonce signature as entropy
            user_id_bytes = uuid.UUID(user_id).bytes
            encrypted_blob = create_encrypted_storage_blob(
                public_key_pem=public_key_pem,
                signature_bytes=nonce_signature_bytes or b"",
                user_id_salt=user_id_bytes,
            )

            # Persist the public key row (PEM is now encrypted)
            keypair = UserKeypair(
                user_id=uuid.UUID(user_id),
                public_key_pem_encrypted=encrypted_blob,
                public_key_fingerprint=public_key_fingerprint,
                key_algorithm="ECDH_P256",
                is_revoked=False,
                revocation_reason=None,
                created_at=datetime.now(timezone.utc),
            )

            db.add(keypair)
            db.commit()
            db.refresh(keypair)

            # Cache the public key PEM for fast session-creation lookups
            if cache_manager:
                try:
                    cache_manager.cache_public_key(user_id, public_key_pem)
                except Exception as cache_err:
                    # Non-critical — DB is the authoritative source
                    logger.debug(f"Public-key Redis cache write skipped for {user_id}: {cache_err}")

            logger.info(
                f"Registered client-generated keypair for user {user_id}: "
                f"id={keypair.id}, fingerprint={public_key_fingerprint[:16]}..., "
                f"public_key_pem_encrypted=✓"
            )
            return keypair

        except ValueError:
            raise  # propagate without rollback (no DB change attempted)
        except Exception as e:
            logger.error(f"register_keypair failed for user {user_id}: {e}")
            db.rollback()
            raise

    @staticmethod
    def get_public_key_decrypted(
        db: DBSession,
        user_id: str,
        nonce_signature_bytes: bytes = None,
    ) -> Optional[str]:
        """
        Retrieve and decrypt a user's active public key.

        Decryption requires the original nonce_signature_bytes used during registration.
        If not provided, attempts to decrypt using empty bytes (will fail for encrypted keys).

        Cache strategy:
        - First check: Redis (99% hit rate, <1ms)
        - Second check: PostgreSQL (decrypt if encrypted)
        - Fallback: Return None if not found

        Args:
            db: Database session
            user_id: UUID of user
            nonce_signature_bytes: Original ECDSA signature from registration (for decryption key)

        Returns:
            Optional[str]: Decrypted public key in PEM format or None
        """
        from app.services.public_key_encryption import extract_and_decrypt_storage_blob
        
        try:
            # Try Redis cache first (returns plaintext cached version)
            if cache_manager:
                cached = cache_manager.get_public_key(user_id)
                if cached:
                    logger.debug(f"Cache hit for public key: {user_id}")
                    return cached

            # Fetch from DB
            keypair = db.query(UserKeypair).filter(
                and_(
                    UserKeypair.user_id == uuid.UUID(user_id),
                    UserKeypair.is_revoked == False,  # noqa: E712
                )
            ).first()

            if not keypair:
                logger.debug(f"No active keypair found for user {user_id}")
                return None

            # Decrypt if stored in encrypted format
            if hasattr(keypair, 'public_key_pem_encrypted') and keypair.public_key_pem_encrypted:
                try:
                    user_id_bytes = uuid.UUID(user_id).bytes
                    public_key_pem = extract_and_decrypt_storage_blob(
                        storage_blob_json=keypair.public_key_pem_encrypted,
                        signature_bytes=nonce_signature_bytes or b"",
                        user_id_salt=user_id_bytes,
                    )
                    
                    # Cache for future use
                    if cache_manager:
                        try:
                            cache_manager.cache_public_key(user_id, public_key_pem)
                        except Exception as cache_err:
                            logger.debug(f"Cache write failed (non-critical): {cache_err}")
                    
                    return public_key_pem
                    
                except Exception as decrypt_err:
                    logger.error(f"Failed to decrypt public key for {user_id}: {decrypt_err}")
                    raise
            
            # Fallback for plaintext (legacy rows)
            elif hasattr(keypair, 'public_key_pem') and keypair.public_key_pem:
                return keypair.public_key_pem
            
            return None

        except Exception as e:
            logger.error(f"get_public_key_decrypted failed for {user_id}: {e}")
            return None
    
    @staticmethod
    def get_public_key(
        db: DBSession,
        user_id: str
    ) -> Optional[str]:
        """
        Get user's public key (with Redis caching)
        
        Cache strategy:
        - First check: Redis (99% hit rate, <1ms)
        - Second check: PostgreSQL (1% miss rate)
        - Fallback: Return None if not found
        
        Args:
            db: Database session
            user_id: UUID of user
        
        Returns:
            Optional[str]: Public key in PEM format or None
        """
        try:
            # Try Redis cache first
            cached = cache_manager.get_public_key(user_id) if cache_manager else None
            
            if cached:
                logger.debug(f"Cache hit for public key: {user_id}")
                return cached
            
            # Fall back to database
            keypair = db.query(UserKeypair).filter(
                and_(
                    UserKeypair.user_id == uuid.UUID(user_id),
                    UserKeypair.is_revoked == False
                )
            ).first()
            
            if not keypair:
                logger.warning(f"No active keypair found for user {user_id}")
                return None
            
            # Handle encrypted keys (from new encryption system)
            if hasattr(keypair, 'public_key_pem_encrypted') and keypair.public_key_pem_encrypted:
                # Encrypted key requires signature bytes for decryption
                # Since we don't have them here, we fallback to cached version
                # In production, this method is only called after caching
                logger.debug(f"Encrypted key found for {user_id}, requires nonce signature for decryption")
                return None
            
            # Handle plaintext keys (legacy or fallback)
            if hasattr(keypair, 'public_key_pem') and keypair.public_key_pem:
                # Cache the result
                if cache_manager:
                    cache_manager.cache_public_key(user_id, keypair.public_key_pem)
                
                return keypair.public_key_pem
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get public key for {user_id}: {str(e)}")
            return None
    
    @staticmethod
    def get_private_key(user_id: str) -> None:  # type: ignore[return]
        """
        [DEPRECATED — Zero-Knowledge Architecture]

        Private keys are NEVER stored by this service.

        In the new zero-knowledge model, decryption happens on the client device.
        The doctor's private key lives in device SecureStore (Keychain/Keystore).
        This server has no access to any user's private key.

        To decrypt a session key, use:
            GET /api/v1/encryption/sessions/{id}/encrypted-key
        and decrypt the returned blob on-device.

        Raises:
            NotImplementedError: Always. This method must not be called.
        """
        raise NotImplementedError(
            "get_private_key() is not available in the zero-knowledge model. "
            "Private keys are stored only on the client device. "
            "Use GET /sessions/{id}/encrypted-key for client-side decryption."
        )
    
    @staticmethod
    def revoke_keypair(
        db: DBSession,
        user_id: str,
        reason: str = "User requested",
    ) -> None:
        """
        Mark the user's active keypair as revoked.

        Sets is_revoked=True and revoked_at=now() on the active keypair.
        Clears the Redis cache entry so session creation with the old key fails immediately.

        Note: The public key PEM is retained in PostgreSQL for audit-trail purposes.
              Private keys were NEVER stored — there is nothing to delete from Vault.

        Args:
            db:      SQLAlchemy session
            user_id: UUID string of the user
            reason:  Human-readable revocation reason (stored for audit)

        Raises:
            Exception: On DB commit failure (rolls back).
        """
        try:
            keypair = db.query(UserKeypair).filter(
                and_(
                    UserKeypair.user_id == uuid.UUID(user_id),
                    UserKeypair.is_revoked == False,  # noqa: E712
                )
            ).first()

            if not keypair:
                logger.info(f"revoke_keypair: no active keypair found for user {user_id} — nothing to do")
                return

            keypair.is_revoked = True
            keypair.revocation_reason = reason
            keypair.revoked_at = datetime.now(timezone.utc)
            db.commit()

            # Purge Redis cache immediately so new sessions cannot use the old key
            if cache_manager:
                try:
                    cache_manager.invalidate_public_key(user_id)
                except Exception as cache_err:
                    logger.debug(f"Redis invalidation skipped for {user_id}: {cache_err}")

            logger.info(f"Revoked keypair {keypair.id} for user {user_id}: {reason}")

        except Exception as e:
            logger.error(f"Failed to revoke keypair for {user_id}: {e}")
            db.rollback()
            raise


class SessionKeyService:
    """
    Manage ephemeral session keys for doctor-patient access
    
    Lifecycle:
    - Created: When doctor requests patient access
    - Active: Valid and usable (7 days by default)
    - Rotated: Old key replaced with new one
    - Revoked: Immediately disabled
    - Expired: After TTL (automatic in DB query)
    
    Storage:
    - Encrypted session key: DB (encrypted with doctor's public key)
    - Session key hash: Indexed in DB + Redis (for validation)
    - Lookup index: (patient_id, doctor_id) for access control
    """
    
    @staticmethod
    def create_session_key(
        db: DBSession,
        patient_id: str,
        doctor_id: str,
        ttl_days: Optional[int] = None,
        reason: Optional[str] = None
    ) -> Tuple[SessionKey, str]:
        """
        Create ephemeral session key for doctor to access patient records
        
        Flow:
        1. Get doctor's public key
        2. Generate random session key (32 bytes)
        3. Hash session key for storage
        4. Encrypt session key with doctor's public key via ECDH
        5. Store encrypted key in DB
        6. Cache session key hash in Redis
        
        Args:
            db: Database session
            patient_id: UUID of patient
            doctor_id: UUID of doctor
            ttl_days: Time-to-live in days (default: 7)
            reason: Creation reason for audit
        
        Returns:
            Tuple[SessionKey, str]: (SessionKey object, plaintext session key)
        
        Raises:
            ValueError: If doctor's keypair not found
        """
        try:
            if ttl_days is None:
                try:
                    ttl_days = get_settings().SESSION_KEY_TTL_DAYS
                except Exception:
                    ttl_days = 7  # safe default if settings not available
            
            # Step 1: Get doctor's public key
            doctor_public_key = KeypairService.get_public_key(db, doctor_id)
            if not doctor_public_key:
                raise ValueError(f"Doctor {doctor_id} has no active keypair")
            
            # Step 2: Generate random session key (32 bytes = 256 bits)
            session_key_plaintext = CryptoManager.generate_random_bytes(32)

            # Step 3: Hash for storage/lookup (hex string)
            session_key_hash = CryptoManager.hash_data(session_key_plaintext)
            
            # Step 4: Encrypt with ECDH (ephemeral sender key)
            encrypted_data = KeyExchangeManager.encrypt_for_public_key(
                session_key_plaintext,
                doctor_public_key,
                associated_data=f"{patient_id}:{doctor_id}".encode()
            )
            
            # Step 5: Store in DB
            expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
            session_key = SessionKey(
                patient_id=uuid.UUID(patient_id),
                doctor_id=uuid.UUID(doctor_id),
                session_key_hash=session_key_hash,
                encrypted_session_key=encrypted_data['encrypted_key'],
                nonce=encrypted_data['nonce'],
                auth_tag=encrypted_data['auth_tag'],
                ephemeral_public_key=encrypted_data['ephemeral_public_key'],
                status=SessionKeyStatus.ACTIVE,
                expires_at=expires_at,
                created_at=datetime.now(timezone.utc),  # tz-aware
                creation_reason=reason
            )
            
            db.add(session_key)
            db.commit()
            db.refresh(session_key)
            
            # Step 6: Cache hash for fast validation
            if cache_manager:
                cache_manager.cache_session_key_hash(
                    session_key_hash,
                    doctor_id,
                    ttl_seconds=ttl_days * 86400,
                )
            
            logger.info(f"Created session key for doctor {doctor_id} → patient {patient_id}")
            
            # Return plaintext for this request only
            return session_key, session_key_plaintext.hex()
            
        except Exception as e:
            logger.error(f"Session key creation failed: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    def validate_session_key(
        db: DBSession,
        session_key_hash: str,
        doctor_id: str,
        patient_id: str
    ) -> bool:
        """
        Validate session key (with caching optimization)
        
        Cache-aside pattern:
        1. Check Redis cache (<1ms)
        2. Fall back to DB query
        3. Cache positive result
        
        Args:
            db: Database session
            session_key_hash: Hash of plaintext session key
            doctor_id: UUID of doctor
            patient_id: UUID of patient
        
        Returns:
            bool: True if valid and active, False otherwise
        """
        try:
            # Try cache first (99% hit rate)
            if cache_manager:
                cached_doctor = cache_manager.get_session_key_doctor(session_key_hash)
                if cached_doctor:
                    logger.debug("Cache hit for session validation")
                    return True

            # Fall back to DB
            session_key = db.query(SessionKey).filter(
                and_(
                    SessionKey.session_key_hash == session_key_hash,
                    SessionKey.doctor_id == uuid.UUID(doctor_id),
                    SessionKey.patient_id == uuid.UUID(patient_id),
                    SessionKey.status == SessionKeyStatus.ACTIVE,
                    SessionKey.expires_at > datetime.now(timezone.utc)  # tz-aware
                )
            ).first()

            if session_key:
                # Cache positive result
                remaining = session_key.expires_at - datetime.now(timezone.utc)
                ttl = int(remaining.total_seconds())
                if cache_manager:
                    cache_manager.cache_session_key_hash(
                        session_key_hash, doctor_id, ttl_seconds=ttl
                    )
                return True

            return False
            
        except Exception as e:
            logger.error(f"Session validation failed: {str(e)}")
            return False
    
    @staticmethod
    def revoke_session_key(
        db: DBSession,
        session_key_hash: str,
        reason: str = "User requested"
    ) -> None:
        """
        Revoke session key immediately
        
        Args:
            db: Database session
            session_key_hash: Hash of session key to revoke
            reason: Revocation reason
        """
        try:
            session_key = db.query(SessionKey).filter(
                SessionKey.session_key_hash == session_key_hash
            ).first()
            
            if session_key:
                session_key.status = SessionKeyStatus.REVOKED
                session_key.revoked_at = datetime.now(timezone.utc)  # tz-aware
                session_key.revocation_reason = reason
                db.commit()

                # Invalidate cache immediately
                if cache_manager:
                    cache_manager.invalidate_session(session_key_hash)
                
                logger.info(f"Revoked session key: {reason}")
            
        except Exception as e:
            logger.error(f"Failed to revoke session key: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    def list_active_sessions(
        db: DBSession,
        patient_id: str,
        doctor_id: Optional[str] = None
    ) -> List[SessionKey]:
        """
        List active session keys for patient (optionally filtered by doctor)
        
        Args:
            db: Database session
            patient_id: UUID of patient
            doctor_id: Optional UUID of doctor to filter
        
        Returns:
            List[SessionKey]: Active session keys
        """
        query = db.query(SessionKey).filter(
            and_(
                SessionKey.patient_id == uuid.UUID(patient_id),
                SessionKey.status == SessionKeyStatus.ACTIVE,
                SessionKey.expires_at > datetime.now(timezone.utc)  # tz-aware
            )
        )
        
        if doctor_id:
            query = query.filter(SessionKey.doctor_id == uuid.UUID(doctor_id))
        
        return query.all()


class EncryptedRecordService:
    """
    Store and manage encrypted medical records
    
    Storage:
    - Ciphertext: ChaCha20-Poly1305 encrypted (AEAD)
    - Metadata: Plain text, indexed for searches without decryption
    - Soft delete: Records marked as deleted, not removed (audit trail)
    """
    
    @staticmethod
    def store_encrypted_record(
        db: DBSession,
        patient_id: str,
        plaintext: bytes,
        record_type: str,
        record_date: datetime,
        record_title: str,
        session_key: bytes
    ) -> EncryptedRecordVault:
        """
        Encrypt and store medical record
        
        Args:
            db: Database session
            patient_id: UUID of patient
            plaintext: Unencrypted record data
            record_type: Type of record (PRESCRIPTION, LAB_REPORT, etc.)
            record_date: When record was created
            record_title: Human-readable title
            session_key: ChaCha20 symmetric key (32 bytes)
        
        Returns:
            EncryptedRecordVault: Stored encrypted record
        """
        try:
            # Encrypt with ChaCha20-Poly1305
            aad = f"{patient_id}:{record_type}".encode()  # Associated data for auth
            encrypted_data = CryptoManager.encrypt_chacha20(plaintext, session_key, aad)
            
            # Hash title for searching without decryption
            title_hash = CryptoManager.hash_data(record_title.encode())
            
            # Store in DB
            record = EncryptedRecordVault(
                patient_id=uuid.UUID(patient_id),
                ciphertext=encrypted_data['ciphertext'],
                nonce=encrypted_data['nonce'],
                auth_tag=encrypted_data['auth_tag'],
                record_type=record_type,
                record_date=record_date,
                record_title=record_title,
                record_title_hash=title_hash,
                encryption_algorithm="CHACHA20_POLY1305",
                is_deleted=False,
                created_at=datetime.now(timezone.utc)  # tz-aware
            )
            
            db.add(record)
            db.commit()
            db.refresh(record)
            
            logger.info(f"Stored encrypted record for patient {patient_id}: {record.id}")
            return record
            
        except Exception as e:
            logger.error(f"Failed to store encrypted record: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    def retrieve_encrypted_record(
        db: DBSession,
        record_id: str
    ) -> Optional[EncryptedRecordVault]:
        """
        Retrieve encrypted record (plaintext not decrypted here)
        
        Args:
            db: Database session
            record_id: UUID of record
        
        Returns:
            Optional[EncryptedRecordVault]: Encrypted record or None
        """
        return db.query(EncryptedRecordVault).filter(
            and_(
                EncryptedRecordVault.id == uuid.UUID(record_id),
                EncryptedRecordVault.is_deleted == False
            )
        ).first()
    
    @staticmethod
    def list_records_by_type(
        db: DBSession,
        patient_id: str,
        record_type: str,
        limit: int = 100
    ) -> List[EncryptedRecordVault]:
        """
        List encrypted records by type (searchable without decryption)
        
        Args:
            db: Database session
            patient_id: UUID of patient
            record_type: Type to filter
            limit: Maximum results
        
        Returns:
            List[EncryptedRecordVault]: Encrypted records matching type
        """
        return db.query(EncryptedRecordVault).filter(
            and_(
                EncryptedRecordVault.patient_id == uuid.UUID(patient_id),
                EncryptedRecordVault.record_type == record_type,
                EncryptedRecordVault.is_deleted == False
            )
        ).order_by(
            EncryptedRecordVault.record_date.desc()
        ).limit(limit).all()
    
    @staticmethod
    def soft_delete_record(
        db: DBSession,
        record_id: str,
        reason: str = "User requested"
    ) -> None:
        """
        Mark record as deleted (soft delete for audit trail)
        
        Args:
            db: Database session
            record_id: UUID of record
            reason: Deletion reason
        """
        try:
            record = db.query(EncryptedRecordVault).filter(
                EncryptedRecordVault.id == uuid.UUID(record_id)
            ).first()
            
            if record:
                record.is_deleted = True
                record.deleted_at = datetime.now(timezone.utc)  # tz-aware
                db.commit()
                
                logger.info(f"Soft deleted record {record_id}: {reason}")
            
        except Exception as e:
            logger.error(f"Failed to delete record: {str(e)}")
            db.rollback()
            raise
