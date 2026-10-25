/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BioNex Keys & Sessions API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All encryption-related API calls in one place.
 *
 * Security contract:
 *   • Public keys are sent to the server only after challenge-response verification
 *   • Every registration is protected by ECDSA proof-of-possession (single-use nonce)
 *   • Private keys are NEVER transmitted — they live in device SecureStore only
 *   • Session key decryption happens on-device; server never sees the plaintext
 *
 * Base prefix: /api/v1/encryption
 *
 * Endpoints implemented:
 *   GET   /keypairs/registration-challenge — Get one-time nonce for proof-of-possession
 *   POST  /keypairs/register               — Register device-generated public key + PoP proof
 *   GET   /keypairs/me                     — Fetch current keypair metadata
 *   DELETE /keypairs/me                    — Revoke and remove keypair
 *   POST  /sessions                        — Patient grants doctor access
 *   GET   /sessions                        — List sessions (as patient)
 *   GET   /sessions/as-doctor              — List sessions (as doctor)
 *   GET   /sessions/{id}/encrypted-key     — Fetch encrypted session key blob
 *   DELETE /sessions/{id}                  — Revoke a session
 *   GET   /audit/logs                      — Fetch audit log entries
 *
 * @module keysApi
 */

import apiClient from './client';
import type {
  KeypairResponse,
  RegistrationChallenge,
  RegisterPublicKeyPayload,
  SessionKeyResponse,
  SessionListItem,
  CreateSessionPayload,
  EncryptedSessionKeyPayload,
  EncryptedPublicKeyBlob,
  AuditLogEntry,
  PaginatedResponse,
} from './types';
import { isValidEcdhPublicKeyPEM } from '../utils/cryptoEngine';

// ─── URL prefix ───────────────────────────────────────────────────────────────

const ENC = '/encryption';

// ─── Keypair Endpoints ────────────────────────────────────────────────────────

/**
 * Fetch a single-use registration challenge nonce from the server.
 *
 * Step 1 of the hardened two-step registration flow. The nonce:
 *   • Is generated server-side using a CSPRNG (32 bytes → 64 hex chars)
 *   • Is stored in Redis keyed to the authenticated user_id with a 60s TTL
 *   • Is consumed (deleted) atomically when POST /keypairs/register succeeds
 *   • Cannot be re-used: backend returns 422 NONCE_ALREADY_USED if sent twice
 *
 * Call this immediately before signing and registering to minimise the
 * window between challenge issuance and submission.
 *
 * @returns RegistrationChallenge
 *
 * @throws ApiError
 *   401 UNAUTHENTICATED  — no valid Bearer token
 *   429 RATE_LIMITED     — too many challenge requests in a short window
 */
export async function getRegistrationChallenge(): Promise<RegistrationChallenge> {
  const { data } = await apiClient.get<RegistrationChallenge>(
    `${ENC}/keypairs/registration-challenge`,
  );
  return data;
}

/**
 * Register a device-generated ECDH P-256 public key with hardened proof-of-possession.
 *
 * Step 2 of registration. The payload includes:
 *   • public_key_pem      — SPKI PEM of the device-generated key (NEVER private key)
 *   • display_fingerprint — SHA-256(DER) for UI display; backend stores a keyed HMAC
 *   • nonce               — single-use challenge from getRegistrationChallenge()
 *   • nonce_signature     — ECDSA-SHA-256(private_key, nonce_bytes) — proves ownership
 *
 * Backend MUST (see backend guide for full details):
 *   1. Consume and validate the nonce atomically (Redis lookup + delete)
 *   2. Verify ECDSA signature against submitted public_key_pem
 *   3. AES-256 encrypt the PEM before storing in PostgreSQL (pgp_sym_encrypt)
 *   4. Compute and store keyed HMAC commitment (not raw fingerprint) in DB
 *   5. Store opaque presence token in Redis (NOT the raw fingerprint)
 *   6. Write KEYPAIR_GENERATED audit entry
 *   7. Return KeypairResponse — NO Vault write for user key material
 *
 * @returns KeypairResponse — metadata only; no private key ever returned
 *
 * @throws ApiError
 *   409 KEYPAIR_ALREADY_EXISTS — active keypair exists; call DELETE /keypairs/me first
 *   422 INVALID_PUBLIC_KEY    — PEM malformed or not ECDH P-256
 *   422 INVALID_SIGNATURE     — ECDSA proof-of-possession failed verification
 *   422 NONCE_EXPIRED         — challenge nonce expired (>60s) or already consumed
 */
export async function registerPublicKey(
  payload: RegisterPublicKeyPayload,
): Promise<KeypairResponse> {
  const { data } = await apiClient.post<KeypairResponse>(
    `${ENC}/keypairs/register`,
    {
      public_key_pem:      payload.publicKeyPEM,
      display_fingerprint: payload.displayFingerprint,
      nonce:               payload.nonce,
      nonce_signature:     payload.nonceSignature,
    },
  );
  return data;
}


