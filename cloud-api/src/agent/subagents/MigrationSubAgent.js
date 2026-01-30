/**
 * Migration Sub-Agent
 * Generates forward and reverse database migrations with risk assessment
 */

const BaseSubAgent = require('./BaseSubAgent');
const crypto = require('crypto');

class MigrationSubAgent extends BaseSubAgent {
  constructor(orchestrator, config = {}) {
    super(orchestrator, {
      name: 'Migration',
      tokenBudget: config.tokenBudget || 10000,
      ...config
    });

    this.supportedDatabases = ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'MariaDB', 'SQL Server'];
  }

  /**
   * Execute migration generation task
   * @param {Object} step - Step to execute
   * @param {Object} context - Execution context with schemaChange, existingSchema, database
   * @returns {Promise<Object>} { migrationId, description, sql_forward, sql_reverse, dataLossRisk }
   */
  async execute(step, context = {}) {
    const { id: stepId, target, action, description } = step;

    this.log('info', `Executing migration generation for ${target}`, { stepId });

    // Validate step
    const validation = this.validateTask(step);
    if (!validation.valid) {
      throw new Error(`Invalid task: ${validation.errors.join(', ')}`);
    }

    this.emitProgress({
      type: 'step_start',
      stepId,
      action,
      target
    });

    try {
      // Extract migration parameters
      const schemaChange = context.schemaChange || context.migration || {};
      const existingSchema = context.existingSchema || context.schema || {};
      const database = context.database || this.detectDatabaseType(context);

      this.emitProgress({
        type: 'analyzing_schema',
        stepId,
        database,
        schemaChange: schemaChange.type || 'custom'
      });

      // Generate forward migration
      const sql_forward = await this.generateForwardMigration(schemaChange, existingSchema, database);

      this.emitProgress({
        type: 'forward_generated',
        stepId,
        sqlLength: sql_forward.length
      });

      // Generate reverse migration
      const sql_reverse = await this.generateReverseMigration(schemaChange, existingSchema, database);

      this.emitProgress({
        type: 'reverse_generated',
        stepId,
        sqlLength: sql_reverse.length
      });

      // Validate both migrations
      const forwardValidation = this.validateSQL(sql_forward);
      const reverseValidation = this.validateSQL(sql_reverse);

      if (!forwardValidation.valid) {
        throw new Error(`Forward migration validation failed: ${forwardValidation.errors.join(', ')}`);
      }

      if (!reverseValidation.valid) {
        throw new Error(`Reverse migration validation failed: ${reverseValidation.errors.join(', ')}`);
      }

      // Assess data loss risk
      const dataLossRisk = this.assessDataLoss(sql_forward);

      this.emitProgress({
        type: 'risk_assessed',
        stepId,
        dataLossRisk
      });

      // Generate migration ID
      const migrationId = this.generateMigrationId(description || target);

      this.emitProgress({
        type: 'step_complete',
        stepId,
        migrationId,
        dataLossRisk
      });

      return {
        success: true,
        stepId,
        target,
        action,
        migrationId,
        description: description || `Migration for ${target}`,
        sql_forward,
        sql_reverse,
        dataLossRisk,
        database,
        tokensUsed: this.tokensUsed
      };
    } catch (error) {
      this.log('error', `Migration generation failed for ${target}`, { error: error.message });

      this.emitProgress({
        type: 'step_error',
        stepId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate forward (up) migration SQL
   * @param {Object} schemaChange - Schema change details (type, table, columns, etc.)
   * @param {Object} existingSchema - Current schema state
   * @param {string} database - Database type
   * @returns {Promise<string>} Forward migration SQL
   */
  async generateForwardMigration(schemaChange, existingSchema, database) {
    const systemPrompt = this.getSystemPrompt(database);

    const prompt = `Generate a forward migration SQL for the following schema change.

**Database:** ${database}

**Schema Change:**
${JSON.stringify(schemaChange, null, 2)}

**Existing Schema:**
${JSON.stringify(existingSchema, null, 2)}

**Requirements:**
1. Generate safe, production-ready SQL
2. Use transactions (BEGIN/COMMIT)
3. Include IF EXISTS/IF NOT EXISTS checks where appropriate
4. Add comments explaining each step
5. Follow ${database} best practices
6. Make the migration idempotent when possible

**Instructions:**
- Return ONLY the SQL code, no markdown code blocks
- Include all necessary DDL statements
- Add appropriate indexes if creating tables
- Include data validation constraints

Generate the forward migration SQL:`;

    const response = await this.callAI([
      {
        role: 'user',
        content: prompt
      }
    ], {
      system: systemPrompt
    });

    // Extract SQL (remove markdown if present)
    let sql = response.content.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = sql.match(/```(?:sql)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      sql = codeBlockMatch[1].trim();
    }

    return sql;
  }

  /**
   * Generate reverse (down) migration SQL
   * @param {Object} schemaChange - Schema change details
   * @param {Object} existingSchema - Current schema state
   * @param {string} database - Database type
   * @returns {Promise<string>} Reverse migration SQL
   */
  async generateReverseMigration(schemaChange, existingSchema, database) {
    const systemPrompt = this.getSystemPrompt(database);

    const prompt = `Generate a reverse migration SQL that undoes the following schema change.

**Database:** ${database}

**Schema Change to Undo:**
${JSON.stringify(schemaChange, null, 2)}

**Existing Schema:**
${JSON.stringify(existingSchema, null, 2)}

**Requirements:**
1. Completely reverse the forward migration
2. Restore the schema to its original state
3. Use transactions (BEGIN/COMMIT)
4. Include IF EXISTS/IF NOT EXISTS checks
5. Add comments explaining each step
6. Follow ${database} best practices

**Instructions:**
- Return ONLY the SQL code, no markdown code blocks
- Reverse all DDL statements from forward migration
- If forward creates a table, reverse should drop it
- If forward adds a column, reverse should drop it
- If forward drops something, reverse should recreate it

Generate the reverse migration SQL:`;

    const response = await this.callAI([
      {
        role: 'user',
        content: prompt
      }
    ], {
      system: systemPrompt
    });

    // Extract SQL (remove markdown if present)
    let sql = response.content.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = sql.match(/```(?:sql)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      sql = codeBlockMatch[1].trim();
    }

    return sql;
  }

  /**
   * Assess data loss risk in SQL migration
   * @param {string} sql - SQL to assess
   * @returns {string} Risk level: 'high', 'medium', or 'low'
   */
  assessDataLoss(sql) {
    if (!sql || typeof sql !== 'string') {
      return 'low';
    }

    const sqlUpper = sql.toUpperCase();

    // High risk operations (data loss)
    const highRiskPatterns = [
      'DROP TABLE',
      'DROP DATABASE',
      'DROP SCHEMA',
      'TRUNCATE TABLE',
      'TRUNCATE'
    ];

    for (const pattern of highRiskPatterns) {
      if (sqlUpper.includes(pattern)) {
        return 'high';
      }
    }

    // High risk: DROP COLUMN
    if (sqlUpper.includes('DROP COLUMN')) {
      return 'high';
    }

    // Medium risk operations (potential data loss or modification)
    const mediumRiskPatterns = [
      'ALTER COLUMN',
      'ALTER TABLE',
      'MODIFY COLUMN',
      'CHANGE COLUMN',
      'DELETE FROM'
    ];

    for (const pattern of mediumRiskPatterns) {
      if (sqlUpper.includes(pattern)) {
        // Check if it's an ALTER TYPE operation
        if (sqlUpper.includes('ALTER') && (sqlUpper.includes('TYPE') || sqlUpper.includes('DATA TYPE'))) {
          return 'medium';
        }
        // Other ALTER TABLE operations might be medium risk
        if (sqlUpper.includes('ALTER TABLE') && !sqlUpper.includes('ADD COLUMN')) {
          return 'medium';
        }
      }
    }

    // Low risk operations (additive, no data loss)
    const lowRiskPatterns = [
      'CREATE TABLE',
      'CREATE INDEX',
      'ADD COLUMN',
      'ADD CONSTRAINT',
      'INSERT INTO'
    ];

    for (const pattern of lowRiskPatterns) {
      if (sqlUpper.includes(pattern)) {
        return 'low';
      }
    }

    // Default to medium if we can't determine
    return 'medium';
  }

  /**
   * Validate SQL syntax (basic checks)
   * @param {string} sql - SQL to validate
   * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
   */
  validateSQL(sql) {
    const errors = [];
    const warnings = [];

    // Check if SQL exists
    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      errors.push('SQL is empty');
      return { valid: false, errors, warnings };
    }

    const sqlUpper = sql.toUpperCase();

    // Check for basic SQL keywords
    const hasValidKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'CREATE', 'ALTER', 'DROP',
      'BEGIN', 'COMMIT', 'ROLLBACK'
    ].some(keyword => sqlUpper.includes(keyword));

    if (!hasValidKeywords) {
      errors.push('SQL does not contain any recognized SQL keywords');
    }

    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`);
    }

    // Check for semicolons (should end statements)
    if (!sql.trim().endsWith(';')) {
      warnings.push('SQL does not end with a semicolon');
    }

    // Check for transaction usage with DDL
    const hasDDL = ['CREATE', 'ALTER', 'DROP'].some(keyword => sqlUpper.includes(keyword));
    const hasTransaction = sqlUpper.includes('BEGIN') || sqlUpper.includes('START TRANSACTION');

    if (hasDDL && !hasTransaction) {
      warnings.push('DDL statements should be wrapped in transactions');
    }

    // Check for dangerous operations without safety checks
    const dangerousOps = [
      { op: 'DROP TABLE', safety: 'IF EXISTS' },
      { op: 'DROP DATABASE', safety: 'IF EXISTS' },
      { op: 'TRUNCATE', safety: 'WHERE' },
      { op: 'DELETE FROM', safety: 'WHERE' }
    ];

    for (const { op, safety } of dangerousOps) {
      if (sqlUpper.includes(op) && !sqlUpper.includes(safety)) {
        warnings.push(`Dangerous operation '${op}' without ${safety} check`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get system prompt for migration generation
   * @param {string} database - Database type
   * @returns {string} System prompt
   */
  getSystemPrompt(database) {
    return `You are an expert database migration AI specialized in ${database}.

Your role is to generate safe, production-ready database migrations that:
1. Use transactions to ensure atomicity
2. Include rollback logic for safety
3. Are idempotent (can be run multiple times safely)
4. Follow ${database} best practices
5. Include appropriate indexes and constraints
6. Minimize downtime
7. Protect data integrity

When generating migrations:
- Always use BEGIN/COMMIT for transactions
- Include IF EXISTS/IF NOT EXISTS checks where appropriate
- Add comments explaining each step
- Consider backward compatibility
- Think about data migration if changing column types
- Use appropriate data types for ${database}
- Follow naming conventions

Generate clean, well-structured SQL that a DBA would approve.`;
  }

  /**
   * Detect database type from context
   * @param {Object} context - Context information
   * @returns {string} Database type
   */
  detectDatabaseType(context) {
    if (context.database) {
      return context.database;
    }

    if (context.patterns && context.patterns.databases) {
      const { databases } = context.patterns;
      if (databases && databases.length > 0) {
        return databases[0].name;
      }
    }

    return 'PostgreSQL'; // Default
  }

  /**
   * Generate unique migration ID
   * @param {string} description - Migration description
   * @returns {string} Migration ID (timestamp + hash)
   */
  generateMigrationId(description) {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const hash = crypto.createHash('md5').update(description).digest('hex').slice(0, 6);
    return `${timestamp}_${hash}`;
  }

  /**
   * Get supported database types
   * @returns {Array<string>} Array of database names
   */
  getSupportedDatabases() {
    return this.supportedDatabases;
  }

  /**
   * Get migration type from schema change
   * @param {Object} schemaChange - Schema change details
   * @returns {string} Migration type
   */
  getMigrationType(schemaChange) {
    if (!schemaChange || typeof schemaChange !== 'object') {
      return 'custom';
    }

    const type = schemaChange.type || '';
    const typeMap = {
      'create_table': 'create_table',
      'drop_table': 'drop_table',
      'alter_table': 'alter_table',
      'add_column': 'add_column',
      'drop_column': 'drop_column',
      'rename_column': 'rename_column',
      'change_column_type': 'change_column_type',
      'add_index': 'add_index',
      'drop_index': 'drop_index',
      'add_constraint': 'add_constraint',
      'drop_constraint': 'drop_constraint'
    };

    return typeMap[type] || 'custom';
  }
}

module.exports = MigrationSubAgent;
