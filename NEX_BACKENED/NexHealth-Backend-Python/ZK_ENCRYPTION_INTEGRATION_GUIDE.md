# BioNex Zero-Knowledge E2E Encryption - Integration Guide

> **Architecture:** Client-generated ECDH P-256 keypairs + HKDF-SHA256 + ChaCha20-Poly1305
> **Status:** Frontend COMPLETE | Backend UPDATED (this commit)
> **Last updated:** October 2026

---

## Table of Contents

1. [The Core Security Model](#1-the-core-security-model)
2. [Frontend - What Was Built](#2-frontend--what-was-built)
3. [Backend - What Was Changed](#3-backend--what-was-changed)
4. [Complete API Contract](#4-complete-api-contract)
5. [Cryptographic Protocol Specification](#5-cryptographic-protocol-specification)
6. [End-to-End Flow Walkthrough](#6-end-to-end-flow-walkthrough)
7. [Error Code Reference](#7-error-code-reference)
8. [Integration Checklist](#8-integration-checklist)
9. [Database Migration Notes](#9-database-migration-notes)
10. [Security Audit Notes](#10-security-audit-notes)

---

## 1. The Core Security Model

### Before (Broken - Server Had Private Keys)

```
Client -> POST /keypairs/generate
           Server generates ECDH keypair
           Private key -> HashiCorp Vault   <- SERVER CAN DECRYPT EVERYTHING
           Public key  -> PostgreSQL
```

**Problem:** BioNex held private keys. Zero-knowledge claim was false.

### After (Fixed - True Zero-Knowledge)

```
Client   generateECDHKeyPair() [on device]
           Private key -> SecureStore (Keychain/Keystore)  <- NEVER LEAVES DEVICE
           Public key PEM + ECDSA signature
             -> POST /keypairs/register
                 Server validates PEM, verifies signature, stores public key ONLY
```

**Zero-knowledge guarantee:** The server cannot decrypt anything. It only stores the public key.

---

## 2. Frontend - What Was Built

### Files

| File | Status | Description |
|------|--------|-------------|
| `src/utils/cryptoEngine.ts` | COMPLETE | ECDH keygen, ECDSA PoP signing, HKDF, ChaCha20-Poly1305 decrypt |
| `src/utils/keyStorage.ts` | COMPLETE | SecureStore wrapper (WHEN_UNLOCKED_THIS_DEVICE_ONLY) |
| `src/api/keysApi.ts` | COMPLETE | All encryption API calls |
| `src/store/cryptoStore.ts` | COMPLETE | Keypair lifecycle (Zustand), 4-case state machine |
| `src/hooks/useDecryptSessionKey.ts` | COMPLETE | On-device session key decryption hook |

### 4-Case State Machine (cryptoStore.ts)

| Local Key | Server Keypair | Action |
|-----------|----------------|--------|
| Exists    | Active         | Validate fingerprints match -> READY |
| Missing   | Active         | Keys diverged -> revoke server + re-generate |
| Exists    | Missing/Revoked| Previous registration failed -> retry |
| Missing   | Missing        | Fresh install -> generate + register |

### Key Security Properties (cryptoEngine.ts)
- Key generation via `crypto.subtle.generateKey` (OS CSPRNG)
- Private key exported as JWK for SecureStore; re-imported as non-extractable
- Proof-of-possession: ECDSA-SHA-256 over nonce bytes (P1363 format: r||s, 64 bytes)
- Memory safety: intermediate secrets zeroed in `finally` blocks
- Error sanitization: stable `CryptoError` codes, no raw crypto errors leak

### Packages Already Installed

```
@noble/curves    ^2.4.0   - ECDH P-256 key operations
@noble/hashes    ^2.4.0   - HKDF-SHA256
@noble/ciphers   ^2.4.0   - ChaCha20-Poly1305
expo-secure-store ~57.0.4 - iOS Keychain / Android Keystore
```

---

## 3. Backend - What Was Changed

### Summary of Changes

| Component | Change | Reason |
|-----------|--------|--------|
| `routers/encryption.py` | Full rewrite | Remove /generate, add /register + challenge endpoint, deprecate /decrypt |
| `services/crypto_operations.py` | Updated | register_keypair() replaces generate_keypair(), fixed revoke_keypair() |
| `services/key_exchange.py` | Bug fix | get_public_key_fingerprint() now hashes DER bytes (not PEM text) |
| `models/encryption_models.py` | Updated | Removed unique=True on user_keypairs.user_id |
| `schemas/encryption_schemas.py` | Updated | Added RegistrationChallengeResponse, RegisterKeypairRequest |

### New: GET /keypairs/registration-challenge
- Issues a 64-char hex nonce (32 random bytes from `secrets.token_bytes`)
- Stored in Redis with 60-second TTL keyed to `reg_nonce:{user_id}`
- Overrides previous unused nonce (no stale nonces)
- Requires authentication

### New: POST /keypairs/register
Server validation sequence (ALL must pass):
1. `public_key_pem` parses as ECDH P-256 SPKI key
2. `display_fingerprint == SHA-256(DER bytes)` (constant-time via hmac.compare_digest)
3. Redis nonce exists and matches `body.nonce`
4. `nonce_signature` verifies under `public_key_pem` with ECDSA-SHA-256
5. No active keypair already exists for this user

**No Vault write. Only PostgreSQL + Redis.**

### Deprecated: POST /sessions/{id}/decrypt
Returns HTTP 410 Gone:
```json
{
  "code": "ENDPOINT_DEPRECATED",
  "message": "Server-assisted decryption not supported in zero-knowledge model.",
  "migration_guide": "GET /api/v1/encryption/sessions/{id}/encrypted-key"
}
```

### Fixed: Fingerprint Computation Bug
```python
# WRONG - produces different value than frontend
fingerprint.update(public_key_pem.encode())  # hashes PEM text including headers

# CORRECT - matches frontend crypto.subtle.digest('SHA-256', spkiDer)
der_bytes = public_key.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
hashlib.sha256(der_bytes).hexdigest()
```

### Fixed: revoke_keypair() Bugs
- Now sets `revoked_at = datetime.now(timezone.utc)` (was missing)
- Filters to active keypairs only (was querying all rows)
- Gracefully returns if no active keypair (idempotent)

### Fixed: UserKeypair Model
- Removed `unique=True` on `user_id` column
- Users can now have multiple rows (old revoked + one active)
- Uniqueness enforced at application layer in `register_keypair()`
- **Database migration required** - see Section 9

---

## 4. Complete API Contract

Base URL: `https://<host>/api/v1/encryption`

### GET /keypairs/registration-challenge

Auth: Bearer token required

```json
Response 200:
{
  "nonce": "a3f8c2d1...b9e1f347",
  "expires_in": 60,
  "issued_at": "2026-10-19T07:00:00Z"
}
Errors: 503 (Redis unavailable)
```

### POST /keypairs/register

```json
Request:
{
  "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMFkwEwYH...\n-----END PUBLIC KEY-----",
  "display_fingerprint": "a3f8c2d1e5b9f4c6d8e2a1b3c5d7e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7",
  "nonce": "b9e1f3a2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8",
  "nonce_signature": "MEUCIQDp...base64url...YDGA"
}

Response 201:
{
  "id": "uuid",
  "user_id": "uuid",
  "public_key_fingerprint": "a3f8c2d1...(64 hex chars)",
  "key_algorithm": "ECDH_P256",
  "created_at": "2026-10-19T07:00:00Z",
  "is_revoked": false
}

Errors:
  409 KEYPAIR_ALREADY_EXISTS  - revoke first with DELETE /keypairs/me
  422 INVALID_PUBLIC_KEY      - PEM malformed or not ECDH P-256
  422 FINGERPRINT_MISMATCH    - display_fingerprint mismatch
  422 NONCE_EXPIRED           - nonce TTL elapsed or not found
  422 NONCE_MISMATCH          - nonce value mismatch
  422 INVALID_SIGNATURE       - ECDSA PoP verification failed
```

### GET /keypairs/me
Returns metadata only (no PEM, no private key).
- 404 `NO_ACTIVE_KEYPAIR` if not registered

### DELETE /keypairs/me
Marks `is_revoked=True`, `revoked_at=now()`.
Client MUST delete private key from SecureStore after 200 OK.

### GET /sessions/{id}/encrypted-key (PRIMARY ZK ENDPOINT)

```json
Response 200:
{
  "session_id": "uuid",
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "encrypted_key": "base64(ciphertext_without_tag)",
  "nonce": "base64(12_bytes)",
  "auth_tag": "base64(16_bytes)",
  "ephemeral_public_key": "-----BEGIN PUBLIC KEY-----\n...",
  "session_key_hash": "sha256_hex_of_plaintext_session_key",
  "expires_at": "2026-11-19T07:00:00Z"
}
Errors:
  403 NOT_SESSION_DOCTOR  - caller is not the doctor for this session
  404 SESSION_NOT_FOUND   - session UUID not found
  410 SESSION_EXPIRED     - session expired/revoked
  422 LEGACY_SESSION      - no ephemeral_public_key (pre-ECDH session)
```

### POST /sessions/{id}/decrypt
PERMANENTLY DISABLED. Returns 410 Gone.

---

## 5. Cryptographic Protocol Specification

### Matching Parameters (MUST match exactly on both sides)

| Parameter | Value |
|-----------|-------|
| Curve | P-256 (SECP256R1 / NIST FIPS 186-4) |
| HKDF hash | SHA-256 |
| HKDF salt | None (empty) |
| HKDF info | `b'encryption_key'` (9 UTF-8 bytes) |
| HKDF length | 32 bytes |
| Cipher | ChaCha20-Poly1305 (RFC 8439) |
| Nonce size | 12 bytes |
| Auth tag size | 16 bytes |
| AAD | `f"{patient_id}:{doctor_id}".encode('utf-8')` |
| Fingerprint input | SPKI DER bytes (NOT PEM text) |
| PoP nonce encoding | UTF-8 bytes of hex string |
| PoP signature format | IEEE P1363 (r||s, 64 bytes for P-256) |

### Session Key Encryption (Server-Side)
```
session_key    = random(32)                      // CSPRNG
ephemeral      = ECDH-P256.generate()            // fresh per session
shared_secret  = ECDH(ephemeral_private, doctor_public_key)
symmetric_key  = HKDF-SHA256(shared_secret, salt=None, info=b'encryption_key', length=32)
aad            = f"{patient_id}:{doctor_id}".encode('utf-8')
ciphertext||tag = ChaCha20Poly1305.encrypt(symmetric_key, nonce, session_key, aad)
stored: encrypted_session_key, nonce, auth_tag, ephemeral_public_key, session_key_hash
```

### Session Key Decryption (Client-Side)
```
private_key    = import(privateKeyJWK, ECDH-P256, non-extractable)
ephemeral_pub  = import(ephemeral_public_key PEM, ECDH-P256)
shared_secret  = ECDH(private_key, ephemeral_pub)
symmetric_key  = HKDF-SHA256(shared_secret, salt=None, info=b'encryption_key', length=32)
aad            = f"{patient_id}:{doctor_id}".encode('utf-8')
session_key    = ChaCha20Poly1305.decrypt(symmetric_key, nonce, ciphertext||auth_tag, aad)
assert SHA-256(session_key).hex() == session_key_hash  // integrity verification
// Zero all intermediate secrets immediately
```

---

## 6. End-to-End Flow Walkthrough

### First Login (Key Registration)
```
1.  App opens -> cryptoStore.initializeKeys()
2.  GET /keypairs/me -> 404 (no keypair yet)
3.  hasPrivateKey() -> false (SecureStore empty) -> Case D: generate + register
4.  cryptoEngine.generateKeyPair() -> publicKeyPEM, privateKeyJWK, fingerprint (in memory)
5.  GET /keypairs/registration-challenge -> { nonce, expires_in }
6.  signRegistrationNonce(nonce, privateKeyJWK) -> nonce_signature (ECDSA P1363)
7.  keyStorage.savePrivateKey(privateKeyJWK, fingerprint) -> SecureStore  <- CRASH-SAFE POINT
8.  POST /keypairs/register { public_key_pem, display_fingerprint, nonce, nonce_signature }
    -> 201 { id, public_key_fingerprint, ... }
9.  keyStorage.markKeyRegistered()
10. cryptoStore.status = 'ready'
```

### Doctor Decrypts Session Key (On-Device)
```
1. Doctor calls useDecryptSessionKey.decryptSessionKey(sessionId)
2. GET /sessions/{id}/encrypted-key -> encrypted blob
3. getPrivateKey() from SecureStore -> privateKeyJWK
4. cryptoEngine.decryptSessionKey(payload, privateKeyJWK) -> session_key (in memory)
5. assert SHA-256(session_key).hex() == session_key_hash
6. Use session_key to decrypt patient records
7. eraseSessionKey() -> zero bytes in memory
```

### Logout
```
1. keyStorage.deleteAllKeys() -> SecureStore wipe
2. authStore.logout() -> clear tokens from AsyncStorage
3. cryptoStore.clearKeys() -> reset state to 'idle'
```

---

## 7. Error Code Reference

### Frontend (CryptoError codes)
| Code | Trigger |
|------|---------|
| `KEY_GENERATION_FAILED` | crypto.subtle.generateKey failed |
| `KEY_EXPORT_FAILED` | crypto.subtle.exportKey failed |
| `KEY_VALIDATION_FAILED` | Generated key failed re-import sanity check |
| `FINGERPRINT_FAILED` | SHA-256 fingerprint computation failed |
| `INVALID_PRIVATE_KEY` | JWK malformed or not P-256 |
| `NONCE_SIGN_FAILED` | ECDSA signing failed |
| `INVALID_EPHEMERAL_KEY` | Server PEM malformed |
| `INVALID_PAYLOAD` | Base64 fields corrupt or wrong size |
| `DECRYPTION_FAILED` | ECDH or ChaCha20 auth-tag mismatch |
| `INTEGRITY_CHECK_FAILED` | SHA-256(decrypted) != session_key_hash |

### Backend (HTTP error codes)
| Code | HTTP | Trigger |
|------|------|---------|
| `KEYPAIR_ALREADY_EXISTS` | 409 | Active keypair exists |
| `INVALID_PUBLIC_KEY` | 422 | PEM not ECDH P-256 SPKI |
| `FINGERPRINT_MISMATCH` | 422 | Fingerprint mismatch |
| `NONCE_EXPIRED` | 422 | Redis TTL elapsed |
| `NONCE_MISMATCH` | 422 | Nonce value mismatch |
| `INVALID_SIGNATURE` | 422 | ECDSA PoP failed |
| `NO_ACTIVE_KEYPAIR` | 404 | No non-revoked keypair |
| `NOT_SESSION_PARTICIPANT` | 403 | Not patient or doctor for this session |
| `SESSION_NOT_FOUND` | 404 | Session UUID not found |
| `SESSION_EXPIRED` | 410 | Session expired/revoked |
| `LEGACY_SESSION` | 422 | No ephemeral_public_key (pre-ECDH) |
| `ENDPOINT_DEPRECATED` | 410 | Called POST /sessions/{id}/decrypt |

---

## 8. Integration Checklist

### Backend

#### Database
- [ ] Migration applied: `user_keypairs.user_id` unique constraint removed
- [ ] Migration applied: partial unique index `(user_id) WHERE is_revoked = FALSE` added
- [ ] Existing `user_keypairs` rows still valid after migration

#### Redis
- [ ] `reg_nonce:{user_id}` keys created with 60s TTL on challenge endpoint
- [ ] `reg_nonce:{user_id}` keys deleted on successful registration
- [ ] Public key PEM cached in Redis on `register_keypair()`
- [ ] Redis cache invalidated on `revoke_keypair()`

#### Vault
- [ ] `secret/data/bionex/users/{user_id}/private_key` NOT being created
- [ ] `secret/data/bionex/server/audit_signing_key` still exists
- [ ] No Vault reads in keypair register/revoke flows

#### Endpoints
- [ ] `GET /keypairs/registration-challenge` returns `{ nonce, expires_in, issued_at }`
- [ ] `GET /keypairs/registration-challenge` requires Bearer token
- [ ] `POST /keypairs/register` with valid payload returns 201
- [ ] `POST /keypairs/register` with duplicate keypair returns 409
- [ ] `POST /keypairs/register` with invalid PEM returns 422 INVALID_PUBLIC_KEY
- [ ] `POST /keypairs/register` with bad fingerprint returns 422 FINGERPRINT_MISMATCH
- [ ] `POST /keypairs/register` with expired nonce returns 422 NONCE_EXPIRED
- [ ] `POST /keypairs/register` with bad signature returns 422 INVALID_SIGNATURE
- [ ] `GET /keypairs/me` returns fingerprint (not PEM, not private key)
- [ ] `DELETE /keypairs/me` sets `is_revoked=True`, `revoked_at=now()`
- [ ] `POST /sessions/{id}/decrypt` returns 410 Gone
- [ ] `GET /sessions/{id}/encrypted-key` returns all 8 required fields

#### CRITICAL: Fingerprint Verification
- [ ] Fingerprint computed from DER bytes (NOT PEM text)
- [ ] Frontend-generated key fingerprint matches server-computed fingerprint

---

### Frontend

#### Packages
- [ ] @noble/curves installed (already in package.json)
- [ ] @noble/hashes installed (already in package.json)
- [ ] @noble/ciphers installed (already in package.json)
- [ ] expo-secure-store installed (already in package.json)

#### Key Generation Flow
- [ ] `generateKeyPair()` produces valid PEM and JWK
- [ ] Fingerprint = `SHA-256(SPKI DER bytes)` = 64 hex chars
- [ ] `savePrivateKey()` stores JWK BEFORE calling API
- [ ] `markKeyRegistered()` called AFTER 201 from server

#### Registration Challenge Flow
- [ ] `getRegistrationChallenge()` calls GET /keypairs/registration-challenge
- [ ] `signRegistrationNonce()` produces valid ECDSA P1363 signature
- [ ] `registerPublicKey()` calls POST /keypairs/register with all 4 fields
- [ ] Nonce fetched immediately before signing (minimize TTL window)

#### Crypto Store State Machine
- [ ] Case A (both exist): fingerprint match check -> READY
- [ ] Case B (local missing, server active): revoke + re-generate
- [ ] Case C (local exists, server missing): delete local + re-generate
- [ ] Case D (neither): generate + register
- [ ] `clearKeys()` wipes SecureStore on logout
- [ ] `retryInitialize()` recovers from ERROR state

#### Decryption Hook
- [ ] Validates `cryptoStatus === 'ready'` before decryption
- [ ] Loads private key from SecureStore (not React state)
- [ ] `eraseSessionKey()` called in `finally` after use
- [ ] Handles 403, 404, 410 from server
- [ ] Error codes sanitized (no raw crypto errors)

#### SecureStore Security
- [ ] `WHEN_UNLOCKED_THIS_DEVICE_ONLY` flag set
- [ ] Keys NOT backed up to iCloud or ADB
- [ ] `deleteAllKeys()` called on logout

---

### End-to-End Integration Test
- [ ] Register new user -> verify NO private key written to Vault
- [ ] Patient grants doctor access via POST /sessions
- [ ] Doctor calls GET /sessions/{id}/encrypted-key -> valid blob
- [ ] Doctor decrypts on-device -> session key matches session_key_hash
- [ ] Revoke keypair -> session keys still accessible (keypair != session)
- [ ] Revoke session -> GET /sessions/{id}/encrypted-key returns 410
- [ ] Logout -> SecureStore cleared, cryptoStatus = 'idle'

---

## 9. Database Migration Notes

```sql
-- Step 1: Drop old unique constraint
ALTER TABLE user_keypairs DROP CONSTRAINT IF EXISTS user_keypairs_user_id_key;

-- Step 2: Drop old unique index if exists
DROP INDEX IF EXISTS ix_user_keypairs_user_id;

-- Step 3: Recreate as non-unique index
CREATE INDEX IF NOT EXISTS ix_user_keypairs_user_id ON user_keypairs (user_id);

-- Step 4: Partial unique index for active keypairs only
CREATE UNIQUE INDEX IF NOT EXISTS ix_user_keypairs_user_active_unique
    ON user_keypairs (user_id)
    WHERE is_revoked = FALSE;

-- Verify
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'user_keypairs';
```

Alembic snippet:
```python
def upgrade() -> None:
    op.drop_constraint('user_keypairs_user_id_key', 'user_keypairs', type_='unique')
    op.execute("""
        CREATE UNIQUE INDEX ix_user_keypairs_user_active_unique
        ON user_keypairs (user_id)
        WHERE is_revoked = FALSE
    """)

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_keypairs_user_active_unique")
    op.create_unique_constraint('user_keypairs_user_id_key', 'user_keypairs', ['user_id'])
```

---

## 10. Security Audit Notes

### What the Server Can/Cannot See

| Data | Accessible to Server? |
|------|-----------------------|
| Private key | NEVER |
| Session key (plaintext) | NEVER |
| Decrypted medical records | NEVER |
| Public key PEM | Yes - PostgreSQL |
| Key fingerprint | Yes - PostgreSQL |
| Encrypted session key blob | Yes - PostgreSQL |
| Patient-doctor relationship | Yes - session_keys table |
| Access timestamps | Yes - audit log |

### Security Properties
- **Forward secrecy:** Fresh ephemeral ECDH keypair per session
- **AEAD authentication:** ChaCha20-Poly1305 tag prevents tampered blobs
- **AAD binding:** patient_id:doctor_id ties blob to specific parties
- **Integrity:** session_key_hash verified after decryption
- **Key rotation:** Revoke + re-register; old sessions become undecryptable
- **PoP:** ECDSA signature prevents key substitution at registration
- **Single-use nonces:** Redis TTL + atomic delete prevents replay
- **Constant-time:** hmac.compare_digest for fingerprint/nonce comparisons

### Known Limitations
1. **Key loss:** Device lost/wiped = cannot decrypt old sessions (security property, not a bug)
2. **Session metadata:** Server knows which patient-doctor pairs have sessions
3. **Network timing:** TLS required; this layer does not hide traffic patterns
