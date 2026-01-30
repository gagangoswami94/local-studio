const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Bundle Builder
 * Compiles generated code, tests, and migrations into a complete bundle
 */
class BundleBuilder {
  /**
   * Create a new Bundle Builder
   * @param {Object} config - Configuration
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.logger = config.logger || console;
  }

  /**
   * Compile a complete bundle from generated components
   * @param {Array} files - Generated files [{path, content, action, layer, description}]
   * @param {Array} tests - Generated tests [{path, content, sourceFile, framework, coverage}]
   * @param {Array} migrations - Generated migrations [{id, description, sql_forward, sql_reverse, dataLossRisk}]
   * @param {Object} appSpec - Application specification
   * @param {Object} plan - Implementation plan
   * @param {Object} metadata - Additional metadata {tokensUsed, generationTime, etc.}
   * @returns {Object} Complete bundle
   */
  compileBundle(files, tests, migrations, appSpec, plan, metadata = {}) {
    this.logger.info('Compiling bundle', {
      filesCount: files?.length || 0,
      testsCount: tests?.length || 0,
      migrationsCount: migrations?.length || 0
    });

    const bundle_id = uuidv4();
    const created_at = new Date().toISOString();

    // Process files with checksums
    const processedFiles = this._processFiles(files || []);

    // Process tests
    const processedTests = this._processTests(tests || []);

    // Process migrations
    const processedMigrations = this._processMigrations(migrations || []);

    // Detect required commands
    const commands = this._detectCommands(processedFiles, processedMigrations);

    // Determine bundle type
    const bundle_type = this._determineBundleType(processedFiles);

    // Count file actions
    const filesCreated = processedFiles.filter(f => f.action === 'create').length;
    const filesModified = processedFiles.filter(f => f.action === 'modify').length;
    const filesDeleted = processedFiles.filter(f => f.action === 'delete').length;

    // Compile metadata
    const compiledMetadata = {
      tokensUsed: metadata.tokensUsed || 0,
      generationTime: metadata.generationTime || 0,
      filesCreated,
      filesModified,
      filesDeleted,
      testsGenerated: processedTests.length,
      migrationsGenerated: processedMigrations.length,
      commandsRequired: commands.length,
      ...metadata
    };

    const bundle = {
      bundle_id,
      bundle_type,
      created_at,
      appSpec: appSpec || null,
      plan: plan || null,
      files: processedFiles,
      tests: processedTests,
      migrations: processedMigrations,
      commands,
      metadata: compiledMetadata
    };

    this.logger.info('Bundle compiled successfully', {
      bundle_id,
      bundle_type,
      filesTotal: processedFiles.length,
      testsTotal: processedTests.length,
      migrationsTotal: processedMigrations.length
    });

    return bundle;
  }

  /**
   * Process files and add checksums
   * @param {Array} files - Files to process
   * @returns {Array} Processed files
   * @private
   */
  _processFiles(files) {
    return files.map(file => {
      const checksum = this._calculateChecksum(file.content || '');

      return {
        path: file.path,
        content: file.content || '',
        action: file.action || 'create',
        checksum,
        layer: file.layer || null,
        description: file.description || null,
        size: (file.content || '').length
      };
    });
  }

  /**
   * Process tests
   * @param {Array} tests - Tests to process
   * @returns {Array} Processed tests
   * @private
   */
  _processTests(tests) {
    return tests.map(test => ({
      path: test.path,
      content: test.content || '',
      sourceFile: test.sourceFile || null,
      framework: test.framework || 'vitest',
      coverage: test.coverage || null,
      checksum: this._calculateChecksum(test.content || '')
    }));
  }

  /**
   * Process migrations
   * @param {Array} migrations - Migrations to process
   * @returns {Array} Processed migrations
   * @private
   */
  _processMigrations(migrations) {
    return migrations.map(migration => ({
      id: migration.migrationId || migration.id,
      description: migration.description,
      sql_forward: migration.sql_forward,
      sql_reverse: migration.sql_reverse,
      dataLossRisk: migration.dataLossRisk || 'medium',
      database: migration.database || 'PostgreSQL',
      checksum_forward: this._calculateChecksum(migration.sql_forward || ''),
      checksum_reverse: this._calculateChecksum(migration.sql_reverse || '')
    }));
  }

  /**
   * Detect required commands based on changes
   * @param {Array} files - Processed files
   * @param {Array} migrations - Processed migrations
   * @returns {Array} Commands to run
   * @private
   */
  _detectCommands(files, migrations) {
    const commands = [];

    // Check if package.json was changed
    const packageJsonChanged = files.some(f =>
      f.path.endsWith('package.json') && (f.action === 'create' || f.action === 'modify')
    );

    if (packageJsonChanged) {
      commands.push({
        command: 'npm install',
        when: 'pre-apply',
        description: 'Install dependencies from package.json'
      });
    }

    // Check if migrations are present
    if (migrations.length > 0) {
      // Determine migration command based on database type
      const database = migrations[0]?.database || 'PostgreSQL';
      const migrationCommand = this._getMigrationCommand(database);

      commands.push({
        command: migrationCommand,
        when: 'pre-apply',
        description: 'Run database migrations',
        riskLevel: this._getMigrationRiskLevel(migrations)
      });
    }

    // Check for build requirements
    const hasBuildFiles = files.some(f =>
      f.path.includes('webpack.config') ||
      f.path.includes('vite.config') ||
      f.path.includes('tsconfig.json')
    );

    if (hasBuildFiles) {
      commands.push({
        command: 'npm run build',
        when: 'post-apply',
        description: 'Rebuild application after configuration changes'
      });
    }

    return commands;
  }

