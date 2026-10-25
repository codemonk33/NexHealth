/**
 * Simple test to verify crypto polyfill works
 */

export async function testCryptoPolyfill(): Promise<void> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('crypto.subtle is not available');
  }

  console.log('[CryptoTest] Testing crypto.subtle.generateKey...');

  try {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    console.log('[CryptoTest] ✓ Key generation successful');
    console.log('[CryptoTest] Public key:', keyPair.publicKey);
    console.log('[CryptoTest] Private key:', keyPair.privateKey);

    // Test export
    console.log('[CryptoTest] Testing exportKey (JWK)...');
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    console.log('[CryptoTest] ✓ JWK export successful:', jwk);

    // Test digest
    console.log('[CryptoTest] Testing digest (SHA-256)...');
    const data = new TextEncoder().encode('test data');
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    console.log('[CryptoTest] ✓ SHA-256 digest successful, hash length:', hash.byteLength);

    console.log('[CryptoTest] ✓ All polyfill tests passed!');
  } catch (err) {
    console.error('[CryptoTest] ✗ Polyfill test failed:', err);
    throw err;
  }
}
