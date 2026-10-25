/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Crypto Polyfill for React Native
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This module provides a polyfill for crypto.subtle in React Native environments
 * where the Web Crypto API is not natively available.
 *
 * Uses @noble/curves for ECDH and ECDSA, which are already available in the project.
 *
 * @module cryptoPolyfill
 */

import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Try to use Expo's crypto module for better random number generation
let expoCrypto: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expoCrypto = require('expo-crypto');
  console.log('[CryptoPolyfill] expo-crypto module loaded');
} catch (e) {
  console.warn('[CryptoPolyfill] expo-crypto not available, will use fallback RNG');
}

// ─── Compressed/Uncompressed Key Format Conversion ─────────────────────────────

/**
 * Convert compressed P-256 public key (33 bytes) to uncompressed (65 bytes).
 * Compressed format: [prefix: 0x02/0x03] [x: 32 bytes]
 * Uncompressed format: [0x04] [x: 32 bytes] [y: 32 bytes]
 * 
 * Uses @noble/curves' ProjectivePoint to handle decompression via hex parsing.
 */
function decompressPublicKey(compressedKey: Uint8Array): Uint8Array {
  if (compressedKey.length === 65 && compressedKey[0] === 0x04) {
    // Already uncompressed
    return compressedKey;
  }

  if (compressedKey.length !== 33) {
    throw new Error(`Invalid compressed key length: ${compressedKey.length}, expected 33`);
  }

  const prefix = compressedKey[0];
  if (prefix !== 0x02 && prefix !== 0x03) {
    throw new Error(`Invalid compressed key prefix: 0x${prefix.toString(16)}, expected 0x02 or 0x03`);
  }

  try {
    // Use @noble/curves Point to decompress the key
    // Point.fromHex() accepts both compressed (33 bytes) and uncompressed (65 bytes) formats
    const compressedHex = bytesToHex(compressedKey);
    
    console.log('[CryptoPolyfill] decompressPublicKey: using p256.Point.fromHex with hex:', compressedHex.slice(0, 20) + '...');
    
    // Point.fromHex() decompresses the hex-encoded point automatically
    const point = p256.Point.fromHex(compressedHex);
    
    // Convert back to uncompressed format (0x04 + x + y)
    // toBytes(false) returns uncompressed format (0x04 prefix + 64 bytes)
    const uncompressedBytes = point.toBytes(false);
    
    console.log('[CryptoPolyfill] decompressPublicKey: decompressed successfully, length:', uncompressedBytes.length);
    return uncompressedBytes;
  } catch (err) {
    console.error('[CryptoPolyfill] decompressPublicKey: failed', err);
    throw new Error(`Failed to decompress public key: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Convert uncompressed P-256 public key (65 bytes) to compressed (33 bytes).
 * Useful for storage optimization and transmission.
 */
function compressPublicKey(uncompressedKey: Uint8Array): Uint8Array {
  if (uncompressedKey.length === 33 && (uncompressedKey[0] === 0x02 || uncompressedKey[0] === 0x03)) {
    // Already compressed
    return uncompressedKey;
  }

  if (uncompressedKey.length !== 65) {
    throw new Error(`Invalid uncompressed key length: ${uncompressedKey.length}, expected 65`);
  }

  if (uncompressedKey[0] !== 0x04) {
    throw new Error(`Invalid uncompressed key prefix: 0x${uncompressedKey[0].toString(16)}, expected 0x04`);
  }

  try {
    // Extract X and Y coordinates
    const x = uncompressedKey.slice(1, 33);
    const y = uncompressedKey.slice(33, 65);
    
    // Determine prefix: 0x02 if Y is even, 0x03 if Y is odd
    const yLast = y[y.length - 1];
    const prefix = (yLast & 0x01) === 0 ? 0x02 : 0x03;
    
    // Compressed format: [prefix] [x]
    const compressed = new Uint8Array(33);
    compressed[0] = prefix;
    compressed.set(x, 1);
    
    console.log('[CryptoPolyfill] compressPublicKey: converted from 65 bytes to 33 bytes');
    return compressed;
  } catch (err) {
    console.error('[CryptoPolyfill] compressPublicKey: failed', err);
    throw new Error(`Failed to compress public key: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Polyfilled CryptoKey Storage ─────────────────────────────────────────────

export class NobleCryptoKey {
  readonly algorithm: any;
  readonly extractable: boolean;
  readonly keyUsages: string[];
  readonly _keyData: Record<string, any>;

  constructor(
    algorithm: any,
    extractable: boolean,
    keyUsages: string[],
    keyData: Record<string, any>
  ) {
    this.algorithm = algorithm;
    this.extractable = extractable;
    this.keyUsages = keyUsages;
    this._keyData = keyData;
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToHex(str: string): string {
  const base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');

  const binary = atob(base64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

// ─── Polyfill Implementation ───────────────────────────────────────────────────

const polyfill: any = {
  async generateKey(algorithm: any, extractable: boolean, keyUsages: string[]): Promise<any> {
    try {
      const alg = algorithm as { name: string; namedCurve?: string };

      if (alg.name !== 'ECDH' && alg.name !== 'ECDSA') {
        throw new Error(`Polyfill: Unsupported algorithm: ${alg.name}`);
      }

      if (alg.namedCurve !== 'P-256') {
        throw new Error(`Polyfill: Only P-256 curve is supported, got ${alg.namedCurve}`);
      }

      console.log('[CryptoPolyfill] generateKey: calling p256.keygen()');
      
      // Generate P-256 keypair using @noble/curves
      // p256.keygen() returns { secretKey: Uint8Array, publicKey: Uint8Array }
      // Note: the public key returned by keygen() may be compressed (33 bytes)
      const keyPair = p256.keygen();
      console.log('[CryptoPolyfill] generateKey: keygen() returned:', { 
        secretKeyType: keyPair.secretKey?.constructor.name,
        secretKeyLen: keyPair.secretKey?.length,
        publicKeyType: keyPair.publicKey?.constructor.name,
        publicKeyLen: keyPair.publicKey?.length,
      });

      let privateKeyScalar: Uint8Array;
      let publicKeyRaw: Uint8Array;

      // Both are already Uint8Array
      if (keyPair.secretKey instanceof Uint8Array && keyPair.publicKey instanceof Uint8Array) {
        privateKeyScalar = keyPair.secretKey;
        publicKeyRaw = keyPair.publicKey;
      } else {
        throw new Error('keygen() returned unexpected types');
      }

      // p256.keygen() returns compressed keys (33 bytes), but we need uncompressed (65 bytes) for SPKI/JWK export
      // Decompress if necessary
      console.log('[CryptoPolyfill] generateKey: public key received - length:', publicKeyRaw.length, 'prefix: 0x' + publicKeyRaw[0].toString(16));
      if (publicKeyRaw.length === 33) {
        console.log('[CryptoPolyfill] generateKey: decompressing public key from compressed (33 bytes) to uncompressed (65 bytes)');
        publicKeyRaw = decompressPublicKey(publicKeyRaw);
        console.log('[CryptoPolyfill] generateKey: decompression successful, new length:', publicKeyRaw.length);
      }

      console.log('[CryptoPolyfill] generateKey: converting to hex');
      const pubKeyHex = bytesToHex(publicKeyRaw);
      const privKeyHex = bytesToHex(privateKeyScalar);
      console.log('[CryptoPolyfill] generateKey: pubKeyHex length:', pubKeyHex.length, '(bytes:', publicKeyRaw.length, '), privKeyHex length:', privKeyHex.length);
      console.log('[CryptoPolyfill] generateKey: public key prefix: 0x' + publicKeyRaw[0].toString(16) + ', format:', publicKeyRaw.length === 33 ? 'COMPRESSED' : 'UNCOMPRESSED');

      const publicKey = new NobleCryptoKey(algorithm, true, [], {
        type: 'public',
        curve: 'P-256',
        publicKeyRaw: pubKeyHex,
      });

      const privateKey = new NobleCryptoKey(algorithm, extractable, keyUsages, {
        type: 'private',
        curve: 'P-256',
        privateKeyScalar: privKeyHex,
        publicKeyRaw: pubKeyHex,
      });

      console.log('[CryptoPolyfill] generateKey: keys created successfully');
      return { publicKey, privateKey };
    } catch (err) {
      console.error('[CryptoPolyfill] generateKey failed:', err);
      throw err;
    }
  },

  async exportKey(format: string, key: any): Promise<any> {
    const nbleKey = key as NobleCryptoKey;

    if (format === 'spki' && nbleKey._keyData.type === 'public') {
      // SPKI export: Must be UNCOMPRESSED format (65 bytes, 0x04 prefix)
      let pubKeyBytes = hexToBytes(nbleKey._keyData.publicKeyRaw);
      
      console.log('[CryptoPolyfill] exportKey: SPKI export, key length:', pubKeyBytes.length, 'prefix: 0x' + pubKeyBytes[0].toString(16));

      // If key is compressed (33 bytes), we cannot export to SPKI
      // SPKI MUST use uncompressed format
      if (pubKeyBytes.length === 33) {
        // For now, just use the compressed key as-is in SPKI
        // This is technically against spec but matches what the backend expects
        console.log('[CryptoPolyfill] exportKey: WARNING - key is compressed (33 bytes), exporting as-is in SPKI');
      } else if (pubKeyBytes.length !== 65) {
        throw new Error(`Invalid public key length for SPKI export: ${pubKeyBytes.length}, expected 33 or 65`);
      }

      // SPKI DER structure for P-256 public key
      const oidEcPublicKey = new Uint8Array([0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01]);
      // P-256 (secp256r1) OID: 1.2.840.10045.3.1.7
      const oidP256 = new Uint8Array([0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07]);

      // Encode algorithm identifier SEQUENCE
      const algIdSeq = new Uint8Array(2 + oidEcPublicKey.length + oidP256.length);
      algIdSeq[0] = 0x30;
      algIdSeq[1] = oidEcPublicKey.length + oidP256.length;
      algIdSeq.set(oidEcPublicKey, 2);
      algIdSeq.set(oidP256, 2 + oidEcPublicKey.length);

      // Encode public key as BIT STRING
      const bitStringContent = new Uint8Array(1 + pubKeyBytes.length);
      bitStringContent[0] = 0x00;  // no padding bits
      bitStringContent.set(pubKeyBytes, 1);
      
      const bitString = new Uint8Array(2 + bitStringContent.length);
      bitString[0] = 0x03;
      bitString[1] = bitStringContent.length;
      bitString.set(bitStringContent, 2);

      // Encode outer SEQUENCE
      const spkiContent = new Uint8Array(algIdSeq.length + bitString.length);
      spkiContent.set(algIdSeq, 0);
      spkiContent.set(bitString, algIdSeq.length);

      const spki = new Uint8Array(2 + spkiContent.length);
      spki[0] = 0x30;
      spki[1] = spkiContent.length;
      spki.set(spkiContent, 2);

      console.log('[CryptoPolyfill] exportKey: generated SPKI DER, length:', spki.length);
      return spki.buffer.slice(spki.byteOffset, spki.byteOffset + spki.byteLength);
    }

    if (format === 'jwk') {
      if (nbleKey._keyData.type === 'private') {
        const privKeyHex = nbleKey._keyData.privateKeyScalar;
        const privKeyBytes = hexToBytes(privKeyHex);
        let pubKeyBytes = hexToBytes(nbleKey._keyData.publicKeyRaw);
        
        // For JWK, we need X and Y coordinates (32 bytes each)
        // If key is compressed (33 bytes), we cannot extract X,Y
        if (pubKeyBytes.length === 33) {
          console.log('[CryptoPolyfill] exportKey: JWK - key is compressed, cannot extract X,Y coords');
          throw new Error('Cannot export compressed P-256 key to JWK format (requires X,Y coordinates)');
        }

        if (pubKeyBytes.length !== 65) {
          throw new Error(`Invalid public key length for JWK: ${pubKeyBytes.length}`);
        }

        return {
          kty: 'EC',
          crv: 'P-256',
          d: uint8ToBase64Url(privKeyBytes),
          x: uint8ToBase64Url(pubKeyBytes.slice(1, 33)),  // skip 0x04 prefix
          y: uint8ToBase64Url(pubKeyBytes.slice(33, 65)),
        };
      } else {
        let pubKeyBytes = hexToBytes(nbleKey._keyData.publicKeyRaw);
        
        if (pubKeyBytes.length === 33) {
          console.log('[CryptoPolyfill] exportKey: JWK - key is compressed, cannot extract X,Y coords');
          throw new Error('Cannot export compressed P-256 key to JWK format (requires X,Y coordinates)');
        }

        if (pubKeyBytes.length !== 65) {
          throw new Error(`Invalid public key length for JWK: ${pubKeyBytes.length}`);
        }

        return {
          kty: 'EC',
          crv: 'P-256',
          x: uint8ToBase64Url(pubKeyBytes.slice(1, 33)),  // skip 0x04 prefix
          y: uint8ToBase64Url(pubKeyBytes.slice(33, 65)),
        };
      }
    }

    throw new Error(`Polyfill: Unsupported export format: ${format}`);
  },

  async importKey(format: string, keyData: any, algorithm: any, extractable: boolean, keyUsages: string[]): Promise<any> {
    // ─── SPKI Format (SubjectPublicKeyInfo - DER encoded) ──────────────────
    if (format === 'spki' && keyData instanceof ArrayBuffer) {
      try {
        console.log('[CryptoPolyfill] importKey: parsing SPKI DER format, length:', keyData.byteLength);
        const spkiBytes = new Uint8Array(keyData);
        
        // Parse DER SEQUENCE with proper long-form length encoding support
        let offset = 0;

        // Read first SEQUENCE tag
        if (spkiBytes[offset] !== 0x30) {
          throw new Error(`Expected SEQUENCE tag (0x30), got 0x${spkiBytes[offset].toString(16)}`);
        }
        offset++;

        // Read SEQUENCE length (handle both short and long form)
        let seqLength = spkiBytes[offset];
        offset++;
        if (seqLength & 0x80) {
          const lenBytes = seqLength & 0x7f;
          seqLength = 0;
          for (let i = 0; i < lenBytes; i++) {
            seqLength = (seqLength << 8) | spkiBytes[offset];
            offset++;
          }
        }

        // Skip algorithm identifier SEQUENCE
        if (spkiBytes[offset] !== 0x30) {
          throw new Error('Expected algorithm identifier SEQUENCE');
        }
        offset++;
        
        let algSeqLen = spkiBytes[offset];
        offset++;
        if (algSeqLen & 0x80) {
          const lenBytes = algSeqLen & 0x7f;
          algSeqLen = 0;
          for (let i = 0; i < lenBytes; i++) {
            algSeqLen = (algSeqLen << 8) | spkiBytes[offset];
            offset++;
          }
        }
        offset += algSeqLen;

        // Read BIT STRING tag
        if (spkiBytes[offset] !== 0x03) {
          throw new Error(`Expected BIT STRING tag (0x03), got 0x${spkiBytes[offset].toString(16)}`);
        }
        offset++;

        // Read BIT STRING length
        let bitStringLen = spkiBytes[offset];
        offset++;
        if (bitStringLen & 0x80) {
          const lenBytes = bitStringLen & 0x7f;
          bitStringLen = 0;
          for (let i = 0; i < lenBytes; i++) {
            bitStringLen = (bitStringLen << 8) | spkiBytes[offset];
            offset++;
          }
        }

        // Skip BIT STRING padding byte
        const paddingBits = spkiBytes[offset];
        offset++;

        if (paddingBits !== 0) {
          throw new Error(`Expected no padding bits in BIT STRING, got ${paddingBits}`);
        }

        // Extract public key bytes
        const publicKeyBytes = spkiBytes.slice(offset, offset + bitStringLen - 1);
        
        console.log('[CryptoPolyfill] importKey: extracted public key, length:', publicKeyBytes.length, 'prefix: 0x' + publicKeyBytes[0].toString(16));

        // Handle both compressed (33) and uncompressed (65) formats
        let uncompressedKey = publicKeyBytes;
        if (publicKeyBytes.length === 33) {
          console.log('[CryptoPolyfill] importKey: decompressing public key');
          uncompressedKey = decompressPublicKey(publicKeyBytes);
        } else if (publicKeyBytes.length !== 65) {
          throw new Error(`Invalid public key length: ${publicKeyBytes.length}, expected 33 (compressed) or 65 (uncompressed)`);
        }

        const publicKeyHex = bytesToHex(uncompressedKey);

        return new NobleCryptoKey(algorithm, extractable, keyUsages, {
          type: 'public',
          curve: 'P-256',
          publicKeyRaw: publicKeyHex,
        });
      } catch (err) {
        console.error('[CryptoPolyfill] importKey: SPKI parsing failed:', err);
        throw new Error(`Polyfill: Failed to import SPKI key: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ─── JWK Format (JSON Web Key) ─────────────────────────────────────────
    if (format === 'jwk' && typeof keyData === 'object' && 'kty' in keyData) {
      const jwk = keyData as any;
      if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
        throw new Error('Polyfill: Only P-256 EC keys are supported');
      }

      if (jwk.d) {
        const x = base64UrlToHex(jwk.x!);
        const y = base64UrlToHex(jwk.y!);
        const uncompressedPubKey = '04' + x + y;

        return new NobleCryptoKey(algorithm, extractable, keyUsages, {
          type: 'private',
          curve: 'P-256',
          privateKeyScalar: base64UrlToHex(jwk.d),
          publicKeyRaw: uncompressedPubKey,
        });
      } else {
        const x = base64UrlToHex(jwk.x!);
        const y = base64UrlToHex(jwk.y!);
        const uncompressedPubKey = '04' + x + y;

        return new NobleCryptoKey(algorithm, extractable, keyUsages, {
          type: 'public',
          curve: 'P-256',
          publicKeyRaw: uncompressedPubKey,
        });
      }
    }

    throw new Error(`Polyfill: Unsupported import format: ${format}`);
  },

  async sign(algorithm: any, key: any, data: any): Promise<ArrayBuffer> {
    try {
      const nbleKey = key as NobleCryptoKey;
      const alg = algorithm as { name: string; hash?: { name: string } };

      if (alg.name !== 'ECDSA') {
        throw new Error(`Polyfill: Only ECDSA signing is supported`);
      }

      if (nbleKey._keyData.type !== 'private') {
        throw new Error('Polyfill: Cannot sign with a public key');
      }

      console.log('[CryptoPolyfill] sign: starting ECDSA signature');
      const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
      const privateKeyScalar = hexToBytes(nbleKey._keyData.privateKeyScalar);
      
      console.log('[CryptoPolyfill] sign: calling p256.sign()');
      // p256.sign() returns a Uint8Array signature
      const signatureBytes = p256.sign(dataArray, privateKeyScalar);
      console.log('[CryptoPolyfill] sign: signature generated, length:', signatureBytes.length);

      return signatureBytes.buffer.slice(signatureBytes.byteOffset, signatureBytes.byteOffset + signatureBytes.byteLength);
    } catch (err) {
      console.error('[CryptoPolyfill] sign failed:', err);
      throw err;
    }
  },

  async deriveBits(algorithm: any, baseKey: any, length: number): Promise<ArrayBuffer> {
    const nbleBaseKey = baseKey as NobleCryptoKey;
    const publicKeyParam = algorithm.public as NobleCryptoKey;

    if (!publicKeyParam || publicKeyParam._keyData.type !== 'public') {
      throw new Error('Polyfill: ECDH requires a public key');
    }

    if (nbleBaseKey._keyData.type !== 'private') {
      throw new Error('Polyfill: ECDH base key must be private');
    }

    try {
      console.log('[CryptoPolyfill] deriveBits: starting ECDH');
      // Get the private key bytes
      const privateKeyScalar = hexToBytes(nbleBaseKey._keyData.privateKeyScalar);
      // Get the public key bytes
      const publicKeyRaw = hexToBytes(publicKeyParam._keyData.publicKeyRaw);
      
      console.log('[CryptoPolyfill] deriveBits: calling p256.getSharedSecret()');
      // p256.getSharedSecret() returns Uint8Array
      const sharedBytes = p256.getSharedSecret(privateKeyScalar, publicKeyRaw);
      console.log('[CryptoPolyfill] deriveBits: shared secret generated, length:', sharedBytes.length);

      if (length === 256) {
        return sharedBytes.buffer.slice(sharedBytes.byteOffset, sharedBytes.byteOffset + sharedBytes.byteLength);
      }

      throw new Error(`Polyfill: Unsupported deriveBits length: ${length}`);
    } catch (err) {
      console.error('[CryptoPolyfill] deriveBits failed:', err);
      throw err;
    }
  },

  async digest(algorithm: any, data: any): Promise<ArrayBuffer> {
    const alg = algorithm as { name?: string } | string;
    const algName = typeof alg === 'string' ? alg : alg.name;

    if (algName !== 'SHA-256') {
      throw new Error(`Polyfill: Only SHA-256 is supported, got ${algName}`);
    }

    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
    const hash = sha256(dataArray);

    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
  },
};

// ─── Initialize Polyfill ──────────────────────────────────────────────────────

export function initializeCryptoPolyfill(): void {
  console.log('[CryptoPolyfill] Checking if crypto.subtle is available...');
  
  if (!globalThis.crypto) {
    console.log('[CryptoPolyfill] No crypto object found, creating...');
    (globalThis as any).crypto = {};
  }

  // ─── Critical: Provide getRandomValues ─────────────────────────────────────
  // @noble/curves calls crypto.getRandomValues() internally for key generation
  // We MUST polyfill this or key generation will fail
  if (!globalThis.crypto.getRandomValues) {
    console.log('[CryptoPolyfill] Installing crypto.getRandomValues polyfill');
    (globalThis.crypto as any).getRandomValues = (array: Uint8Array): Uint8Array => {
      // Prefer expo-crypto if available (platform-native random)
      if (expoCrypto && expoCrypto.getRandomBytes) {
        try {
          const randomBytes = expoCrypto.getRandomBytes(array.length);
          if (randomBytes instanceof Uint8Array) {
            array.set(randomBytes);
            return array;
          }
        } catch (err) {
          console.warn('[CryptoPolyfill] expo-crypto.getRandomBytes failed:', err);
        }
      }

      // Fallback: Use Math.random() (not cryptographically secure!)
      // This is only used when expo-crypto is unavailable
      console.warn('[CryptoPolyfill] Using Math.random() for getRandomValues (NOT SECURE - use only for development)');
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
    console.log('[CryptoPolyfill] crypto.getRandomValues installed');
  }

  if (!globalThis.crypto.subtle) {
    console.log('[CryptoPolyfill] Installing Web Crypto polyfill for React Native');
    console.log('[CryptoPolyfill] Polyfill object:', Object.keys(polyfill));
    (globalThis.crypto as any).subtle = polyfill;
    console.log('[CryptoPolyfill] Polyfill installed successfully');
  } else {
    console.log('[CryptoPolyfill] crypto.subtle already available, polyfill not installed');
  }
  
  // Verify crypto.subtle.generateKey exists
  console.log('[CryptoPolyfill] crypto.subtle.generateKey type:', typeof globalThis.crypto?.subtle?.generateKey);
  console.log('[CryptoPolyfill] crypto.getRandomValues type:', typeof globalThis.crypto?.getRandomValues);
}
