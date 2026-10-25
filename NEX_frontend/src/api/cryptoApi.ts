/**
 * Encryption & Crypto API
 * 
 * Handles zero-knowledge E2E encryption registration:
 * 1. Get registration challenge (nonce)
 * 2. Register keypair with proof-of-possession
 * 3. Query registered keypair metadata
 */

import apiClient from './client';
import type { AxiosError } from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistrationChallengeResponse {
  nonce: string; // 64-char hex string
  expires_in: number; // seconds
  issued_at: string; // ISO-8601 UTC timestamp
}

export interface RegisterKeypairRequest {
  public_key_pem: string; // SPKI PEM-encoded public key
  display_fingerprint: string; // SHA-256 hex (64 chars)
  nonce: string; // Challenge nonce from /registration-challenge
  nonce_signature: string; // ECDSA-SHA-256 signature (base64url)
}

export interface UserKeypairResponse {
  id: string; // UUID
  user_id: string; // UUID
  public_key_fingerprint: string; // SHA-256 hex
  key_algorithm: string; // 'ECDH_P256'
  is_revoked: boolean;
  created_at: string; // ISO-8601
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a single-use registration challenge nonce.
 * 
 * The nonce must be:
 * 1. Signed with the device's private key using ECDSA-SHA-256
 * 2. Submitted along with the public key to /keypairs/register
 * 
 * Nonce expires in 60 seconds if not used.
 */
export async function getRegistrationChallenge(): Promise<RegistrationChallengeResponse> {
  try {
    console.log('[CryptoAPI] getRegistrationChallenge: requesting nonce from server');
    
    const { data } = await apiClient.get<RegistrationChallengeResponse>(
      '/encryption/keypairs/registration-challenge'
    );
    
    console.log('[CryptoAPI] getRegistrationChallenge: received nonce', {
      nonce_prefix: data.nonce?.slice(0, 16) + '...',
      expires_in: data.expires_in,
      issued_at: data.issued_at,
    });
    
    return data;
  } catch (error: any) {
    console.error('[CryptoAPI] getRegistrationChallenge: failed', error);
    throw {
      code: error.response?.status === 503 ? 'CACHE_UNAVAILABLE' : 'CHALLENGE_FAILED',
      message: error.response?.data?.detail || 'Failed to get registration challenge',
      statusCode: error.response?.status || 500,
    };
  }
}

/**
 * Register a client-generated ECDH P-256 public key with proof-of-possession.
 * 
 * The server will:
 * 1. Verify the public key PEM is valid ECDH P-256 SPKI format
 * 2. Verify the nonce_signature proves ownership of the private key
 * 3. Store the public key in the database
 * 4. Return keypair metadata (fingerprint, algorithm, timestamps)
 */
export async function registerKeypair(
  request: RegisterKeypairRequest
): Promise<UserKeypairResponse> {
  try {
    console.log('[CryptoAPI] registerKeypair: submitting keypair registration', {
      fingerprint_prefix: request.display_fingerprint?.slice(0, 16) + '...',
      nonce_prefix: request.nonce?.slice(0, 16) + '...',
      sig_prefix: request.nonce_signature?.slice(0, 20) + '...',
    });

    const { data } = await apiClient.post<UserKeypairResponse>(
      '/encryption/keypairs/register',
      {
        public_key_pem: request.public_key_pem,
        display_fingerprint: request.display_fingerprint,
        nonce: request.nonce,
        nonce_signature: request.nonce_signature,
      }
    );

    console.log('[CryptoAPI] registerKeypair: registration successful', {
      keypair_id: data.id?.slice(0, 8) + '...',
      fingerprint_prefix: data.public_key_fingerprint?.slice(0, 16) + '...',
    });

    return data;
  } catch (error: any) {
    const statusCode = error.response?.status;
    const detail = error.response?.data?.detail || error.response?.data?.message;

    let code = 'REGISTRATION_FAILED';
    if (statusCode === 409) {
      code = 'KEYPAIR_ALREADY_EXISTS';
    } else if (statusCode === 422) {
      if (typeof detail === 'object' && detail?.code) {
        code = detail.code; // INVALID_PUBLIC_KEY, INVALID_SIGNATURE, NONCE_EXPIRED
      }
    }

    console.error('[CryptoAPI] registerKeypair: failed', {
      statusCode,
      code,
      detail,
    });

    throw {
      code,
      message: typeof detail === 'string' ? detail : detail?.message || 'Registration failed',
      statusCode: statusCode || 500,
    };
  }
}

/**
 * Get current user's registered keypair metadata.
 * 
 * Returns fingerprint, algorithm, and timestamps - NOT the public key itself.
 * Returns 404 if no active keypair is registered.
 */
export async function getMyKeypair(): Promise<UserKeypairResponse> {
  try {
    console.log('[CryptoAPI] getMyKeypair: querying server for registered keypair');

    const { data } = await apiClient.get<UserKeypairResponse>(
      '/encryption/keypairs/me'
    );

    console.log('[CryptoAPI] getMyKeypair: found registered keypair', {
      keypair_id: data.id?.slice(0, 8) + '...',
      fingerprint_prefix: data.public_key_fingerprint?.slice(0, 16) + '...',
    });

    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('[CryptoAPI] getMyKeypair: no keypair registered (expected on first auth)');
      throw {
        code: 'NO_ACTIVE_KEYPAIR',
        message: 'No active keypair found. Call register endpoint.',
        statusCode: 404,
      };
    }

    console.error('[CryptoAPI] getMyKeypair: failed', error);
    throw {
      code: 'KEYPAIR_QUERY_FAILED',
      message: error.response?.data?.detail || 'Failed to query keypair',
      statusCode: error.response?.status || 500,
    };
  }
}

/**
 * Revoke the current user's keypair.
 * 
 * After successful revocation, all active sessions are immediately revoked.
 * The client MUST delete the private key from SecureStore after receiving 200 OK.
 */
export async function revokeKeypair(): Promise<{ message: string }> {
  try {
    console.log('[CryptoAPI] revokeKeypair: requesting keypair revocation');

    const { data } = await apiClient.delete<{ message: string }>(
      '/encryption/keypairs/me'
    );

    console.log('[CryptoAPI] revokeKeypair: revocation successful');
    return data;
  } catch (error: any) {
    console.error('[CryptoAPI] revokeKeypair: failed', error);
    throw {
      code: 'REVOCATION_FAILED',
      message: error.response?.data?.detail || 'Failed to revoke keypair',
      statusCode: error.response?.status || 500,
    };
  }
}
