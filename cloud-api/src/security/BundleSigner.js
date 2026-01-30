const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Bundle Signer
 * Handles cryptographic signing and verification of code bundles using RSA-2048
 */
class BundleSigner {
  /**
   * Create a new Bundle Signer
   * @param {Object} config - Configuration
   * @param {string} config.keysPath - Path to store keys (default: ./keys)
   * @param {string} config.keyId - Key identifier (default: 'local-studio-dev')
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.keysPath = config.keysPath || path.join(__dirname, '../../keys');
    this.keyId = config.keyId || 'local-studio-dev';
    this.logger = config.logger || console;

    this.privateKeyPath = path.join(this.keysPath, 'private.pem');
    this.publicKeyPath = path.join(this.keysPath, 'public.pem');

    this.privateKey = null;
    this.publicKey = null;
  }

  /**
   * Initialize signer (load or generate keys)
   * @returns {Promise<void>}
   */
  async initialize() {
    // Ensure keys directory exists
    if (!fs.existsSync(this.keysPath)) {
      fs.mkdirSync(this.keysPath, { recursive: true });
      this.logger.info('Created keys directory', { path: this.keysPath });
    }

    // Check if keys exist
    const privateKeyExists = fs.existsSync(this.privateKeyPath);
    const publicKeyExists = fs.existsSync(this.publicKeyPath);

    if (privateKeyExists && publicKeyExists) {
      // Load existing keys
      await this.loadKeys();
      this.logger.info('Loaded existing keypair', { keyId: this.keyId });
    } else {
      // Generate new keypair
      this.logger.warn('Keypair not found, generating new keypair...', { keyId: this.keyId });
      await this.generateKeyPair();
      this.logger.info('Generated new keypair', { keyId: this.keyId });
    }
  }

