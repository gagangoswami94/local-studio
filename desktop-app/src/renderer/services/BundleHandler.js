/**
 * Bundle Handler
 * Handles bundle verification, unpacking, and change summary generation
 */

// Embedded public key for bundle verification
// In production, this would be embedded at build time from the signing key
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`;

/**
 * Verify Bundle Signature
 * Uses Web Crypto API to verify RSA-SHA256 signature
 *
 * @param {Object} bundle - Bundle to verify
 * @returns {Promise<boolean>} True if signature is valid
 */
export const verifyBundle = async (bundle) => {
  try {
    // Check if bundle has signature
    if (!bundle.signature) {
      console.error('[BundleVerifier] Bundle has no signature');
      return false;
    }

    const { algorithm, value, keyId, timestamp } = bundle.signature;

    // Check signature algorithm
    if (algorithm !== 'RSA-SHA256') {
      console.error(`[BundleVerifier] Unsupported algorithm: ${algorithm}`);
      return false;
    }

    // Check signature timestamp (not too old)
    const signatureAge = Date.now() - new Date(timestamp).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (signatureAge > maxAge) {
      console.error(`[BundleVerifier] Signature is too old: ${Math.floor(signatureAge / (24 * 60 * 60 * 1000))} days`);
      return false;
    }

    // Remove signature from bundle for verification
    const { signature: _, ...unsignedBundle } = bundle;

    // Serialize bundle (deterministic JSON)
    const bundleJson = serializeDeterministic(unsignedBundle);

    // Convert to bytes
    const encoder = new TextEncoder();
    const bundleBytes = encoder.encode(bundleJson);

    // Decode signature from base64
    const signatureBytes = base64ToArrayBuffer(value);

    // Import public key
    const publicKey = await importPublicKey(PUBLIC_KEY_PEM);

    // Verify signature
    const isValid = await crypto.subtle.verify(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      publicKey,
      signatureBytes,
      bundleBytes
    );

    if (isValid) {
      console.log(`[BundleVerifier] ✓ Bundle signature valid (keyId: ${keyId})`);
    } else {
      console.error('[BundleVerifier] ✗ Bundle signature invalid');
    }

    return isValid;

  } catch (error) {
    console.error('[BundleVerifier] Verification failed:', error);
    return false;
  }
};

/**
 * Serialize object deterministically (sorted keys)
 */
const serializeDeterministic = (obj) => {
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    return '[' + obj.map(serializeDeterministic).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => {
    return JSON.stringify(key) + ':' + serializeDeterministic(obj[key]);
  });

  return '{' + pairs.join(',') + '}';
};

/**
 * Convert base64 to ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Import RSA public key from PEM
 */
const importPublicKey = async (pemKey) => {
  // Remove PEM header/footer
  const pemContents = pemKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  // Decode base64
  const binaryKey = base64ToArrayBuffer(pemContents);

  // Import key
  return await crypto.subtle.importKey(
    'spki',
    binaryKey,
    {
      name: 'RSA-PSS',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
};

/**
 * Unpack Bundle
 * Extract files from bundle and prepare for application
 *
 * @param {Object} bundle - Bundle to unpack
 * @returns {Object} { files, tests, migrations, commands }
 */
export const unpackBundle = (bundle) => {
  const unpacked = {
    files: [],
    tests: [],
    migrations: [],
    commands: []
  };

  try {
    // Extract files
    if (bundle.files && Array.isArray(bundle.files)) {
      unpacked.files = bundle.files.map(file => ({
        path: file.path,
        content: file.content,
        action: file.action || 'create',
        checksum: file.checksum,
        layer: file.layer,
        description: file.description
      }));
    }

    // Extract tests
    if (bundle.tests && Array.isArray(bundle.tests)) {
      unpacked.tests = bundle.tests.map(test => ({
        path: test.path,
        content: test.content,
        sourceFile: test.sourceFile,
        framework: test.framework || 'vitest'
      }));
    }

    // Extract migrations
    if (bundle.migrations && Array.isArray(bundle.migrations)) {
      unpacked.migrations = bundle.migrations.map(migration => ({
        id: migration.migrationId || migration.id,
        description: migration.description,
        sql_forward: migration.sql_forward,
        sql_reverse: migration.sql_reverse,
        dataLossRisk: migration.dataLossRisk || 'none',
        database: migration.database || 'sqlite'
      }));
    }

    // Extract commands
    if (bundle.commands && Array.isArray(bundle.commands)) {
      unpacked.commands = bundle.commands.map(cmd => ({
        command: cmd,
        description: getCommandDescription(cmd)
      }));
    }

    console.log('[BundleHandler] Unpacked bundle:', {
      files: unpacked.files.length,
      tests: unpacked.tests.length,
      migrations: unpacked.migrations.length,
      commands: unpacked.commands.length
    });

    return unpacked;

  } catch (error) {
    console.error('[BundleHandler] Failed to unpack bundle:', error);
    throw new Error(`Bundle unpacking failed: ${error.message}`);
  }
};

/**
 * Get human-readable description for command
 */
const getCommandDescription = (command) => {
  if (command.startsWith('npm install')) {
    const pkg = command.replace('npm install', '').trim();
    return `Install ${pkg} package`;
  }
  if (command.startsWith('npm run')) {
    return `Run ${command.replace('npm run', '').trim()} script`;
  }
  if (command.includes('migrate')) {
    return 'Run database migrations';
  }
  return command;
};

/**
 * Get Change Summary
 * Generate human-readable summary of bundle changes
 *
 * @param {Object} bundle - Bundle to summarize
 * @returns {Object} Change summary
 */
export const getChangeSummary = (bundle) => {
  const summary = {
    overview: '',
    statistics: {
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      testsAdded: 0,
      migrationsAdded: 0
    },
    changes: [],
    warnings: [],
    risks: []
  };

  try {
    // Count changes
    const filesByAction = {
      create: [],
      update: [],
      delete: []
    };

    if (bundle.files) {
      bundle.files.forEach(file => {
        const action = file.action || 'create';
        filesByAction[action].push(file);
        summary.statistics.filesChanged++;

        // Estimate lines changed
        const lines = (file.content || '').split('\n').length;
        if (action === 'create') {
          summary.statistics.linesAdded += lines;
        } else if (action === 'update') {
          summary.statistics.linesAdded += Math.floor(lines * 0.3); // Estimate
        } else if (action === 'delete') {
          summary.statistics.linesRemoved += lines;
        }
      });
    }

    summary.statistics.testsAdded = bundle.tests?.length || 0;
    summary.statistics.migrationsAdded = bundle.migrations?.length || 0;

    // Generate overview
    const parts = [];
    if (filesByAction.create.length > 0) {
      parts.push(`creates ${filesByAction.create.length} file(s)`);
    }
    if (filesByAction.update.length > 0) {
      parts.push(`updates ${filesByAction.update.length} file(s)`);
    }
    if (filesByAction.delete.length > 0) {
      parts.push(`deletes ${filesByAction.delete.length} file(s)`);
    }
    if (summary.statistics.testsAdded > 0) {
      parts.push(`adds ${summary.statistics.testsAdded} test(s)`);
    }
    if (summary.statistics.migrationsAdded > 0) {
      parts.push(`includes ${summary.statistics.migrationsAdded} migration(s)`);
    }

    summary.overview = 'This bundle ' + (parts.length > 0 ? parts.join(', ') : 'makes no changes');

    // List changes by category
    summary.changes = [
      {
        category: 'New Files',
        items: filesByAction.create.map(f => ({ path: f.path, description: f.description }))
      },
      {
        category: 'Updated Files',
        items: filesByAction.update.map(f => ({ path: f.path, description: f.description }))
      },
      {
        category: 'Deleted Files',
        items: filesByAction.delete.map(f => ({ path: f.path, description: f.description }))
      }
    ].filter(cat => cat.items.length > 0);

    // Extract warnings from validation
    if (bundle.validation && bundle.validation.warnings) {
      summary.warnings = bundle.validation.warnings.map(w => ({
        check: w.check,
        message: w.message
      }));
    }

    // Assess risks
    if (summary.statistics.migrationsAdded > 0) {
      summary.risks.push({
        level: 'medium',
        message: 'Database migrations present - backup your database before applying'
      });
    }

    if (summary.statistics.filesChanged > 10) {
      summary.risks.push({
        level: 'medium',
        message: 'Large number of files changed - review carefully before applying'
      });
    }

    if (filesByAction.delete.length > 0) {
      summary.risks.push({
        level: 'low',
        message: 'Files will be deleted - ensure they are not referenced elsewhere'
      });
    }

    // Check for critical file changes
    const criticalFiles = ['package.json', 'tsconfig.json', 'vite.config', 'webpack.config'];
    const hasCriticalChanges = bundle.files?.some(f =>
      criticalFiles.some(cf => f.path.includes(cf))
    );

    if (hasCriticalChanges) {
      summary.risks.push({
        level: 'high',
        message: 'Critical configuration files will be modified - test thoroughly'
      });
    }

    return summary;

  } catch (error) {
    console.error('[BundleHandler] Failed to generate summary:', error);
    return {
      overview: 'Unable to generate summary',
      statistics: summary.statistics,
      changes: [],
      warnings: [],
      risks: [{ level: 'high', message: 'Error generating summary - review bundle carefully' }]
    };
  }
};

/**
 * Validate Bundle Structure
 * Check that bundle has all required fields
 *
 * @param {Object} bundle - Bundle to validate
 * @returns {Object} { valid, errors }
 */
export const validateBundleStructure = (bundle) => {
  const errors = [];

  if (!bundle) {
    errors.push('Bundle is null or undefined');
    return { valid: false, errors };
  }

  // Required fields
  if (!bundle.bundle_id) errors.push('Missing bundle_id');
  if (!bundle.bundle_type) errors.push('Missing bundle_type');
  if (!bundle.created_at) errors.push('Missing created_at');

  // Arrays should exist
  if (!Array.isArray(bundle.files)) errors.push('files must be an array');
  if (!Array.isArray(bundle.tests)) errors.push('tests must be an array');
  if (!Array.isArray(bundle.migrations)) errors.push('migrations must be an array');

  return {
    valid: errors.length === 0,
    errors
  };
};

export default {
  verifyBundle,
  unpackBundle,
  getChangeSummary,
  validateBundleStructure
};
