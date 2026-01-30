/**
 * Bundle Verifier
 * Verifies cryptographic signatures of code bundles (client-side)
 * Uses Web Crypto API for browser/Electron renderer
 */
class BundleVerifier {
  /**
   * Create a new Bundle Verifier
   * @param {Object} config - Configuration
   * @param {string} config.publicKey - Public key in PEM format (embedded)
   */
  constructor(config = {}) {
    this.publicKeyPem = config.publicKey || this._getEmbeddedPublicKey();
    this.publicKey = null;
  }

  /**
   * Initialize verifier (import public key)
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Convert PEM to ArrayBuffer
      const publicKeyDer = this._pemToDer(this.publicKeyPem);

      // Import public key using Web Crypto API
      this.publicKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeyDer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['verify']
      );

      console.log('[BundleVerifier] Public key imported successfully');
    } catch (error) {
      console.error('[BundleVerifier] Failed to import public key:', error);
      throw error;
    }
  }

  /**
   * Verify a signed bundle
   * @param {Object} signedBundle - Signed bundle
   * @returns {Promise<boolean>} True if signature is valid
   */
  async verifyBundle(signedBundle) {
    if (!this.publicKey) {
      throw new Error('Public key not loaded. Call initialize() first.');
    }

    console.log('[BundleVerifier] Verifying bundle:', signedBundle.bundle_id);

    try {
      // Check if bundle has signature
      if (!signedBundle.signature) {
        console.warn('[BundleVerifier] Bundle has no signature');
        return false;
      }

      // Extract signature
      const { algorithm, value: signatureBase64, key_id } = signedBundle.signature;

      // Verify algorithm
      if (algorithm !== 'RSA-SHA256') {
        console.warn('[BundleVerifier] Unsupported signature algorithm:', algorithm);
        return false;
      }

      // Create unsigned bundle (remove signature for verification)
      const { signature, ...unsignedBundle } = signedBundle;

      // Serialize to JSON with sorted keys
      const bundleJson = this._serializeDeterministic(unsignedBundle);

      // Create SHA-256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(bundleJson);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

      // Decode signature from base64
      const signatureBuffer = this._base64ToArrayBuffer(signatureBase64);

      // Verify signature
      const verified = await window.crypto.subtle.verify(
        {
          name: 'RSASSA-PKCS1-v1_5'
        },
        this.publicKey,
        signatureBuffer,
        hashBuffer
      );

      if (verified) {
        console.log('[BundleVerifier] Bundle signature verified:', {
          bundle_id: signedBundle.bundle_id,
          key_id
        });
      } else {
        console.warn('[BundleVerifier] Bundle signature verification failed:', {
          bundle_id: signedBundle.bundle_id,
          key_id
        });
      }

      return verified;
    } catch (error) {
      console.error('[BundleVerifier] Bundle verification error:', error);
      return false;
    }
  }

  /**
   * Serialize object to deterministic JSON
   * @param {Object} obj - Object to serialize
   * @returns {string} JSON string with sorted keys
   * @private
   */
  _serializeDeterministic(obj) {
    const sortKeys = (obj) => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sortKeys);
      }

      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortKeys(obj[key]);
      });

      return sorted;
    };

    const sorted = sortKeys(obj);
    return JSON.stringify(sorted);
  }

  /**
   * Convert PEM to DER (ArrayBuffer)
   * @param {string} pem - PEM string
   * @returns {ArrayBuffer} DER binary data
   * @private
   */
  _pemToDer(pem) {
    // Remove PEM header/footer and whitespace
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';
    const pemContents = pem
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    // Decode base64 to binary
    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  /**
   * Convert base64 to ArrayBuffer
   * @param {string} base64 - Base64 string
   * @returns {ArrayBuffer} Binary data
   * @private
   */
  _base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get embedded public key (should be replaced with actual public key)
   * @returns {string} Public key in PEM format
   * @private
   */
  _getEmbeddedPublicKey() {
    // IMPORTANT: In production, this should be the actual public key
    // from your cloud-api/keys/public.pem
    // For now, return a placeholder that will be replaced during build
    return `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_ACTUAL_PUBLIC_KEY_DURING_BUILD
-----END PUBLIC KEY-----`;
  }

  /**
   * Check if verifier is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.publicKey !== null;
  }

  /**
   * Reject unsigned bundles
   * @param {Object} bundle - Bundle to check
   * @throws {Error} If bundle is unsigned
   */
  requireSignature(bundle) {
    if (!bundle.signature) {
      throw new Error('Bundle is not signed. Unsigned bundles are not allowed.');
    }
  }

  /**
   * Verify and reject if invalid
   * @param {Object} signedBundle - Signed bundle
   * @throws {Error} If signature is invalid
   */
  async verifyOrReject(signedBundle) {
    this.requireSignature(signedBundle);

    const verified = await this.verifyBundle(signedBundle);

    if (!verified) {
      throw new Error('Bundle signature is invalid. Bundle rejected.');
    }

    return true;
  }
}

// Export for ES6 modules
export default BundleVerifier;

// Export for CommonJS (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BundleVerifier;
}
