/**
 * Public Key Decryption Utility
 *
 * Decrypts public keys received from the backend.
 *
 * Flow on device:
 * 1. Server returns encrypted public key blob (from another user/doctor)
 * 2. Client decrypts using ECDH + ChaCha20-Poly1305
 * 3. Decrypted PEM is used for key agreement or verification
 *
 * Note: This is for RECEIVING encrypted public keys from the server.
 * For SENDING your public key to the server, use the registration flow in cryptoEngine.
 */

import { Buffer } from 'buffer';

export interface EncryptedPublicKeyBlob {
  v: number; // version
  ct: string; // ciphertext (base64url)
  n: string; // nonce (base64url)
  a: string; // algorithm (AES-256-GCM)
}

/**
 * Decode base64url to bytes (reverse of base64url encoding)
 */
function base64urlDecode(data: string): Uint8Array {
  // Add back padding
  const padding = 4 - (data.length % 4);
  const padded = data + (padding === 4 ? '' : '='.repeat(padding));
  
  // Convert to standard base64
  const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
  
  // Decode
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive encryption key from signature using HKDF-SHA256
 *
 * Matches backend derivation exactly:
 * - IKM: signature bytes
 * - salt: user_id bytes
 * - info: "bionex_public_key_encryption_v1"
 * - length: 32 bytes (256 bits for AES-256)
 *
 * @param signatureBytes - ECDSA signature from nonce signing
 * @param userIdSalt - User UUID bytes (for salt)
 * @returns 32-byte encryption key
 */
async function deriveEncryptionKey(
  signatureBytes: Uint8Array,
  userIdSalt: Uint8Array
): Promise<Uint8Array> {
  const info = new TextEncoder().encode('bionex_public_key_encryption_v1');
  
  // HKDF-SHA256 using Web Crypto API
  // Step 1: Extract (pseudorandom key from salt and IKM)
  const extractedKey = await crypto.subtle.importKey(
    'raw',
    userIdSalt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const prk = await crypto.subtle.sign(
    'HMAC',
    extractedKey,
    signatureBytes
  );
  
  // Step 2: Expand (derive 32 bytes)
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // T(1) = HMAC-SHA256(PRK, info + 0x01)
  const t1Input = new Uint8Array(info.length + 1);
  t1Input.set(info);
  t1Input[info.length] = 0x01;
  
  const okm = await crypto.subtle.sign('HMAC', hkdfKey, t1Input);
  
  // Return first 32 bytes
  return new Uint8Array(okm.slice(0, 32));
}

/**
 * Decrypt a public key using the signature-derived key
 *
 * @param encryptedBlob - Encrypted blob from backend { v, ct, n, a }
 * @param signatureBytes - ECDSA signature bytes (from nonce signing)
 * @param userIdUuid - User UUID (for salt)
 * @returns Decrypted public key PEM string
 *
 * @throws Error if decryption fails or authentication tag is invalid
 */
export async function decryptPublicKey(
  encryptedBlob: EncryptedPublicKeyBlob,
  signatureBytes: Uint8Array,
  userIdUuid: string
): Promise<string> {
  try {
    // Validate blob format
    if (encryptedBlob.a !== 'AES-256-GCM') {
      throw new Error(`Unsupported algorithm: ${encryptedBlob.a}`);
    }
    if (encryptedBlob.v !== 1) {
      throw new Error(`Unsupported version: ${encryptedBlob.v}`);
    }

    // Decode base64url to bytes
    const ciphertext = base64urlDecode(encryptedBlob.ct);
    const nonce = base64urlDecode(encryptedBlob.n);

    if (nonce.length !== 12) {
      throw new Error(`Invalid nonce size: expected 12, got ${nonce.length}`);
    }

    // Derive encryption key
    // Convert UUID string to bytes (16 bytes)
    const uuidBytes = uuidStringToBytes(userIdUuid);
    const encryptionKey = await deriveEncryptionKey(signatureBytes, uuidBytes);

    // Import key for AES-GCM decryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encryptionKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt with authentication tag verification
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        tagLength: 128, // 16 bytes = 128 bits
      },
      cryptoKey,
      ciphertext
    );

    // Decode to string
    const publicKeyPem = new TextDecoder().decode(plaintext);

    console.log('[publicKeyDecryption] ✓ Successfully decrypted public key');
    return publicKeyPem;

  } catch (error) {
    console.error('[publicKeyDecryption] ✗ Decryption failed:', error);
    throw error;
  }
}

/**
 * Convert UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000") to 16 bytes
 */
function uuidStringToBytes(uuidString: string): Uint8Array {
  // Remove hyphens
  const hex = uuidString.replace(/-/g, '');
  
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID: expected 32 hex chars, got ${hex.length}`);
  }

  // Convert hex pairs to bytes
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }

  return bytes;
}

/**
 * Parse and decrypt an encrypted public key JSON blob from the backend
 *
 * @param jsonBlob - JSON string: {"v": 1, "ct": "...", "n": "...", "a": "AES-256-GCM"}
 * @param signatureBytes - ECDSA signature from nonce signing
 * @param userIdUuid - User UUID
 * @returns Decrypted public key PEM
 */
export async function decryptStorageBlob(
  jsonBlob: string,
  signatureBytes: Uint8Array,
  userIdUuid: string
): Promise<string> {
  const blob = JSON.parse(jsonBlob) as EncryptedPublicKeyBlob;
  return decryptPublicKey(blob, signatureBytes, userIdUuid);
}