  /**
   * Get migration command for database type
   * @param {string} database - Database type
   * @returns {string} Migration command
   * @private
   */
  _getMigrationCommand(database) {
    const commandMap = {
      'PostgreSQL': 'npm run migrate',
      'MySQL': 'npm run migrate',
      'SQLite': 'npm run migrate',
      'MongoDB': 'npm run migrate:mongo',
      'MariaDB': 'npm run migrate',
      'SQL Server': 'npm run migrate:mssql'
    };

    return commandMap[database] || 'npm run migrate';
  }

  /**
   * Get overall risk level for migrations
   * @param {Array} migrations - Migrations array
   * @returns {string} Risk level
   * @private
   */
  _getMigrationRiskLevel(migrations) {
    if (migrations.some(m => m.dataLossRisk === 'high')) {
      return 'high';
    }
    if (migrations.some(m => m.dataLossRisk === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Determine bundle type based on files
   * @param {Array} files - Processed files
   * @returns {string} Bundle type
   * @private
   */
  _determineBundleType(files) {
    const hasCreates = files.some(f => f.action === 'create');
    const hasModifies = files.some(f => f.action === 'modify');
    const hasDeletes = files.some(f => f.action === 'delete');

    // Full bundle: mostly new files (>80% creates)
    const createRatio = files.filter(f => f.action === 'create').length / files.length;
    if (createRatio > 0.8) {
      return 'full';
    }

    // Feature bundle: mix of creates and modifies
    if (hasCreates && hasModifies) {
      return 'feature';
    }

    // Patch bundle: mostly modifies
    if (hasModifies) {
      return 'patch';
    }

    // Cleanup bundle: has deletes
    if (hasDeletes) {
      return 'cleanup';
    }

    return 'patch';
  }

  /**
   * Calculate SHA256 checksum for content
   * @param {string} content - Content to hash
   * @returns {string} Checksum
   * @private
   */
  _calculateChecksum(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Validate bundle structure
   * @param {Object} bundle - Bundle to validate
   * @returns {Object} Validation result {valid, errors, warnings}
   */
  validateBundle(bundle) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!bundle.bundle_id) {
      errors.push('Missing bundle_id');
    }
    if (!bundle.bundle_type) {
      errors.push('Missing bundle_type');
    }
    if (!bundle.created_at) {
      errors.push('Missing created_at');
    }
    if (!bundle.files || !Array.isArray(bundle.files)) {
      errors.push('Missing or invalid files array');
    }

    // Check files
    if (bundle.files && bundle.files.length === 0) {
      warnings.push('Bundle contains no files');
    }

    if (bundle.files) {
      bundle.files.forEach((file, idx) => {
        if (!file.path) {
          errors.push(`File ${idx} missing path`);
        }
        if (!file.action) {
          errors.push(`File ${idx} missing action`);
        }
        if (!file.checksum) {
          warnings.push(`File ${idx} missing checksum`);
        }
      });
    }

    // Check migrations
    if (bundle.migrations && bundle.migrations.length > 0) {
      bundle.migrations.forEach((migration, idx) => {
        if (!migration.sql_forward) {
          errors.push(`Migration ${idx} missing sql_forward`);
        }
        if (!migration.sql_reverse) {
          errors.push(`Migration ${idx} missing sql_reverse`);
        }
        if (migration.dataLossRisk === 'high') {
          warnings.push(`Migration ${idx} has high data loss risk`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get bundle summary
   * @param {Object} bundle - Bundle to summarize
   * @returns {Object} Summary
   */
  getBundleSummary(bundle) {
    return {
      bundle_id: bundle.bundle_id,
      bundle_type: bundle.bundle_type,
      created_at: bundle.created_at,
      files: {
        total: bundle.files?.length || 0,
        created: bundle.metadata?.filesCreated || 0,
        modified: bundle.metadata?.filesModified || 0,
        deleted: bundle.metadata?.filesDeleted || 0
      },
      tests: {
        total: bundle.tests?.length || 0
      },
      migrations: {
        total: bundle.migrations?.length || 0,
        highRisk: bundle.migrations?.filter(m => m.dataLossRisk === 'high').length || 0
      },
      commands: {
        total: bundle.commands?.length || 0,
        preApply: bundle.commands?.filter(c => c.when === 'pre-apply').length || 0,
        postApply: bundle.commands?.filter(c => c.when === 'post-apply').length || 0
      },
      metadata: bundle.metadata || {}
    };
  }
}

module.exports = BundleBuilder;