  /**
   * Generate RSA-2048 keypair
   * @returns {Promise<Object>} { privateKey, publicKey }
   */
  async generateKeyPair() {
    this.logger.info('Generating RSA-2048 keypair...');

    return new Promise((resolve, reject) => {
      try {
        // Generate RSA keypair (2048 bits)
        forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
          if (err) {
            this.logger.error('Keypair generation failed', { error: err.message });
            return reject(err);
          }

          // Convert to PEM format
          const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
          const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);

          // Save to disk
          fs.writeFileSync(this.privateKeyPath, privateKeyPem, 'utf8');
          fs.writeFileSync(this.publicKeyPath, publicKeyPem, 'utf8');

          // Set permissions (Unix only)
          if (process.platform !== 'win32') {
            fs.chmodSync(this.privateKeyPath, 0o600); // Owner read/write only
            fs.chmodSync(this.publicKeyPath, 0o644); // Owner read/write, others read
          }

          // Store in memory
          this.privateKey = keypair.privateKey;
          this.publicKey = keypair.publicKey;

          this.logger.info('Keypair generated and saved', {
            privateKeyPath: this.privateKeyPath,
            publicKeyPath: this.publicKeyPath
          });

          resolve({
            privateKey: privateKeyPem,
            publicKey: publicKeyPem,
            keyId: this.keyId
          });
        });
      } catch (error) {
        this.logger.error('Keypair generation error', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Load keys from disk
   * @returns {Promise<void>}
   */
  async loadKeys() {
    try {
      const privateKeyPem = fs.readFileSync(this.privateKeyPath, 'utf8');
      const publicKeyPem = fs.readFileSync(this.publicKeyPath, 'utf8');

      this.privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      this.publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

      this.logger.info('Keys loaded from disk');
    } catch (error) {
      this.logger.error('Failed to load keys', { error: error.message });
      throw error;
    }
  }

  /**
   * Sign a bundle
   * @param {Object} bundle - Bundle to sign
   * @returns {Object} Signed bundle with signature
   */
  signBundle(bundle) {
    if (!this.privateKey) {
      throw new Error('Private key not loaded. Call initialize() first.');
    }

    this.logger.info('Signing bundle', { bundle_id: bundle.bundle_id });

    try {
      // Serialize bundle to JSON with sorted keys for determinism
      const bundleJson = this._serializeDeterministic(bundle);

      // Create SHA-256 hash
      const hash = crypto.createHash('sha256').update(bundleJson).digest();

      // Sign hash with private key using forge
      const md = forge.md.sha256.create();
      md.update(hash.toString('binary'));
      const signature = this.privateKey.sign(md);

      // Convert to base64
      const signatureBase64 = forge.util.encode64(signature);

      // Create signed bundle
      const signedBundle = {
        ...bundle,
        signature: {
          algorithm: 'RSA-SHA256',
          value: signatureBase64,
          signed_at: new Date().toISOString(),
          key_id: this.keyId
        }
      };

      this.logger.info('Bundle signed successfully', {
        bundle_id: bundle.bundle_id,
        key_id: this.keyId,
        signature_length: signatureBase64.length
      });

      return signedBundle;
    } catch (error) {
      this.logger.error('Bundle signing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify a signed bundle
   * @param {Object} signedBundle - Signed bundle
   * @param {Object} publicKey - Public key (optional, uses loaded key by default)
   * @returns {boolean} True if signature is valid
   */
  verifyBundle(signedBundle, publicKey = null) {
    const keyToUse = publicKey || this.publicKey;

    if (!keyToUse) {
      throw new Error('Public key not provided or loaded. Call initialize() first.');
    }

    this.logger.info('Verifying bundle signature', { bundle_id: signedBundle.bundle_id });

    try {
      // Check if bundle has signature
      if (!signedBundle.signature) {
        this.logger.warn('Bundle has no signature');
        return false;
      }

      // Extract signature
      const { algorithm, value: signatureBase64, key_id } = signedBundle.signature;

      // Verify algorithm
      if (algorithm !== 'RSA-SHA256') {
        this.logger.warn('Unsupported signature algorithm', { algorithm });
        return false;
      }

      // Create unsigned bundle (remove signature for verification)
      const { signature: _, ...unsignedBundle } = signedBundle;

      // Serialize to JSON with sorted keys
      const bundleJson = this._serializeDeterministic(unsignedBundle);

      // Create SHA-256 hash
      const hash = crypto.createHash('sha256').update(bundleJson).digest();

      // Decode signature from base64
      const signatureBytes = forge.util.decode64(signatureBase64);

      // Verify signature using forge
      const md = forge.md.sha256.create();
      md.update(hash.toString('binary'));

      const verified = keyToUse.verify(md.digest().bytes(), signatureBytes);

      if (verified) {
        this.logger.info('Bundle signature verified', {
          bundle_id: signedBundle.bundle_id,
          key_id
        });
      } else {
        this.logger.warn('Bundle signature verification failed', {
          bundle_id: signedBundle.bundle_id,
          key_id
        });
      }

      return verified;
    } catch (error) {
      this.logger.error('Bundle verification error', { error: error.message });
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
    // Sort keys recursively for deterministic serialization
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
   * Get public key in PEM format
   * @returns {string} Public key PEM
   */
  getPublicKeyPem() {
    if (!this.publicKey) {
      throw new Error('Public key not loaded. Call initialize() first.');
    }

    return forge.pki.publicKeyToPem(this.publicKey);
  }

  /**
   * Load public key from PEM string
   * @param {string} publicKeyPem - Public key in PEM format
   * @returns {Object} Public key object
   */
  loadPublicKeyFromPem(publicKeyPem) {
    try {
      return forge.pki.publicKeyFromPem(publicKeyPem);
    } catch (error) {
      this.logger.error('Failed to load public key from PEM', { error: error.message });
      throw error;
    }
  }

  /**
   * Get key fingerprint (SHA-256 of public key)
   * @returns {string} Fingerprint in hex
   */
  getKeyFingerprint() {
    if (!this.publicKey) {
      throw new Error('Public key not loaded. Call initialize() first.');
    }

    const publicKeyPem = forge.pki.publicKeyToPem(this.publicKey);
    return crypto.createHash('sha256').update(publicKeyPem).digest('hex');
  }

  /**
   * Check if keys are loaded
   * @returns {boolean} True if keys are loaded
   */
  isInitialized() {
    return this.privateKey !== null && this.publicKey !== null;
  }
}

module.exports = BundleSigner;