/**
 * Retrieve the current user's keypair metadata.
 *
 * Returns public key fingerprint and registration status.
 * Does NOT return the public key PEM itself (reducing exposure surface).
 * Returns null if no keypair is registered yet.
 *
 * @returns KeypairResponse | null
 * @throws ApiError — only on 5xx; 404 is normalised to null
 */
export async function getMyKeypair(): Promise<KeypairResponse | null> {
  try {
    const { data } = await apiClient.get<KeypairResponse>(`${ENC}/keypairs/me`);
    return data;
  } catch (err: unknown) {
    // 404 means no active keypair — not an error condition
    if (isApiError(err) && err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Revoke the current user's keypair.
 *
 * After this call:
 *   • Server marks keypair as revoked in PostgreSQL
 *   • Server removes fingerprint from Redis
 *   • All ACTIVE sessions created with this keypair become REVOKED
 *   • The private key MUST be deleted from SecureStore by the caller
 *
 * Audit event: KEYPAIR_REVOKED
 *
 * @throws ApiError
 *   404 NO_ACTIVE_KEYPAIR — no keypair to revoke
 */
export async function revokeMyKeypair(): Promise<void> {
  await apiClient.delete(`${ENC}/keypairs/me`);
}

/**
 * Fetch the encrypted public key for a doctor.
 *
 * Returns the encrypted PEM blob that must be decrypted on-device using
 * the patient's registration signature as the key derivation seed.
 *
 * @param doctorId - UUID of the doctor
 * @returns EncryptedPublicKeyBlob - encrypted JSON: {v, ct, n, a}
 *
 * @throws ApiError
 *   404 DOCTOR_NO_KEYPAIR — doctor has no registered public key
 */
export async function getEncryptedPublicKey(
  doctorId: string,
): Promise<EncryptedPublicKeyBlob> {
  if (!doctorId?.trim()) throw new Error('keysApi: doctorId is required');
  
  // Backend returns the encrypted JSON as a string that needs to be parsed
  const { data } = await apiClient.get<Record<string, unknown>>(
    `${ENC}/doctors/${encodeURIComponent(doctorId)}/public-key`,
  );
  
  return data as EncryptedPublicKeyBlob;
}

/**
 * Fetch and decrypt a doctor's public key for session establishment.
 *
 * This is a convenience wrapper that:
 *   1. Fetches the encrypted public key blob from the server
 *   2. Retrieves the patient's registration signature from SecureStore
 *   3. Decrypts the public key on-device using HKDF-SHA256 derivation
 *
 * The decrypted PEM can then be used for ECDH key agreement.
 *
 * @param doctorId - UUID of the doctor
 * @returns Decrypted public key PEM string
 *
 * @throws Error if decryption fails or signature is missing
 */
export async function fetchAndDecryptDoctorPublicKey(
  doctorId: string,
): Promise<string> {
  // Import here to avoid circular dependency
  const { getRegistrationSignature } = await import('../utils/keyStorage');
  const { decryptPublicKey } = await import('../utils/publicKeyDecryption');
  const { base64UrlToBytes } = await import('../utils/cryptoEngine');
  
  if (!doctorId?.trim()) throw new Error('keysApi: doctorId is required');

  // 1. Fetch encrypted blob from server
  const encryptedBlob = await getEncryptedPublicKey(doctorId);

  // 2. Get stored registration signature
  const signatureB64Url = await getRegistrationSignature();
  if (!signatureB64Url) {
    throw new Error('keysApi: no registration signature found in SecureStore - cannot decrypt public key');
  }

  // 3. Convert signature from base64url to bytes
  const signatureBytes = base64UrlToBytes(signatureB64Url);

  // 4. Decrypt the public key (doctor_id is used as salt internally)
  const publicKeyPEM = await decryptPublicKey(
    encryptedBlob,
    signatureBytes,
    doctorId,  // This is used as salt in HKDF
  );

  return publicKeyPEM;
}

/**
 * Validate an ECDH P-256 public key PEM.
 * Re-exported from cryptoEngine for convenience.
 *
 * @param pem - PEM-encoded public key
 * @returns true if valid, false otherwise
 */
export { isValidEcdhPublicKeyPEM };

// ─── Session Endpoints ────────────────────────────────────────────────────────

/**
 * Patient grants a doctor access by creating an encrypted session.
 *
 * Backend flow (all server-side):
 *   1. Generates 32-byte random session_key
 *   2. Fetches doctor's public key from PostgreSQL/Redis
 *   3. Generates ephemeral ECDH keypair
 *   4. ECDH(ephemeral_private, doctor_public) → shared_secret
 *   5. HKDF-SHA256(shared_secret, info='encryption_key') → symmetric_key
 *   6. ChaCha20-Poly1305.encrypt(symmetric_key, session_key, aad="{patient_id}:{doctor_id}")
 *   7. Stores encrypted blob + ephemeral public key in DB
 *   8. Returns session metadata (NOT the session key or ciphertext)
 *
 * @param doctorId  UUID of the doctor to grant access to
 * @param ttlDays   Session lifetime in days (1–90; enforced by backend)
 * @returns SessionKeyResponse — metadata only
 *
 * @throws ApiError
 *   404 DOCTOR_NO_KEYPAIR — target doctor has no registered public key
 *   409 SESSION_EXISTS     — an ACTIVE session already exists for this doctor
 *   422 INVALID_TTL        — ttlDays outside 1–90 range
 */
export async function createSession(
  doctorId: string,
  ttlDays: number,
): Promise<SessionKeyResponse> {
  if (!doctorId?.trim()) throw new Error('keysApi: doctorId is required');
  if (ttlDays < 1 || ttlDays > 90) {
    throw new Error('keysApi: ttlDays must be between 1 and 90');
  }

  const payload: CreateSessionPayload = { doctor_id: doctorId, ttl_days: ttlDays };
  const { data } = await apiClient.post<SessionKeyResponse>(`${ENC}/sessions`, payload);
  return data;
}

/**
 * List all sessions created by the authenticated patient.
 *
 * @param status  Optional filter: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
 * @returns Array of session list items (no ciphertext)
 */
export async function listSessions(
  status?: SessionListItem['status'],
): Promise<SessionListItem[]> {
  const params = status ? { status } : undefined;
  const { data } = await apiClient.get<SessionListItem[]>(`${ENC}/sessions`, { params });
  return data;
}

/**
 * List all sessions where the authenticated user is the doctor.
 * Used by doctors to see which patient records they have access to.
 *
 * @returns Array of session list items
 */
export async function listSessionsAsDoctor(): Promise<SessionListItem[]> {
  const { data } = await apiClient.get<SessionListItem[]>(`${ENC}/sessions/as-doctor`);
  return data;
}

/**
 * Fetch the encrypted session key blob for client-side decryption.
 *
 * This is the core of the zero-knowledge model: the server returns
 * the ciphertext and ECDH parameters; decryption happens entirely
 * on the doctor's device using their private key from SecureStore.
 *
 * The returned payload contains:
 *   • encrypted_key       — ChaCha20-Poly1305 ciphertext (base64)
 *   • nonce               — 12-byte nonce (base64)
 *   • auth_tag            — 16-byte Poly1305 tag (base64)
 *   • ephemeral_public_key — server's ephemeral ECDH public key (PEM)
 *   • session_key_hash    — SHA-256 of plaintext for integrity check
 *   • patient_id / doctor_id — used to reconstruct AAD for decryption
 *
 * @param sessionId  UUID of the session
 * @returns EncryptedSessionKeyPayload — pass directly to cryptoEngine.decryptSessionKey()
 *
 * @throws ApiError
 *   403 NOT_SESSION_DOCTOR — caller is not the doctor for this session
 *   404 SESSION_NOT_FOUND  — session does not exist
 *   410 SESSION_EXPIRED    — session has expired or been revoked
 */
export async function getEncryptedSessionKey(
  sessionId: string,
): Promise<EncryptedSessionKeyPayload> {
  if (!sessionId?.trim()) throw new Error('keysApi: sessionId is required');
  const { data } = await apiClient.get<EncryptedSessionKeyPayload>(
    `${ENC}/sessions/${encodeURIComponent(sessionId)}/encrypted-key`,
  );
  return data;
}

/**
 * Revoke a specific session (patient-initiated or doctor-initiated).
 *
 * After revocation:
 *   • Session status changes to REVOKED in PostgreSQL
 *   • Doctor can no longer fetch the encrypted key blob
 *   • Audit event: SESSION_REVOKED
 *
 * @param sessionId  UUID of the session to revoke
 * @throws ApiError
 *   403 NOT_SESSION_PARTICIPANT — caller is not patient or doctor for this session
 *   404 SESSION_NOT_FOUND
 */
export async function revokeSession(sessionId: string): Promise<void> {
  if (!sessionId?.trim()) throw new Error('keysApi: sessionId is required');
  await apiClient.delete(`${ENC}/sessions/${encodeURIComponent(sessionId)}`);
}

// ─── Audit Log Endpoint ───────────────────────────────────────────────────────

/**
 * Fetch paginated audit log entries for the authenticated user.
 *
 * Audit events include: KEYPAIR_GENERATED, KEYPAIR_REVOKED,
 * SESSION_CREATED, SESSION_KEY_ACCESSED, SESSION_REVOKED.
 *
 * @param page      1-indexed page number (default: 1)
 * @param pageSize  Items per page (default: 20, max: 100)
 * @returns Paginated audit entries
 */
export async function getAuditLogs(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await apiClient.get<PaginatedResponse<AuditLogEntry>>(
    `${ENC}/audit/logs`,
    { params: { page, page_size: pageSize } },
  );
  return data;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Type guard for ApiError shape */
function isApiError(err: unknown): err is { statusCode: number; code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as Record<string, unknown>).statusCode === 'number'
  );
}
