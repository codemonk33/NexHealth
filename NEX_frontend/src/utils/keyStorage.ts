/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BioNex Key Storage
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Secure wrapper around expo-secure-store for private key persistence.
 *
 * Storage tier:
 *   • iOS  — Apple Keychain with Secure Enclave backing, NOT backed up to iCloud
 *   • Android — Android Keystore, hardware-backed on devices that support it
 *
 * Access policy: WHEN_UNLOCKED_THIS_DEVICE_ONLY
 *   - Key is inaccessible when the device is locked
 *   - Key cannot be migrated to another device via backup/restore
 *   - User must re-generate (or restore from password-encrypted backup) on
 *     a fresh install or new device
 *
 * Key layout in SecureStore:
 *   bionex_ec_private_key_jwk  — JWK JSON of the ECDH P-256 private key
 *   bionex_key_fingerprint     — SHA-256 hex of the corresponding public key
 *   bionex_key_registered      — "true" | "false" — was public key sent to server?
 *
 * @module keyStorage
 */

import * as SecureStore from 'expo-secure-store';

// ─── Storage Key Constants ────────────────────────────────────────────────────
// NOTE: SecureStore keys must contain ONLY alphanumeric chars, ".", "-", "_"
// The "@" prefix used in AsyncStorage keys is NOT allowed in SecureStore

const STORE_KEY = {
  PRIVATE_KEY_JWK:        'bionex_ec_private_key_jwk',
  KEY_FINGERPRINT:        'bionex_key_fingerprint',
  KEY_REGISTERED:         'bionex_key_registered',
  REGISTRATION_SIGNATURE: 'bionex_registration_signature',
} as const;

// ─── SecureStore Access Policy ────────────────────────────────────────────────

/**
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY:
 *   - Data only accessible while device is unlocked
 *   - NOT included in device backups (iCloud / ADB)
 *   - NOT transferable between devices
 *   - Survives app deletion on iOS if keychain sharing is off (desired)
 */
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// ─── Write Operations ─────────────────────────────────────────────────────────

/**
 * Persist the private key JWK and its fingerprint to the device Keychain/Keystore.
 *
 * IMPORTANT: Call this BEFORE registering the public key with the server.
 * If the server registration fails, the key can be re-sent. If we write to
 * the server first and SecureStore write fails, we have a server-orphaned
 * public key with no corresponding private key on the device.
 *
 * @param privateKeyJWK   - JSON.stringify'd JsonWebKey for the ECDH P-256 private key
 * @param fingerprint     - SHA-256 hex of the public key (64 chars)
 * @param registrationSig - (Optional) base64url-encoded ECDSA signature for public key decryption
 */
export async function savePrivateKey(
  privateKeyJWK: string,
  fingerprint: string,
  registrationSig?: string,
): Promise<void> {
  if (!privateKeyJWK || privateKeyJWK.length < 10) {
    throw new Error('KeyStorage: privateKeyJWK is empty or too short');
  }
  if (!fingerprint || fingerprint.length !== 64) {
    throw new Error('KeyStorage: fingerprint must be 64 hex characters');
  }

  const writes = [
    SecureStore.setItemAsync(STORE_KEY.PRIVATE_KEY_JWK, privateKeyJWK, SECURE_OPTS),
    SecureStore.setItemAsync(STORE_KEY.KEY_FINGERPRINT,  fingerprint,    SECURE_OPTS),
    // Reset registration flag — public key has not been sent to server yet
    SecureStore.setItemAsync(STORE_KEY.KEY_REGISTERED,   'false',        SECURE_OPTS),
  ];

  // Optionally store the registration signature for public key decryption
  if (registrationSig) {
    writes.push(
      SecureStore.setItemAsync(STORE_KEY.REGISTRATION_SIGNATURE, registrationSig, SECURE_OPTS),
    );
  }

  await Promise.all(writes);
}

/**
 * Mark the public key as successfully registered with the backend.
 * Set this flag ONLY after a confirmed 200 response from POST /keypairs/register.
 */
export async function markKeyRegistered(): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY.KEY_REGISTERED, 'true', SECURE_OPTS);
}

// ─── Read Operations ──────────────────────────────────────────────────────────

/**
 * Retrieve the private key JWK string from the device Keychain/Keystore.
 * Returns null if no key has been stored (first install, or after deleteAllKeys).
 */
export async function getPrivateKey(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_KEY.PRIVATE_KEY_JWK, SECURE_OPTS);
}

/**
 * Retrieve the stored key fingerprint.
 * Returns null if not set.
 */
export async function getKeyFingerprint(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_KEY.KEY_FINGERPRINT, SECURE_OPTS);
}

/**
 * Return true if a private key exists in the Keychain/Keystore.
 */
export async function hasPrivateKey(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(STORE_KEY.PRIVATE_KEY_JWK, SECURE_OPTS);
  return val !== null && val.trim().length > 0;
}

/**
 * Return true if the public key has been confirmed as registered on the server.
 */
export async function isKeyRegistered(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(STORE_KEY.KEY_REGISTERED, SECURE_OPTS);
  return val === 'true';
}

/**
 * Retrieve the stored registration signature (base64url-encoded ECDSA signature).
 * Returns null if not set.
 */
export async function getRegistrationSignature(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_KEY.REGISTRATION_SIGNATURE, SECURE_OPTS);
}

/**
 * Read all stored key metadata at once (avoids multiple SecureStore round-trips).
 */
export async function getKeyStatus(): Promise<{
  hasKey: boolean;
  isRegistered: boolean;
  fingerprint: string | null;
  registrationSignature: string | null;
}> {
  const [privateKey, registered, fingerprint, signature] = await Promise.all([
    SecureStore.getItemAsync(STORE_KEY.PRIVATE_KEY_JWK, SECURE_OPTS),
    SecureStore.getItemAsync(STORE_KEY.KEY_REGISTERED,  SECURE_OPTS),
    SecureStore.getItemAsync(STORE_KEY.KEY_FINGERPRINT, SECURE_OPTS),
    SecureStore.getItemAsync(STORE_KEY.REGISTRATION_SIGNATURE, SECURE_OPTS),
  ]);

  return {
    hasKey:                 privateKey !== null && privateKey.trim().length > 0,
    isRegistered:           registered === 'true',
    fingerprint:            fingerprint,
    registrationSignature:  signature,
  };
}

// ─── Delete Operations ────────────────────────────────────────────────────────

/**
 * Permanently erase all cryptographic material from the device Keychain/Keystore.
 *
 * ⚠️  WARNING: After this call, the user cannot decrypt any records protected
 *     by the old private key unless they have a server-assisted backup or the
 *     plaintext session key is still in memory.
 *
 * Called on:
 *   - User logout (clear local session)
 *   - Keypair revocation from server
 *   - Account deletion
 */
export async function deleteAllKeys(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_KEY.PRIVATE_KEY_JWK, SECURE_OPTS),
    SecureStore.deleteItemAsync(STORE_KEY.KEY_FINGERPRINT,  SECURE_OPTS),
    SecureStore.deleteItemAsync(STORE_KEY.KEY_REGISTERED,   SECURE_OPTS),
    SecureStore.deleteItemAsync(STORE_KEY.REGISTRATION_SIGNATURE, SECURE_OPTS),
  ]);
}
