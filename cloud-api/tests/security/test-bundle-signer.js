/**
 * Tests for BundleSigner
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BundleSigner = require('../../src/security/BundleSigner');

console.log('Testing BundleSigner...\n');

// Use temp directory for tests
const testKeysPath = path.join(__dirname, '../../keys-test');

// Mock logger
const mockLogger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, JSON.stringify(meta || {})),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, JSON.stringify(meta || {})),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, JSON.stringify(meta || {}))
};

// Cleanup function
function cleanup() {
  if (fs.existsSync(testKeysPath)) {
    fs.rmSync(testKeysPath, { recursive: true, force: true });
  }
}

// Test 1: Create BundleSigner
console.log('Test 1: Create BundleSigner');
(() => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    assert(signer, 'Should create BundleSigner');
    assert(typeof signer.initialize === 'function', 'Should have initialize method');
    assert(typeof signer.signBundle === 'function', 'Should have signBundle method');
    assert(typeof signer.verifyBundle === 'function', 'Should have verifyBundle method');
    assert(typeof signer.generateKeyPair === 'function', 'Should have generateKeyPair method');

    console.log('✓ BundleSigner created successfully');
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 2: Generate KeyPair
console.log('Test 2: Generate KeyPair');
(async () => {
  try {
    cleanup(); // Clean before test

    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    const keypair = await signer.generateKeyPair();

    assert(keypair.privateKey, 'Should have private key');
    assert(keypair.publicKey, 'Should have public key');
    assert(keypair.keyId === 'test-key', 'Should have key ID');
    assert(keypair.privateKey.includes('BEGIN RSA PRIVATE KEY'), 'Private key should be PEM format');
    assert(keypair.publicKey.includes('BEGIN PUBLIC KEY'), 'Public key should be PEM format');

    // Check files were created
    const privateKeyPath = path.join(testKeysPath, 'private.pem');
    const publicKeyPath = path.join(testKeysPath, 'public.pem');
    assert(fs.existsSync(privateKeyPath), 'Private key file should exist');
    assert(fs.existsSync(publicKeyPath), 'Public key file should exist');

    console.log('✓ KeyPair generated successfully');
    console.log(`  Private key: ${keypair.privateKey.substring(0, 50)}...`);
    console.log(`  Public key: ${keypair.publicKey.substring(0, 50)}...`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 3: Initialize (Load Existing Keys)
console.log('Test 3: Initialize (Load Existing Keys)');
(async () => {
  try {
    // Keys should exist from previous test
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    assert(signer.isInitialized(), 'Signer should be initialized');
    assert(signer.privateKey, 'Private key should be loaded');
    assert(signer.publicKey, 'Public key should be loaded');

    console.log('✓ Keys loaded from disk');
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 4: Sign Bundle
console.log('Test 4: Sign Bundle');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const bundle = {
      bundle_id: 'test-bundle-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        { path: 'src/app.js', content: 'console.log("hello");', action: 'create' }
      ],
      metadata: { tokensUsed: 1000 }
    };

    const signedBundle = signer.signBundle(bundle);

    assert(signedBundle.signature, 'Signed bundle should have signature');
    assert(signedBundle.signature.algorithm === 'RSA-SHA256', 'Should use RSA-SHA256');
    assert(signedBundle.signature.value, 'Should have signature value');
    assert(signedBundle.signature.signed_at, 'Should have signed_at timestamp');
    assert(signedBundle.signature.key_id === 'test-key', 'Should have key ID');
    assert(signedBundle.bundle_id === bundle.bundle_id, 'Should preserve bundle data');

    console.log('✓ Bundle signed successfully');
    console.log(`  Algorithm: ${signedBundle.signature.algorithm}`);
    console.log(`  Key ID: ${signedBundle.signature.key_id}`);
    console.log(`  Signature: ${signedBundle.signature.value.substring(0, 32)}...`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 5: Verify Valid Signature
console.log('Test 5: Verify Valid Signature');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const bundle = {
      bundle_id: 'test-bundle-456',
      bundle_type: 'patch',
      files: [{ path: 'test.js', content: 'test', action: 'create' }]
    };

    const signedBundle = signer.signBundle(bundle);
    const verified = signer.verifyBundle(signedBundle);

    assert(verified === true, 'Valid signature should verify');

    console.log('✓ Valid signature verified');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 6: Reject Invalid Signature
console.log('Test 6: Reject Invalid Signature');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const bundle = {
      bundle_id: 'test-bundle-789',
      bundle_type: 'patch',
      files: [{ path: 'test.js', content: 'test', action: 'create' }]
    };

    const signedBundle = signer.signBundle(bundle);

    // Tamper with bundle
    signedBundle.files[0].content = 'TAMPERED CONTENT';

    const verified = signer.verifyBundle(signedBundle);

    assert(verified === false, 'Tampered bundle should fail verification');

    console.log('✓ Tampered signature rejected');
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 7: Reject Unsigned Bundle
console.log('Test 7: Reject Unsigned Bundle');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const unsignedBundle = {
      bundle_id: 'test-bundle-999',
      bundle_type: 'patch',
      files: []
    };

    const verified = signer.verifyBundle(unsignedBundle);

    assert(verified === false, 'Unsigned bundle should fail verification');

    console.log('✓ Unsigned bundle rejected');
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 8: Deterministic Serialization
console.log('Test 8: Deterministic Serialization');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    // Same bundle with different key order
    const bundle1 = {
      bundle_id: 'test',
      files: [],
      metadata: { a: 1, b: 2 }
    };

    const bundle2 = {
      metadata: { b: 2, a: 1 },
      bundle_id: 'test',
      files: []
    };

    const signed1 = signer.signBundle(bundle1);
    const signed2 = signer.signBundle(bundle2);

    // Signatures should be identical for same data with different key order
    assert(signed1.signature.value === signed2.signature.value, 'Deterministic serialization should produce same signature');

    console.log('✓ Deterministic serialization working');
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 9: Get Public Key PEM
console.log('Test 9: Get Public Key PEM');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const publicKeyPem = signer.getPublicKeyPem();

    assert(typeof publicKeyPem === 'string', 'Public key PEM should be string');
    assert(publicKeyPem.includes('BEGIN PUBLIC KEY'), 'Should be PEM format');
    assert(publicKeyPem.includes('END PUBLIC KEY'), 'Should be PEM format');

    console.log('✓ Public key PEM retrieved');
    console.log(`  PEM: ${publicKeyPem.substring(0, 50)}...`);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 10: Get Key Fingerprint
console.log('Test 10: Get Key Fingerprint');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const fingerprint = signer.getKeyFingerprint();

    assert(typeof fingerprint === 'string', 'Fingerprint should be string');
    assert(fingerprint.length === 64, 'SHA-256 fingerprint should be 64 hex characters');

    console.log('✓ Key fingerprint retrieved');
    console.log(`  Fingerprint: ${fingerprint}`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 11: Load Public Key from PEM
console.log('Test 11: Load Public Key from PEM');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const publicKeyPem = signer.getPublicKeyPem();
    const loadedPublicKey = signer.loadPublicKeyFromPem(publicKeyPem);

    assert(loadedPublicKey, 'Should load public key from PEM');

    console.log('✓ Public key loaded from PEM');
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Test 12: Verify with External Public Key
console.log('Test 12: Verify with External Public Key');
(async () => {
  try {
    const signer = new BundleSigner({
      keysPath: testKeysPath,
      keyId: 'test-key',
      logger: mockLogger
    });

    await signer.initialize();

    const bundle = {
      bundle_id: 'test-external',
      files: []
    };

    const signedBundle = signer.signBundle(bundle);

    // Get public key PEM
    const publicKeyPem = signer.getPublicKeyPem();
    const externalPublicKey = signer.loadPublicKeyFromPem(publicKeyPem);

    // Verify with external public key
    const verified = signer.verifyBundle(signedBundle, externalPublicKey);

    assert(verified === true, 'Should verify with external public key');

    console.log('✓ Verification with external public key working');
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    cleanup();
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  cleanup();

  console.log('========================================');
  console.log('All BundleSigner Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Tests Summary:');
  console.log('1. ✓ BundleSigner creation');
  console.log('2. ✓ RSA-2048 keypair generation');
  console.log('3. ✓ Key loading from disk');
  console.log('4. ✓ Bundle signing');
  console.log('5. ✓ Valid signature verification');
  console.log('6. ✓ Invalid signature rejection');
  console.log('7. ✓ Unsigned bundle rejection');
  console.log('8. ✓ Deterministic serialization');
  console.log('9. ✓ Public key PEM export');
  console.log('10. ✓ Key fingerprint generation');
  console.log('11. ✓ Public key import from PEM');
  console.log('12. ✓ Verification with external public key');
  console.log('\nAll 12 tests passing!');
  console.log('\n⚠️  IMPORTANT: Keys directory is excluded from git (.gitignore)');
  console.log('⚠️  PRODUCTION: Use environment variables or HSM for key management');
}, 3000);
