/**
 * Migration Reversibility Check
 * Verifies reverse migrations exist and can undo forward migrations
 */
const BaseCheck = require('./BaseCheck');

class MigrationReversibilityCheck extends BaseCheck {
  constructor(config = {}) {
    super({
      name: 'MigrationReversibilityCheck',
      level: 'blocker',
      ...config
    });
  }

  /**
   * Run migration reversibility validation
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Validation result
   */
  async run(bundle) {
    this.logStart();

    const migrations = bundle.migrations || [];

    if (migrations.length === 0) {
      const result = this.success('No migrations to validate', {
        migrationsChecked: 0
      });
      this.logResult(result);
      return result;
    }

    const issues = [];

    for (const migration of migrations) {
      const validation = this.validateMigration(migration);

      if (!validation.reversible) {
        issues.push({
          migrationId: migration.id,
          issues: validation.issues
        });
      }
    }

    // Check results
    if (issues.length > 0) {
      const result = this.failure(
        `${issues.length} migration(s) not reversible`,
        {
          totalMigrations: migrations.length,
          nonReversible: issues.length,
          issues
        }
      );
      this.logResult(result);
      return result;
    }

    const result = this.success(
      `All ${migrations.length} migration(s) are reversible`,
      {
        migrationsChecked: migrations.length
      }
    );
    this.logResult(result);
    return result;
  }

  /**
   * Validate a single migration
   * @param {Object} migration - Migration object
   * @returns {Object} { reversible, issues }
   */
  validateMigration(migration) {
    const issues = [];

    // Check forward SQL exists
    if (!migration.sql_forward || migration.sql_forward.trim().length === 0) {
      issues.push('Missing forward migration SQL');
    }

    // Check reverse SQL exists
    if (!migration.sql_reverse || migration.sql_reverse.trim().length === 0) {
      issues.push('Missing reverse migration SQL');
    }

    // If both exist, check if they're inverse operations
    if (migration.sql_forward && migration.sql_reverse) {
      const inverseCheck = this.checkInverseOperations(
        migration.sql_forward,
        migration.sql_reverse
      );

      if (!inverseCheck.valid) {
        issues.push(...inverseCheck.issues);
      }
    }

    return {
      reversible: issues.length === 0,
      issues
    };
  }

  /**
   * Check if forward and reverse are inverse operations
   * @param {string} forward - Forward SQL
   * @param {string} reverse - Reverse SQL
   * @returns {Object} { valid, issues }
   */
  checkInverseOperations(forward, reverse) {
    const issues = [];

    const forwardOps = this.extractOperations(forward);
    const reverseOps = this.extractOperations(reverse);

    // Check inverse operations
    for (const forwardOp of forwardOps) {
      const hasInverse = this.hasInverseOperation(forwardOp, reverseOps);

      if (!hasInverse) {
        issues.push(`Forward operation '${forwardOp.type} ${forwardOp.target}' has no inverse in reverse migration`);
      }
    }

    // Check for extra operations in reverse
    for (const reverseOp of reverseOps) {
      const hasSource = this.hasInverseOperation(reverseOp, forwardOps);

      if (!hasSource) {
        issues.push(`Reverse operation '${reverseOp.type} ${reverseOp.target}' has no source in forward migration`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Extract SQL operations from SQL string
   * @param {string} sql - SQL string
   * @returns {Array} Array of operations
   */
  extractOperations(sql) {
    const operations = [];
    const upperSQL = sql.toUpperCase();

    // CREATE TABLE
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      operations.push({
        type: 'CREATE TABLE',
        target: match[1].toLowerCase()
      });
    }

    // DROP TABLE
    const dropTableRegex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/gi;

    while ((match = dropTableRegex.exec(sql)) !== null) {
      operations.push({
        type: 'DROP TABLE',
        target: match[1].toLowerCase()
      });
    }

    // ALTER TABLE ADD COLUMN
    const addColumnRegex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?(\w+)/gi;

    while ((match = addColumnRegex.exec(sql)) !== null) {
      operations.push({
        type: 'ADD COLUMN',
        target: `${match[1]}.${match[2]}`.toLowerCase()
      });
    }

    // ALTER TABLE DROP COLUMN
    const dropColumnRegex = /ALTER\s+TABLE\s+(\w+)\s+DROP\s+(?:COLUMN\s+)?(\w+)/gi;

    while ((match = dropColumnRegex.exec(sql)) !== null) {
      operations.push({
        type: 'DROP COLUMN',
        target: `${match[1]}.${match[2]}`.toLowerCase()
      });
    }

    // CREATE INDEX
    const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;

    while ((match = createIndexRegex.exec(sql)) !== null) {
      operations.push({
        type: 'CREATE INDEX',
        target: match[1].toLowerCase()
      });
    }

    // DROP INDEX
    const dropIndexRegex = /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(\w+)/gi;

    while ((match = dropIndexRegex.exec(sql)) !== null) {
      operations.push({
        type: 'DROP INDEX',
        target: match[1].toLowerCase()
      });
    }

    return operations;
  }

  /**
   * Check if an operation has its inverse
   * @param {Object} operation - Operation to check
   * @param {Array} operations - Operations to search
   * @returns {boolean} True if inverse exists
   */
  hasInverseOperation(operation, operations) {
    const inverseMap = {
      'CREATE TABLE': 'DROP TABLE',
      'DROP TABLE': 'CREATE TABLE',
      'ADD COLUMN': 'DROP COLUMN',
      'DROP COLUMN': 'ADD COLUMN',
      'CREATE INDEX': 'DROP INDEX',
      'DROP INDEX': 'CREATE INDEX'
    };

    const inverseType = inverseMap[operation.type];

    if (!inverseType) {
      // Unknown operation type, assume it's fine
      return true;
    }

    // Check if inverse operation exists with same target
    return operations.some(op =>
      op.type === inverseType && op.target === operation.target
    );
  }
}

module.exports = MigrationReversibilityCheck;
