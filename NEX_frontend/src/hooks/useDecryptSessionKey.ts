/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BioNex — useDecryptSessionKey Hook
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * React hook for on-device decryption of an encrypted session key.
 *
 * Zero-knowledge guarantee: the plaintext session key NEVER leaves the device.
 * Decryption is performed entirely in JS memory using:
 *   ECDH P-256 → HKDF-SHA256 → ChaCha20-Poly1305
 *
 * Usage:
 * ─────
 *   const { decryptSessionKey, isDecrypting, error } = useDecryptSessionKey();
 *
 *   // Trigger decryption and receive the plaintext session key in memory
 *   const sessionKey = await decryptSessionKey(sessionId);
 *   if (sessionKey) {
 *     try {
 *       // Use sessionKey.sessionKeyHex to decrypt patient records
 *       await fetchPatientRecords(sessionId, sessionKey.sessionKeyHex);
 *     } finally {
 *       eraseSessionKey(sessionKey); // ← ALWAYS call to zero memory
 *     }
 *   }
 *
 * Security notes:
 *   • The hook validates that the crypto store is in the READY state
 *     before proceeding — preventing decryption when no local key exists.
 *   • The private key is loaded from SecureStore for each decryption operation
 *     and immediately discarded after use (not stored in React state).
 *   • Caller MUST call eraseSessionKey() after use to zero the key in memory.
 *   • Error messages are sanitised — raw crypto errors never leak to callers.
 *
 * @module useDecryptSessionKey
 */

import { useState, useCallback } from 'react';
import { useCryptoStore } from '../store/cryptoStore';
import { getEncryptedSessionKey } from '../api/keysApi';
import { decryptSessionKey as cryptoDecrypt, eraseSessionKey, CryptoError } from '../utils/cryptoEngine';
import type { DecryptedSessionKey } from '../utils/cryptoEngine';
import { getPrivateKey } from '../utils/keyStorage';

// ─── Hook Return Type ─────────────────────────────────────────────────────────

export interface UseDecryptSessionKeyResult {
  /**
   * Trigger decryption for a given session.
   *
   * Returns the decrypted session key on success, or null on failure.
   * Caller owns the memory: MUST call eraseSessionKey() when done.
   *
   * @param sessionId  UUID of the session (from GET /sessions)
   */
  decryptSessionKey: (sessionId: string) => Promise<DecryptedSessionKey | null>;

  /** True while any decryption operation is in progress */
  isDecrypting: boolean;

  /**
   * Human-readable error message from the last failed decryption.
   * Null if no error or after a successful decryption.
   */
  error: string | null;

  /**
   * Machine-readable error code from the last failure.
   * Stable identifiers for programmatic error handling:
   *   CRYPTO_NOT_READY      — Keys not initialized; call initializeKeys() first
   *   NO_LOCAL_PRIVATE_KEY  — SecureStore returned null; user may need to re-register
   *   NETWORK_ERROR         — Failed to fetch encrypted key blob from server
   *   INVALID_EPHEMERAL_KEY — Server returned a malformed ephemeral key
   *   INVALID_PAYLOAD       — Payload fields corrupt, wrong size, or missing
   *   DECRYPTION_FAILED     — ECDH or ChaCha20-Poly1305 failed (auth tag mismatch)
   *   INTEGRITY_CHECK_FAILED — session_key_hash mismatch (possible data tampering)
   *   UNKNOWN_ERROR         — Unexpected failure
   */
  errorCode: string | null;

  /** Clear the current error state */
  clearError: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDecryptSessionKey(): UseDecryptSessionKeyResult {
  const cryptoStatus = useCryptoStore((s) => s.status);

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const decryptSessionKey = useCallback(
    async (sessionId: string): Promise<DecryptedSessionKey | null> => {
      // ── Pre-flight checks ──────────────────────────────────────────────────
      if (!sessionId?.trim()) {
        setError('Session ID is required');
        setErrorCode('INVALID_SESSION_ID');
        return null;
      }

      if (cryptoStatus !== 'ready') {
        setError(
          'Encryption keys are not initialized. Please wait or re-open the app.',
        );
        setErrorCode('CRYPTO_NOT_READY');
        return null;
      }

      setIsDecrypting(true);
      setError(null);
      setErrorCode(null);

      try {
        // ── Step 1: Fetch encrypted session key blob from server ─────────────
        // This is safe: the blob is useless without the private key.
        let encryptedPayload;
        try {
          encryptedPayload = await getEncryptedSessionKey(sessionId);
        } catch (err: unknown) {
          const { message, code } = parseNetworkError(err);
          setError(message);
          setErrorCode(code);
          return null;
        }

        // ── Step 2: Load private key from device SecureStore ─────────────────
        // The private key never leaves the device.
        const privateKeyJWK = await getPrivateKey();
        if (!privateKeyJWK) {
          setError(
            'No private key found on this device. Please re-initialize your encryption keys.',
          );
          setErrorCode('NO_LOCAL_PRIVATE_KEY');
          return null;
        }

        // ── Step 3: On-device decryption ─────────────────────────────────────
        // ECDH → HKDF → ChaCha20-Poly1305 decrypt
        // Private key is loaded into a non-extractable CryptoKey inside this call
        // and cannot be re-exported. Intermediate secrets are zeroed in finally blocks.
        const decrypted = await cryptoDecrypt(encryptedPayload, privateKeyJWK);

        return decrypted;

      } catch (err: unknown) {
        const { message, code } = parseCryptoError(err);
        setError(message);
        setErrorCode(code);
        return null;
      } finally {
        setIsDecrypting(false);
      }
    },
    [cryptoStatus],
  );

  return {
    decryptSessionKey,
    isDecrypting,
    error,
    errorCode,
    clearError,
  };
}

// ─── Re-export for caller convenience ─────────────────────────────────────────

/**
 * Re-export eraseSessionKey so callers can import everything from one place:
 *
 *   import { useDecryptSessionKey, eraseSessionKey } from '@/hooks/useDecryptSessionKey';
 */
export { eraseSessionKey };
export type { DecryptedSessionKey };

// ─── Internal Error Parsers ───────────────────────────────────────────────────

/** Parse structured CryptoError from cryptoEngine */
function parseCryptoError(err: unknown): { message: string; code: string } {
  if (err instanceof CryptoError) {
    return { message: err.message, code: err.code };
  }
  if (err instanceof Error) {
    return { message: 'Decryption failed. Please try again.', code: 'UNKNOWN_ERROR' };
  }
  return { message: 'An unexpected error occurred during decryption.', code: 'UNKNOWN_ERROR' };
}

/** Parse network/API error from keysApi */
function parseNetworkError(err: unknown): { message: string; code: string } {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e.statusCode === 'number') {
      if (e.statusCode === 410) {
        return {
          message: 'This session has expired or been revoked.',
          code: 'SESSION_EXPIRED',
        };
      }
      if (e.statusCode === 403) {
        return {
          message: 'You do not have access to this session.',
          code: 'SESSION_ACCESS_DENIED',
        };
      }
      if (e.statusCode === 404) {
        return {
          message: 'Session not found.',
          code: 'SESSION_NOT_FOUND',
        };
      }
      return {
        message: (e.message as string) ?? 'Failed to fetch session key from server.',
        code: (e.code as string) ?? `NETWORK_ERROR_${e.statusCode}`,
      };
    }
  }
  return { message: 'Network error. Please check your connection.', code: 'NETWORK_ERROR' };
}
