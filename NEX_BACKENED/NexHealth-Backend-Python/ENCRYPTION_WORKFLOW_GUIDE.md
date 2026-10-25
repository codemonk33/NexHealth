# Bionex Encryption Workflow Guide

> **Audience:** Frontend developers, Backend developers, QA engineers  
> **System:** Bionex — End-to-End Encrypted Medical Record Platform  
> **Base URL:** `http://localhost:8000` (dev) / `https://api.bionex.io` (prod)  
> **Auth:** All endpoints (unless noted) require `Authorization: Bearer <access_token>`

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Frontend Developer Guide](#2-frontend-developer-guide)
   - 2.1 [Prerequisites and Setup](#21-prerequisites-and-setup)
   - 2.2 [Step-by-Step: Patient Document Upload and Encryption](#22-step-by-step-patient-document-upload-and-encryption)
   - 2.3 [Step-by-Step: Doctor Accessing Encrypted Records](#23-step-by-step-doctor-accessing-encrypted-records)
   - 2.4 [Session Management (Patient Side)](#24-session-management-patient-side)
   - 2.5 [Error Handling Reference](#25-error-handling-reference)
3. [Backend Developer Guide](#3-backend-developer-guide)
   - 3.1 [API Sequence Flow — Full Backend Workflow](#31-api-sequence-flow--full-backend-workflow)
   - 3.2 [Service Layer Internals](#32-service-layer-internals)
   - 3.3 [Data Models and Storage Strategy](#33-data-models-and-storage-strategy)
4. [Backend API Testing Checklist](#4-backend-api-testing-checklist)
   - 4.1 [Health and Connectivity Tests](#41-health-and-connectivity-tests)
   - 4.2 [Keypair API Tests](#42-keypair-api-tests)
   - 4.3 [Session Key API Tests](#43-session-key-api-tests)
   - 4.4 [Document Upload API Tests](#44-document-upload-api-tests)
   - 4.5 [Encrypted Session Key Retrieval Tests](#45-encrypted-session-key-retrieval-tests)
   - 4.6 [Audit Log API Tests](#46-audit-log-api-tests)
   - 4.7 [Negative and Security Tests](#47-negative-and-security-tests)
5. [Crypto Reference](#5-crypto-reference)

---

## 1. System Architecture Overview

```
+-------------------------------------------------------------------------+
|                         BIONEX ENCRYPTION STACK                         |
|                                                                          |
|  +------------+    +--------------------------------------------------+  |
|  |  Patient   |    |              FastAPI Backend                     |  |
|  |  App       +---->  /api/v1/documents  (upload, list, download)    |  |
|  | (Frontend) |    |  /api/v1/encryption (keypairs, sessions, audit) |  |
|  +------------+    +------+-------------------+----------------+-----+  |
|                           |                   |                |         |
|  +------------+    +------v------+  +--------v------+  +------v------+  |
|  |  Doctor    |    | PostgreSQL  |  |  HashiCorp    |  |    Redis    |  |
|  |  App       |    | (Public     |  |  Vault        |  |  (Cache:   |  |
|  | (Frontend) |    |  Keys,      |  |  (Private     |  |   Public   |  |
|  +------------+    |  Sessions,  |  |   Keys Only)  |  |   Keys,    |  |
|                    |  Records,   |  |               |  |  Sessions) |  |
|                    |  Audit)     |  +---------------+  +------------+  |
|                    +-------------+                                       |
|                                                                          |
|  CRYPTO STACK: ECDH P-256 key exchange + ChaCha20-Poly1305 AEAD        |
+-------------------------------------------------------------------------+
```

### Key Principles

| Principle | Implementation |
|-----------|---------------|
| **Zero-knowledge storage** | Private keys NEVER in DB — only in HashiCorp Vault |
| **Forward secrecy** | ECDH ephemeral key per session creation |
| **AEAD encryption** | ChaCha20-Poly1305 for all record encryption |
| **Immutable audit** | ECDSA-signed audit logs for all crypto operations |
| **Cache-aside** | Redis for public keys and session hashes (99% hit rate) |
| **Soft deletes** | Records marked deleted, never removed (audit trail) |

---

## 2. Frontend Developer Guide

### 2.1 Prerequisites and Setup

#### What the frontend needs before any encryption operations:

1. **User must be authenticated** — obtain `access_token` via `POST /api/v1/auth/login`
2. **Every user must have a keypair generated once** (patient AND doctor both need keypairs)
3. **Doctor must generate their keypair BEFORE a patient can grant them access**

#### Auth Flow (Standard — not encryption-specific)

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "+91XXXXXXXXXX",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

Store the token. All subsequent requests use `Authorization: Bearer <access_token>`.

---

### 2.2 Step-by-Step: Patient Document Upload and Encryption

> **Goal:** Patient uploads a medical document (PDF, image, etc.) and it gets stored in the encrypted vault.

---

#### PHASE 1: One-Time Setup — Generate Patient Keypair

> **WARNING:** Do this ONCE per user account. Calling again returns HTTP 409 Conflict.

**Step 1: Check if keypair already exists**

```http
GET /api/v1/encryption/keypairs/me
Authorization: Bearer <patient_access_token>
```

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440000",
  "public_key_fingerprint": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "key_algorithm": "ECDH_P256",
  "created_at": "2026-08-04T06:00:00Z",
  "is_revoked": false
}
```

**If you get 404 — keypair not found — generate one:**

**Step 2: Generate keypair**

```http
POST /api/v1/encryption/keypairs/generate
Authorization: Bearer <patient_access_token>
```

No request body needed. The backend:
1. Generates an ECDH P-256 keypair
2. Stores the **private key** securely in HashiCorp Vault at path `users/{user_id}/private_key`
3. Stores the **public key** and fingerprint in PostgreSQL
4. Caches the public key in Redis for fast lookups

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440000",
  "public_key_fingerprint": "a1b2c3d4e5f6...",
  "key_algorithm": "ECDH_P256",
  "created_at": "2026-08-04T06:00:00Z",
  "is_revoked": false
}
```

> **Frontend Note:** Store the `id` (keypair ID) locally if needed for UI display. The `public_key_fingerprint` can be shown to users for verification purposes (like WhatsApp's security number).

---

#### PHASE 2: Upload Document (File Storage)

> This uploads the document to the backend file system. The raw file is stored to disk at this stage.

**Step 3: Upload the document file**

```http
POST /api/v1/documents
Authorization: Bearer <patient_access_token>
Content-Type: multipart/form-data

file: <binary file data>
title: "Blood Test Report August 2026"
description: "Annual checkup blood panel"
category: "lab_report"
```

**Allowed file types:** `.pdf`, `.jpg`, `.jpeg`, `.png`, `.heic`, `.heif`, `.webp`, `.tiff`, `.doc`, `.docx`, `.txt`, `.csv`

**Max file size:** Configured in `.env` as `MAX_UPLOAD_SIZE_BYTES`

**Response (201):**
```json
{
  "id": "doc-uuid-here",
  "title": "Blood Test Report August 2026",
  "original_filename": "blood_test.pdf",
  "content_type": "application/pdf",
  "size_bytes": 245678,
  "category": "lab_report",
  "created_at": "2026-08-04T06:10:00Z"
}
```

Save `document_id = response.id` for reference.

---

#### PHASE 3: Grant Doctor Access via Encrypted Session Key

> The patient grants a specific doctor access by creating an encrypted "session key". The session key is a 32-byte random key encrypted using the doctor's ECDH public key via ChaCha20-Poly1305.

**Step 4: Create a session key (patient grants doctor access)**

```http
POST /api/v1/encryption/sessions?doctor_id=<doctor_user_uuid>&ttl_days=30
Authorization: Bearer <patient_access_token>
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `doctor_id` | UUID string | YES | — | The doctor's User ID to grant access |
| `ttl_days` | integer (1-90) | NO | 7 | How many days the access lasts |

**Backend Flow (what happens internally):**
1. Fetches doctor's ECDH public key from Redis (or DB fallback)
2. Generates a cryptographically random 32-byte session key
3. Computes SHA-256 hash of session key for storage/lookup
4. Encrypts session key using ECDH + ChaCha20-Poly1305 with an ephemeral sender key
5. Stores encrypted blob (ciphertext, nonce, auth_tag, ephemeral_public_key) in DB
6. Caches session_key_hash in Redis with TTL matching expiry

**Response (200):**
```json
{
  "id": "session-key-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "session_key_hash": "sha256-hash-of-session-key-64-hex-chars",
  "status": "ACTIVE",
  "expires_at": "2026-09-03T06:10:00Z",
  "created_at": "2026-08-04T06:10:00Z"
}
```

Save `session_id = response.id` — the doctor will use this ID to retrieve and decrypt the session key.

---

#### PHASE 4: Share a Document via Share Token (Mobile / External App Upload)

> For mobile share extensions (e.g., WhatsApp, Gmail) where a full JWT is not available in the sandboxed extension process.

**Step 5a: Create a share token (from authenticated app session)**

```http
POST /api/v1/documents/share-token
Authorization: Bearer <patient_access_token>
```

**Response:**
```json
{
  "token": "random-urlsafe-token-string-64-chars",
  "expires_at": "2026-08-04T06:40:00Z"
}
```

**Step 5b: Pass token to share extension, upload without JWT**

```http
POST /api/v1/documents/share-upload
Content-Type: multipart/form-data

files: <binary file 1>
files: <binary file 2>
share_token: "token-from-step-5a"
category: "prescription"
source_app: "whatsapp"
```

**Response (201):**
```json
{
  "uploaded": [
    {"id": "doc1-uuid", "title": "prescription", "size_bytes": 12345, ...},
    {"id": "doc2-uuid", "title": "blood_report", "size_bytes": 98765, ...}
  ],
  "total_files": 2
}
```

> **Note:** Share tokens are single-use (marked `is_used = true` after first upload) and have a short expiry (configured via `SHARE_TOKEN_EXPIRE_MINUTES`).

---

### 2.3 Step-by-Step: Doctor Accessing Encrypted Records

> **Goal:** Doctor retrieves the encrypted session key, decrypts it, and uses it to access patient records.

---

#### PHASE 1: Doctor Keypair Setup (One-Time, Same as Patient)

```http
POST /api/v1/encryption/keypairs/generate
Authorization: Bearer <doctor_access_token>
```

> **CRITICAL:** The doctor MUST generate their keypair **before** the patient can create a session key for them. If a patient tries to create a session for a keyless doctor, the request will fail.

---

#### PHASE 2: Doctor Lists Their Active Patient Sessions

```http
GET /api/v1/encryption/sessions/as-doctor
Authorization: Bearer <doctor_access_token>
```

**Response:**
```json
[
  {
    "id": "session-uuid-1",
    "patient_id": "patient-uuid-abc",
    "session_key_hash": "abc123...",
    "status": "ACTIVE",
    "expires_at": "2026-09-03T06:10:00Z",
    "created_at": "2026-08-04T06:10:00Z"
  }
]
```

---

#### PHASE 3A: Client-Side Decryption (PREFERRED — Zero Knowledge)

> The server returns the encrypted blob. The doctor's private key **never leaves Vault** in this flow. The client performs ECDH decryption in-browser or in the mobile app.

**Step 1: Get encrypted session key payload**

```http
GET /api/v1/encryption/sessions/{session_id}/encrypted-key
Authorization: Bearer <doctor_access_token>
```

**Response:**
```json
{
  "session_id": "session-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "encrypted_key": "base64-encoded-ciphertext",
  "nonce": "base64-encoded-12-byte-nonce",
  "auth_tag": "base64-encoded-16-byte-auth-tag",
  "ephemeral_public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "session_key_hash": "sha256-hex-string",
  "expires_at": "2026-09-03T06:10:00Z"
}
```

**Step 2: Client decryption pseudocode**

```javascript
// Implement using WebCrypto API (browser) or native crypto SDK (mobile)
async function decryptSessionKey(payload, doctorPrivateKeyPem) {

  // Step 1: Import doctor's ECDH private key
  const privateKey = await importECDHPrivateKey(doctorPrivateKeyPem, 'P-256');

  // Step 2: Import ephemeral public key from server payload
  const ephemeralPublicKey = await importECDHPublicKey(payload.ephemeral_public_key, 'P-256');

  // Step 3: ECDH key agreement
  // shared_secret = ECDH(doctor_private_key, ephemeral_public_key)
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    privateKey,
    256
  );

  // Step 4: HKDF-SHA256 key derivation
  const symmetricKey = await hkdf(sharedSecret, {
    hash: 'SHA-256',
    info: new TextEncoder().encode('encryption_key'),
    length: 32  // 256 bits
  });

  // Step 5: Reconstruct AAD — MUST match server-side exactly
  const aad = new TextEncoder().encode(`${payload.patient_id}:${payload.doctor_id}`);

  // Step 6: ChaCha20-Poly1305 decryption
  const ciphertext = base64Decode(payload.encrypted_key);
  const nonce = base64Decode(payload.nonce);        // 12 bytes
  const authTag = base64Decode(payload.auth_tag);   // 16 bytes

  // ciphertext + authTag concatenated, then decrypted with AAD
  const sessionKey = await chacha20poly1305Decrypt(
    symmetricKey, nonce, concatenate(ciphertext, authTag), aad
  );

  return sessionKey; // 32 raw bytes = 256-bit session key
}
```

---

#### PHASE 3B: Server-Assisted Decryption (Fallback — Requires Vault)

> Use ONLY when client-side decryption is not possible. Doctor's private key is retrieved from Vault server-side. The plaintext session key is transmitted over TLS. This is less secure than Phase 3A but acceptable when the client cannot do ECDH.

```http
POST /api/v1/encryption/sessions/{session_id}/decrypt
Authorization: Bearer <doctor_access_token>
```

**Response:**
```json
{
  "session_id": "session-uuid",
  "session_key_hex": "64-hex-chars-representing-32-byte-key",
  "patient_id": "patient-uuid",
  "expires_at": "2026-09-03T06:10:00Z"
}
```

The `session_key_hex` is the hex-encoded 32-byte symmetric key that can be used directly with ChaCha20-Poly1305 to decrypt patient medical records.

---

### 2.4 Session Management (Patient Side)

#### List all active sessions (see who has access to your records)

```http
GET /api/v1/encryption/sessions
Authorization: Bearer <patient_access_token>
```

#### Revoke a specific doctor's access immediately

```http
DELETE /api/v1/encryption/sessions/{session_id}
Authorization: Bearer <patient_access_token>
```

**Response:**
```json
{
  "message": "Session revoked successfully"
}
```

> **Effect:** Immediate — Redis cache is invalidated, doctor loses access in < 1ms.

#### Revoke your own keypair

```http
DELETE /api/v1/encryption/keypairs/me
Authorization: Bearer <patient_access_token>
```

> **WARNING:** This marks your keypair as revoked and invalidates Redis cache. ALL sessions using your keypair become inaccessible. Use only when explicitly intended.

---

### 2.5 Error Handling Reference

| HTTP Status | When it Happens | What to Show the User |
|-------------|-----------------|----------------------|
| `401 Unauthorized` | Token expired or missing | Redirect to login |
| `403 Forbidden` | Wrong role (doctor calling patient-only endpoint) | "Access denied" |
| `404 Not Found` | Keypair not generated yet / Session not found | Prompt to generate keypair or check session ID |
| `409 Conflict` | Keypair already exists for this user | Show existing keypair fingerprint |
| `413 Payload Too Large` | File exceeds max upload size | "File too large, maximum is X MB" |
| `415 Unsupported Media Type` | Invalid file extension or content type | List accepted file types |
| `422 Unprocessable Entity` | Legacy session without ECDH encryption | "Ask the patient to revoke and re-grant access" |
| `503 Service Unavailable` | HashiCorp Vault is down or sealed | "Encryption service temporarily unavailable, try again later" |
| `500 Internal Server Error` | Unexpected server-side failure | Generic error message, offer retry |

---

## 3. Backend Developer Guide

### 3.1 API Sequence Flow — Full Backend Workflow

#### Sequence A: New User Keypair Generation

```
Client               FastAPI Router           KeypairService       Vault            PostgreSQL      Redis
  |                       |                        |                 |                   |              |
  |--POST /keypairs/gen-->|                        |                 |                   |              |
  |                       |--check existing------->|                 |                   |              |
  |                       |                        |--query keypair--------------------->|              |
  |                       |                        |<-- None (no keypair) ---------------|              |
  |                       |                        |                 |                   |              |
  |                       |                        |--generate ECDH P-256 keypair        |              |
  |                       |                        |  (private_pem, public_pem)          |              |
  |                       |                        |--store private key-->|              |              |
  |                       |                        |  path: users/{id}/   |              |              |
  |                       |                        |  private_key         |              |              |
  |                       |                        |<-- stored OK --------|              |              |
  |                       |                        |--INSERT UserKeypair---------------->|              |
  |                       |                        |  (public_key_pem, fingerprint)      |              |
  |                       |                        |<-- keypair object ------------------|              |
  |                       |                        |--cache public key------------------------------------->|
  |                       |                        |  key: pubkey:{user_id}              |              |
  |                       |--log KEYPAIR_GENERATED->|                 |                   |              |
  |                       |  (CryptoAuditLog)       |                 |                   |              |
  |<-- UserKeypairResponse|                        |                 |                   |              |
```

---

#### Sequence B: Patient Creates Session Key for Doctor

```
Patient Client         FastAPI Router       SessionKeyService    KeypairService     PostgreSQL       Redis
     |                      |                      |                  |                  |               |
     |--POST /sessions?----->|                      |                  |                  |               |
     |  doctor_id=&ttl_days= |                      |                  |                  |               |
     |                       |--verify patient------>|                  |                  |               |
     |                       |  (query Patient table)|                  |                  |               |
     |                       |                      |--get_public_key-->|                  |               |
     |                       |                      |   (doctor_id)     |--check Redis cache-------------->|
     |                       |                      |                   |  (cache miss)    |               |
     |                       |                      |                   |--query keypair-->|               |
     |                       |                      |                   |<-- public_key ---|               |
     |                       |                      |                   |--cache in Redis----------------->|
     |                       |                      |<-- public_key_pem-|                  |               |
     |                       |                      |                  |                  |               |
     |                       |                      |--generate 32-byte random session_key               |
     |                       |                      |--SHA-256 hash session_key -> session_key_hash       |
     |                       |                      |--ECDH encrypt session_key with doctor public key    |
     |                       |                      |  (ephemeral sender key + ChaCha20-Poly1305)         |
     |                       |                      |--INSERT SessionKey--------------->|               |
     |                       |                      |  (encrypted_key, nonce, auth_tag, |               |
     |                       |                      |   ephemeral_public_key, expires)  |               |
     |                       |                      |<-- session_key object ------------|               |
     |                       |                      |--cache session_key_hash------------------------------>|
     |                       |--log SESSION_CREATED->|                  |                  |               |
     |<-- SessionKeyResponse-|                      |                  |                  |               |
     |  (id, hash, expires)  |                      |                  |                  |               |
```

---

#### Sequence C: Doctor Retrieves Encrypted Session Key Payload

```
Doctor Client          FastAPI Router         PostgreSQL          Redis           CryptoAuditService
     |                      |                     |                |                     |
     |--GET /sessions/{id}-->|                     |                |                     |
     |  /encrypted-key       |                     |                |                     |
     |                       |--query SessionKey-->|                |                     |
     |                       |  WHERE id=session_id|                |                     |
     |                       |  AND doctor_id=user |                |                     |
     |                       |  AND status=ACTIVE  |                |                     |
     |                       |  AND expires > NOW()|                |                     |
     |                       |<-- session row ------|                |                     |
     |                       |                     |                |                     |
     |                       |--log SESSION_KEY_RETRIEVED------------------------------------>|
     |                       |                     |                |                     |
     |<--EncryptedSessionKey-|                     |                |                     |
     |  Payload (encrypted   |                     |                |                     |
     |  key, nonce, auth_tag,|                     |                |                     |
     |  ephemeral_pub_key)   |                     |                |                     |
```

---

#### Sequence D: Server-Assisted Session Key Decryption

```
Doctor Client          FastAPI Router       HashiCorp Vault     KeyExchangeManager    CryptoAuditService
     |                      |                     |                    |                      |
     |--POST /sessions/{id}->|                     |                    |                      |
     |  /decrypt             |                     |                    |                      |
     |                       |--query SessionKey (active, owned by doctor)                     |
     |                       |--retrieve private key->|                 |                      |
     |                       |  path: users/{doc}/    |                 |                      |
     |                       |  private_key           |                 |                      |
     |                       |<-- private_key_pem -----|                 |                      |
     |                       |                     |                    |                      |
     |                       |--decrypt_with_private_key--------------->|                      |
     |                       |  (ECDH + ChaCha20-Poly1305 decryption)   |                      |
     |                       |<-- plaintext session key (32 bytes) ------|                      |
     |                       |                     |                    |                      |
     |                       |--log SESSION_KEY_DECRYPTED (server_assisted)-------------------->|
     |<--DecryptSessionKey---|                     |                    |                      |
     |  Response             |                     |                    |                      |
     |  (session_key_hex,    |                     |                    |                      |
     |   session_id,         |                     |                    |                      |
     |   patient_id,         |                     |                    |                      |
     |   expires_at)         |                     |                    |                      |
```

---

#### Sequence E: Session Validation (Cache-Aside Pattern — Used Internally)

```
Any Backend Service        Redis Cache                PostgreSQL
        |                       |                          |
        |--validate_session     |                          |
        |  (hash, doctor_id)    |                          |
        |--GET session hash---->|                          |
        |                       |--- HIT: return True      |
        |                       |--- MISS: query DB------->|
        |                       |           WHERE hash=?   |
        |                       |           AND doc_id=?   |
        |                       |           AND ACTIVE     |
        |                       |           AND not expired|
        |                       |<-- session row ----------|
        |                       |--SET hash (remaining TTL)|
        |<-- True / False -------|                          |
```

---

### 3.2 Service Layer Internals

#### Cryptographic Stack

| Operation | Algorithm | Key Size | Standard |
|-----------|-----------|----------|----------|
| Key generation | ECDH P-256 | 256-bit | NIST FIPS 186-4 |
| Key exchange | ECDH + HKDF-SHA256 | 256-bit shared | RFC 5869 |
| Session key encryption | ChaCha20-Poly1305 | 256-bit | RFC 8439 |
| Record encryption | ChaCha20-Poly1305 | 256-bit | RFC 8439 |
| Key fingerprint | SHA-256 | 256-bit | NIST FIPS 180-4 |
| Session key hash | SHA-256 | 256-bit | NIST FIPS 180-4 |
| Audit log signing | ECDSA P-256 | 256-bit | NIST FIPS 186-4 |

#### Service Classes

| Class | File | Responsibility |
|-------|------|---------------|
| `KeypairService` | `app/services/crypto_operations.py` | ECDH keypair CRUD, Vault integration |
| `SessionKeyService` | `app/services/crypto_operations.py` | Session key lifecycle, validation |
| `EncryptedRecordService` | `app/services/crypto_operations.py` | ChaCha20 encrypt/decrypt records |
| `AuditLogService` | `app/services/encryption_service.py` | ECDSA-signed immutable audit trail |
| `CryptoAuditService` | `app/services/crypto_audit_service.py` | Compliance report generation |
| `KeyExchangeManager` | `app/services/key_exchange.py` | ECDH + ChaCha20 crypto primitives |
| `CryptoManager` | `app/security/crypto.py` | Low-level crypto primitives |
| `VaultManager` | `app/security/vault.py` | HashiCorp Vault client (hvac) |
| `CacheManager` | `app/security/cache.py` | Redis cache operations |

#### Performance Targets

| Operation | Target Latency | Source |
|-----------|---------------|--------|
| Session validation | < 1ms | Redis cache (99% hit rate) |
| Public key lookup | < 1ms | Redis cache (99% hit rate) |
| Session creation | < 50ms | DB + Vault round-trip |
| Record encryption | < 2ms/MB | In-memory ChaCha20 |
| Record decryption | < 2ms/MB | In-memory ChaCha20 |

---

### 3.3 Data Models and Storage Strategy

#### Database Tables

```sql
-- user_keypairs: One ECDH P-256 public key per user
-- Private keys are NEVER stored here — only in Vault
user_keypairs:
  id                      UUID PRIMARY KEY
  user_id                 UUID FK(users.id) UNIQUE    -- one keypair per user
  public_key_pem          TEXT NOT NULL               -- PEM format public key
  public_key_fingerprint  VARCHAR(64) UNIQUE           -- SHA-256 hex of public key
  key_algorithm           VARCHAR(50) DEFAULT 'ECDH_P256'
  is_revoked              BOOLEAN DEFAULT false INDEX
  revoked_at              TIMESTAMPTZ NULL
  revocation_reason       VARCHAR(255) NULL
  created_at              TIMESTAMPTZ DEFAULT NOW()
  -- Vault path for private key: secret/data/bionex/users/{user_id}/private_key

-- session_keys: Ephemeral doctor-patient encrypted access bridge
session_keys:
  id                      UUID PRIMARY KEY
  patient_id              UUID FK(patients.id) INDEX
  doctor_id               UUID FK(users.id) INDEX
  session_key_hash        VARCHAR(64) UNIQUE INDEX    -- SHA-256 of plaintext key
  encrypted_session_key   TEXT NOT NULL               -- ChaCha20-Poly1305 ciphertext
  nonce                   VARCHAR(64)                 -- 12 bytes base64
  auth_tag                VARCHAR(64)                 -- 16 bytes Poly1305 tag base64
  ephemeral_public_key    TEXT                        -- ECDH ephemeral public key PEM
  status                  ENUM('ACTIVE','ROTATED','REVOKED','EXPIRED') INDEX
  expires_at              TIMESTAMPTZ INDEX
  creation_reason         TEXT NULL
  revoked_at              TIMESTAMPTZ NULL
  revocation_reason       VARCHAR(255) NULL
  created_at              TIMESTAMPTZ DEFAULT NOW()

-- encrypted_record_vault: ChaCha20-encrypted copies of medical records
encrypted_record_vault:
  id                      UUID PRIMARY KEY
  patient_id              UUID FK(patients.id) INDEX
  ciphertext              BYTEA NOT NULL              -- ChaCha20-Poly1305 ciphertext
  nonce                   BYTEA NOT NULL              -- 12-byte random nonce
  auth_tag                BYTEA NOT NULL              -- 16-byte Poly1305 auth tag
  record_type             VARCHAR(50) INDEX            -- PRESCRIPTION, LAB_REPORT etc
  record_date             TIMESTAMPTZ
  record_title            VARCHAR(255) NULL            -- plaintext (searchable)
  record_title_hash       VARCHAR(64) NULL             -- SHA-256 for blind search
  encryption_algorithm    VARCHAR(50) DEFAULT 'CHACHA20_POLY1305'
  is_deleted              BOOLEAN DEFAULT false        -- soft delete
  deleted_at              TIMESTAMPTZ NULL
  created_at              TIMESTAMPTZ DEFAULT NOW()

-- cryptographic_audit_log: Immutable ECDSA-signed audit trail
cryptographic_audit_log:
  id                      UUID PRIMARY KEY
  actor_id                UUID NULL                   -- NULL for SYSTEM actions
  actor_type              ENUM('PATIENT','DOCTOR','ADMIN','SYSTEM')
  action                  VARCHAR(100) INDEX           -- KEYPAIR_GENERATED, etc.
  resource_type           VARCHAR(100) INDEX           -- USER_KEYPAIR, SESSION_KEY, etc.
  resource_id             UUID
  event_data              JSONB                        -- operation-specific details
  signature               TEXT NOT NULL               -- ECDSA-SHA256 digital signature
  signature_timestamp     TIMESTAMPTZ
  ip_address              VARCHAR(45)
  request_id              VARCHAR(100)
  status                  ENUM('SUCCESS','FAILED','DENIED') INDEX
  status_message          TEXT NULL                   -- error details if FAILED
  created_at              TIMESTAMPTZ DEFAULT NOW()
```

#### Redis Key Patterns

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `pubkey:{user_id}` | PEM public key string | 24 hours (86400s) |
| `session:{session_key_hash}` | doctor_id string | Remaining session TTL |
| `pubkey:fingerprint:{user_id}` | Fingerprint hex string | 24 hours (86400s) |

#### HashiCorp Vault Secret Paths

| Vault Path | Content | Who Accesses |
|------------|---------|-------------|
| `secret/data/bionex/users/{user_id}/private_key` | ECDH P-256 private key PEM | Server only — during session decryption |
| `secret/data/bionex/server/audit_signing_key` | ECDSA audit signing key PEM | Server only — on every audit log write |

---

## 4. Backend API Testing Checklist

> **Prerequisites:**
> - PostgreSQL, Redis, and HashiCorp Vault must all be running
> - Register a test patient account and a test doctor account
> - Obtain their respective JWT tokens via `POST /api/v1/auth/login`

---

### 4.1 Health and Connectivity Tests

#### Test HC-1: Global Health Check

```http
GET /health
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

**Confirms:** FastAPI server is running and responding.

---

#### Test HC-2: Encryption Service Health Check

```http
GET /api/v1/encryption/health
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "service": "encryption-api",
  "timestamp": "2026-08-04T06:00:00.000000"
}
```

**Confirms:** Encryption router is mounted, DB connection is reachable.

---

### 4.2 Keypair API Tests

#### Test KP-1: Generate Patient Keypair (Success)

```http
POST /api/v1/encryption/keypairs/generate
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
{
  "id": "<uuid>",
  "user_id": "<patient_user_id_uuid>",
  "public_key_fingerprint": "<exactly 64 hex characters>",
  "key_algorithm": "ECDH_P256",
  "created_at": "<ISO 8601 timestamp>",
  "is_revoked": false
}
```

**Assertions to check:**
- `public_key_fingerprint` length == 64 (SHA-256 hex)
- `key_algorithm` == `"ECDH_P256"`
- `is_revoked` == `false`
- HTTP status == 200
- Verify private key was stored in Vault at `secret/data/bionex/users/{user_id}/private_key`
- Verify audit log entry `KEYPAIR_GENERATED` was created in DB

---

#### Test KP-2: Generate Doctor Keypair (Success)

```http
POST /api/v1/encryption/keypairs/generate
Authorization: Bearer <doctor_token>
```

**Expected Response:** Same structure as KP-1 with doctor's `user_id`.

**Confirms:** Doctor can generate keypair (this is required before any patient can grant them access).

---

#### Test KP-3: Duplicate Keypair Generation (Conflict)

> Run this with the same patient token that already has a keypair from KP-1.

```http
POST /api/v1/encryption/keypairs/generate
Authorization: Bearer <patient_token>
```

**Expected Response (409):**
```json
{
  "detail": "User already has active keypair: <keypair_id>"
}
```

**Confirms:** Duplicate prevention is working. Only one active keypair per user is allowed.

---

#### Test KP-4: Get Current User Keypair (Success)

```http
GET /api/v1/encryption/keypairs/me
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
{
  "id": "<same uuid as KP-1>",
  "user_id": "<patient_user_id>",
  "public_key_fingerprint": "<same fingerprint>",
  "key_algorithm": "ECDH_P256",
  "created_at": "<timestamp>",
  "is_revoked": false
}
```

**Confirms:** Public key retrieval works, Redis caching is operating correctly.

---

#### Test KP-5: Get Keypair — Not Found (404)

> Use a brand new user account that has NOT generated a keypair yet.

```http
GET /api/v1/encryption/keypairs/me
Authorization: Bearer <new_user_token>
```

**Expected Response (404):**
```json
{
  "detail": "Keypair not found. Generate one with POST /keypairs/generate"
}
```

**Confirms:** Correct 404 is returned when keypair doesn't exist.

---

#### Test KP-6: Revoke Keypair (Success)

```http
DELETE /api/v1/encryption/keypairs/me
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
{
  "message": "Keypair revoked successfully"
}
```

**Confirms:** Keypair is marked as `is_revoked = true` in DB, Redis cache is cleared.

**Post-condition verification:** Call `GET /api/v1/encryption/keypairs/me` — should now return 404.

---

#### Test KP-7: Unauthenticated Request (401)

```http
POST /api/v1/encryption/keypairs/generate
(No Authorization header)
```

**Expected Response (401):**
```json
{
  "detail": "Not authenticated"
}
```

**Confirms:** JWT auth guard is working on all encryption endpoints.

---

### 4.3 Session Key API Tests

> **Prerequisite:** Both patient and doctor MUST have active keypairs (run KP-1 and KP-2 first, ensuring the keypairs were not revoked).

---

#### Test SK-1: Create Session Key (Patient Grants Doctor Access)

```http
POST /api/v1/encryption/sessions?doctor_id=<doctor_user_uuid>&ttl_days=7
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
{
  "id": "<session-uuid>",
  "patient_id": "<patient-uuid>",
  "doctor_id": "<doctor-uuid>",
  "session_key_hash": "<exactly 64 hex characters>",
  "status": "ACTIVE",
  "expires_at": "<approximately 7 days from now in ISO format>",
  "created_at": "<now in ISO format>"
}
```

**Assertions to check:**
- `session_key_hash` length == 64
- `status` == `"ACTIVE"`
- `expires_at` is approximately 7 days in the future
- `doctor_id` matches the UUID you provided in the query param
- Verify `encrypted_session_key`, `nonce`, `auth_tag`, `ephemeral_public_key` all saved in DB (check via DB query)
- Verify session hash is cached in Redis: `GET session:{session_key_hash}`
- Verify audit log entry `SESSION_CREATED` was written

---

#### Test SK-2: Create Session — Doctor Has No Keypair (Error)

> Use a doctor account that has NOT generated a keypair yet.

```http
POST /api/v1/encryption/sessions?doctor_id=<doctor_without_keypair_user_id>
Authorization: Bearer <patient_token>
```

**Expected Response (500):**
```json
{
  "detail": "Failed to create session"
}
```

Internal error: `ValueError: Doctor has no active keypair — they must generate one first`

**Confirms:** Guard against creating session for keyless doctor.

---

#### Test SK-3: Create Session — Caller is a Doctor (403)

> Call as a doctor account trying to create a session (only patients can do this).

```http
POST /api/v1/encryption/sessions?doctor_id=<some_uuid>
Authorization: Bearer <doctor_token>
```

**Expected Response (403):**
```json
{
  "detail": "Only patients can create session keys"
}
```

**Confirms:** Role-based access control is enforced for session creation.

---

#### Test SK-4: List Sessions as Patient

```http
GET /api/v1/encryption/sessions
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
[
  {
    "id": "<session-uuid>",
    "patient_id": "<patient-uuid>",
    "doctor_id": "<doctor-uuid>",
    "session_key_hash": "<64-char hex>",
    "status": "ACTIVE",
    "expires_at": "<timestamp>",
    "created_at": "<timestamp>"
  }
]
```

**Confirms:** Patient can see all active sessions they've created.

---

#### Test SK-5: List Sessions as Doctor

```http
GET /api/v1/encryption/sessions/as-doctor
Authorization: Bearer <doctor_token>
```

**Expected Response (200):**
```json
[
  {
    "id": "<session-uuid>",
    "patient_id": "<patient-uuid>",
    "session_key_hash": "<64-char hex>",
    "status": "ACTIVE",
    "expires_at": "<timestamp>",
    "created_at": "<timestamp>"
  }
]
```

**Confirms:** Doctor can see all patients who have granted them access.

---

#### Test SK-6: Revoke Session Key

```http
DELETE /api/v1/encryption/sessions/<session_id>
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
{
  "message": "Session revoked successfully"
}
```

**Confirms:** Session status updated to `REVOKED` in DB, Redis cache invalidated.

**Post-condition:** Verify `GET /api/v1/encryption/sessions` no longer shows this session.

---

#### Test SK-7: Revoke Session — Wrong Patient (403)

> Patient A tries to revoke a session that belongs to Patient B.

```http
DELETE /api/v1/encryption/sessions/<patient_b_session_id>
Authorization: Bearer <patient_a_token>
```

**Expected Response (403):**
```json
{
  "detail": "Not authorized to revoke this session"
}
```

**Confirms:** Ownership check prevents unauthorized session revocation.

---

### 4.4 Document Upload API Tests

#### Test DOC-1: Upload Document (Success)

```http
POST /api/v1/documents
Authorization: Bearer <patient_token>
Content-Type: multipart/form-data

file: <test_blood_report.pdf>
title: "Test Blood Report"
description: "For API testing"
category: "lab_report"
```

**Expected Response (201):**
```json
{
  "id": "<doc-uuid>",
  "title": "Test Blood Report",
  "original_filename": "test_blood_report.pdf",
  "content_type": "application/pdf",
  "size_bytes": 12345,
  "category": "lab_report",
  "source_app": "direct_upload",
  "created_at": "<timestamp>"
}
```

**Confirms:** File is stored on disk, DB record created, audit log written.

---

#### Test DOC-2: Upload Disallowed File Type (415)

```http
POST /api/v1/documents
Authorization: Bearer <patient_token>
Content-Type: multipart/form-data

file: <malicious.exe>
title: "Test"
```

**Expected Response (415):**
```json
{
  "detail": "File type '.exe' is not allowed. Accepted: .csv, .doc, .docx, .heic, .heif, .jpeg, .jpg, .pdf, .png, .tif, .tiff, .txt, .webp"
}
```

**Confirms:** File extension whitelist validation is enforced.

---

#### Test DOC-3: Upload Empty File (400)

```http
POST /api/v1/documents
Authorization: Bearer <patient_token>
Content-Type: multipart/form-data

file: <0-byte file>
title: "Empty Test"
```

**Expected Response (400):**
```json
{
  "detail": "Uploaded file is empty"
}
```

**Confirms:** Empty file rejection is working.

---

#### Test DOC-4: Share Token Upload Flow

**Step 4a — Create share token (authenticated):**

```http
POST /api/v1/documents/share-token
Authorization: Bearer <patient_token>
```

**Expected Response (201):**
```json
{
  "token": "<urlsafe-64-char-random-string>",
  "expires_at": "<short expiry timestamp>"
}
```

**Step 4b — Upload using share token (no JWT needed):**

```http
POST /api/v1/documents/share-upload
Content-Type: multipart/form-data

files: <test.pdf>
share_token: "<token from 4a>"
category: "prescription"
source_app: "whatsapp"
```

**Expected Response (201):**
```json
{
  "uploaded": [
    {"id": "<uuid>", "title": "test", "size_bytes": 12345, ...}
  ],
  "total_files": 1
}
```

**Confirms:** Share token flow works correctly for mobile extension upload.

---

### 4.5 Encrypted Session Key Retrieval Tests

#### Test ESK-1: Get Encrypted Session Key Payload (Doctor)

```http
GET /api/v1/encryption/sessions/<session_id>/encrypted-key
Authorization: Bearer <doctor_token>
```

**Expected Response (200):**
```json
{
  "session_id": "<session-uuid>",
  "patient_id": "<patient-uuid>",
  "doctor_id": "<doctor-uuid>",
  "encrypted_key": "<non-empty base64 string>",
  "nonce": "<non-empty base64 string, 12 bytes when decoded>",
  "auth_tag": "<non-empty base64 string, 16 bytes when decoded>",
  "ephemeral_public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "session_key_hash": "<64-char hex string>",
  "expires_at": "<future ISO timestamp>"
}
```

**Assertions to check:**
- `ephemeral_public_key` starts with `-----BEGIN PUBLIC KEY-----`
- `nonce` decodes to 12 bytes
- `auth_tag` decodes to 16 bytes
- `encrypted_key` is non-empty base64
- `session_key_hash` is 64 hex chars
- Verify audit log `SESSION_KEY_RETRIEVED` was written with `actor_type: DOCTOR`

---

#### Test ESK-2: Get Encrypted Key — Wrong Doctor (404)

> Doctor B tries to get the encrypted session key that was created for Doctor A.

```http
GET /api/v1/encryption/sessions/<doctor_a_session_id>/encrypted-key
Authorization: Bearer <doctor_b_token>
```

**Expected Response (404):**
```json
{
  "detail": "Session not found or not active. It may have expired or been revoked."
}
```

**Confirms:** Session ownership is strictly enforced. Doctors can only access their own sessions.

---

#### Test ESK-3: Server-Assisted Session Key Decryption

```http
POST /api/v1/encryption/sessions/<session_id>/decrypt
Authorization: Bearer <doctor_token>
```

**Expected Response (200) — when Vault is configured and doctor's private key is stored:**
```json
{
  "session_id": "<session-uuid>",
  "session_key_hex": "<exactly 64 hex characters = 32 bytes>",
  "patient_id": "<patient-uuid>",
  "expires_at": "<future ISO timestamp>"
}
```

**Expected Response (503) — when Vault is NOT configured or doctor's key is not in Vault:**
```json
{
  "detail": "Doctor's private key not found in Vault. Ensure Vault is configured and the key was stored during keypair generation."
}
```

**Assertions (when Vault is working):**
- `session_key_hex` length == 64 (32 bytes hex encoded)
- Verify audit log `SESSION_KEY_DECRYPTED` was written with `event_data.method == "server_assisted"`
- Verify a FAILED audit log is written if decryption fails

---

### 4.6 Audit Log API Tests

#### Test AL-1: Query All Audit Logs

```http
GET /api/v1/encryption/audit/logs
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
[
  {
    "id": "<uuid>",
    "actor_id": "<user-uuid>",
    "actor_type": "PATIENT",
    "action": "KEYPAIR_GENERATED",
    "resource_type": "USER_KEYPAIR",
    "resource_id": "<keypair-uuid>",
    "status": "SUCCESS",
    "ip_address": "127.0.0.1",
    "created_at": "<ISO timestamp>",
    "event_data": {"algorithm": "ECDH_P256"}
  }
]
```

**Confirms:** Audit logs are being written for all crypto operations.

---

#### Test AL-2: Filter Audit Logs by Action

```http
GET /api/v1/encryption/audit/logs?action=KEYPAIR_GENERATED&limit=10
Authorization: Bearer <patient_token>
```

**Expected Response (200):** Array where every entry has `"action": "KEYPAIR_GENERATED"`.

**Confirms:** Action filter works correctly.

---

#### Test AL-3: Filter Audit Logs by Status

```http
GET /api/v1/encryption/audit/logs?status=SUCCESS&limit=50
Authorization: Bearer <patient_token>
```

**Expected Response (200):** Array where every entry has `"status": "SUCCESS"`.

---

#### Test AL-4: Invalid Status Filter (400)

```http
GET /api/v1/encryption/audit/logs?status=INVALID_STATUS
Authorization: Bearer <patient_token>
```

**Expected Response (400):**
```json
{
  "detail": "Invalid status: INVALID_STATUS"
}
```

**Confirms:** Status enum validation is enforced before DB query.

---

#### Test AL-5: Compliance Report Generation

```http
GET /api/v1/encryption/audit/compliance-report?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z
Authorization: Bearer <patient_token>
```

**Expected Response (200):**
```json
{
  "total_actions": 25,
  "success_count": 24,
  "failed_count": 1,
  "actions_by_type": {
    "KEYPAIR_GENERATED": 2,
    "SESSION_CREATED": 3,
    "SESSION_KEY_RETRIEVED": 5
  },
  "access_by_actor_type": {
    "PATIENT": 10,
    "DOCTOR": 14,
    "SYSTEM": 1
  }
}
```

**Confirms:** Compliance report is generated correctly from audit logs.

---

### 4.7 Negative and Security Tests

#### Test NEG-1: Expired Session Cannot Be Retrieved

> Manually expire a session in DB (`expires_at = NOW() - interval '1 minute'`), then try to fetch its encrypted key.

```http
GET /api/v1/encryption/sessions/<expired_session_id>/encrypted-key
Authorization: Bearer <doctor_token>
```

**Expected Response (404):**
```json
{
  "detail": "Session not found or not active. It may have expired or been revoked."
}
```

**Confirms:** Expiry check (`expires_at > NOW()`) is enforced on every retrieval.

---

#### Test NEG-2: Revoked Session Cannot Be Used

> Revoke a session, then try to get its encrypted key.

**Step 1:** `DELETE /api/v1/encryption/sessions/<session_id>` (as patient)  
**Step 2:** `GET /api/v1/encryption/sessions/<session_id>/encrypted-key` (as doctor)

**Expected Response (404):** Session not found or not active.

**Confirms:** Revocation is immediate and enforced.

---

#### Test NEG-3: CSRF Protection (Cross-Origin Mutation Blocked)

```http
POST /api/v1/encryption/keypairs/generate
Authorization: Bearer <token>
Origin: https://evil-site.com
X-Forwarded-For: 1.2.3.4
```

**Expected:** 403 response from CSRF middleware for cross-origin mutating requests from non-whitelisted origins.

**Confirms:** CSRFProtectionMiddleware is active.

---

#### Test NEG-4: Rate Limiting

> Rapidly fire > configured rate limit requests to any endpoint in a short window.

**Expected Response (429):**
```json
{
  "error": "Rate limit exceeded"
}
```

**Confirms:** `slowapi` rate limiting middleware is active and enforced.

---

#### Test NEG-5: Audit Log Signature Presence

After running any crypto operation (keypair generation, session creation, etc.), query the audit log and verify every entry has a non-null, non-empty `signature` field.

```sql
SELECT id, action, signature FROM cryptographic_audit_log 
WHERE signature IS NULL OR signature = '';
-- Expected: 0 rows (all entries have ECDSA signatures)
```

**Confirms:** Every audit log entry is digitally signed with ECDSA-SHA256 for tamper detection.

---

## 5. Crypto Reference

### ECDH + ChaCha20-Poly1305 Session Key Encryption

```
SESSION KEY ENCRYPTION (Server creates for doctor):

1. Generate ephemeral ECDH P-256 keypair
   (sender_private_key, sender_ephemeral_public_key) = generate_keypair()

2. ECDH key agreement
   shared_secret = ECDH(sender_private_key, doctor_public_key)

3. HKDF-SHA256 key derivation
   symmetric_key = HKDF-SHA256(
     ikm=shared_secret,
     salt=None,
     info=b'encryption_key',
     length=32
   )

4. Generate random nonce
   nonce = random_bytes(12)

5. Set Associated Data (binds ciphertext to specific patient-doctor pair)
   aad = f"{patient_id}:{doctor_id}".encode()

6. ChaCha20-Poly1305 AEAD encryption
   (ciphertext, auth_tag) = ChaCha20-Poly1305.encrypt(
     key=symmetric_key,
     nonce=nonce,
     plaintext=session_key_bytes,  # 32 random bytes
     aad=aad
   )

7. Store in DB:
   encrypted_session_key = ciphertext
   nonce = nonce
   auth_tag = auth_tag
   ephemeral_public_key = sender_ephemeral_public_key (PEM)
```

```
SESSION KEY DECRYPTION (Client or Server):

1. Load doctor's private key
   doctor_private_key = Vault.retrieve("users/{doctor_id}/private_key")
   OR load from device secure storage

2. ECDH key agreement
   shared_secret = ECDH(doctor_private_key, ephemeral_public_key)

3. HKDF-SHA256 key derivation (same params as encryption)
   symmetric_key = HKDF-SHA256(
     ikm=shared_secret,
     salt=None,
     info=b'encryption_key',
     length=32
   )

4. Reconstruct AAD (must match exactly)
   aad = f"{patient_id}:{doctor_id}".encode()

5. ChaCha20-Poly1305 AEAD decryption
   session_key_bytes = ChaCha20-Poly1305.decrypt(
     key=symmetric_key,
     nonce=nonce,
     ciphertext=encrypted_session_key + auth_tag,
     aad=aad
   )
   # If auth_tag doesn't match, decryption raises an exception (tamper detected)
```

---

### Medical Record Encryption

```
RECORD ENCRYPTION:

1. plaintext = file bytes OR JSON-encoded record data
2. session_key = 32-byte symmetric key (from session key creation)
3. nonce = random_bytes(12)
4. aad = f"{patient_id}:{record_type}".encode()

5. ChaCha20-Poly1305.encrypt(session_key, nonce, plaintext, aad)
   -> (ciphertext, auth_tag)

6. Stored in encrypted_record_vault:
   ciphertext, nonce, auth_tag
   record_type, record_title (plaintext searchable)
   record_title_hash (SHA-256 for blind search)
```

---

### Audit Log Action Reference

| Action | Resource Type | Triggered By | When |
|--------|--------------|-------------|------|
| `KEYPAIR_GENERATED` | `USER_KEYPAIR` | Patient / Doctor | New keypair created |
| `KEYPAIR_REVOKED` | `USER_KEYPAIR` | Patient / Doctor | Keypair revoked |
| `SESSION_CREATED` | `SESSION_KEY` | Patient | Doctor granted access |
| `SESSION_REVOKED` | `SESSION_KEY` | Patient | Doctor access removed |
| `SESSION_KEY_RETRIEVED` | `SESSION_KEY` | Doctor | Encrypted key payload fetched |
| `SESSION_KEY_DECRYPTED` | `SESSION_KEY` | Doctor | Server-assisted decryption used |
| `RECORD_ACCESSED` | `ENCRYPTED_RECORD` | Doctor | Encrypted record read |
| `RECORD_UPLOADED` | `ENCRYPTED_RECORD` | Patient | New encrypted record stored |

---

### Record Type Reference

| Value | Use Case |
|-------|----------|
| `PRESCRIPTION` | Doctor prescriptions |
| `LAB_REPORT` | Lab test results |
| `IMAGING` | X-ray, MRI, CT scans |
| `DISCHARGE_SUMMARY` | Hospital discharge papers |
| `CONSULTATION_NOTE` | Doctor consultation notes |
| `VACCINATION` | Vaccination records |
| `OTHER` | Miscellaneous medical documents |

---

> **Document Status:** Living document — update when APIs change  
> **Last Updated:** 2026-08-04  
> **Maintained by:** Bionex Engineering Team
