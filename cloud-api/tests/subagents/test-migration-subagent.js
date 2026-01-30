/**
 * Tests for Enhanced MigrationSubAgent
 */

const assert = require('assert');
const MigrationSubAgent = require('../../src/agent/subagents/MigrationSubAgent');

console.log('Testing Enhanced MigrationSubAgent...\n');

// Mock orchestrator
const mockOrchestrator = {
  logger: {
    info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || '')
  }
};

// Test 1: Agent Initialization
console.log('Test 1: Agent Initialization');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    assert(agent.name === 'Migration', 'Agent name should be "Migration"');
    assert(agent.tokenBudget === 10000, 'Default token budget should be 10000');
    assert(agent.tokensUsed === 0, 'Initial tokens used should be 0');
    assert(typeof agent.execute === 'function', 'Should have execute method');
    assert(typeof agent.generateForwardMigration === 'function', 'Should have generateForwardMigration method');
    assert(typeof agent.generateReverseMigration === 'function', 'Should have generateReverseMigration method');
    assert(typeof agent.assessDataLoss === 'function', 'Should have assessDataLoss method');
    assert(typeof agent.validateSQL === 'function', 'Should have validateSQL method');

    console.log('✓ Agent initialized correctly');
    console.log(`  Name: ${agent.name}`);
    console.log(`  Token Budget: ${agent.tokenBudget}`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Custom Token Budget
console.log('Test 2: Custom Token Budget');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator, { tokenBudget: 5000 });

    assert(agent.tokenBudget === 5000, 'Should use custom token budget');

    console.log('✓ Custom token budget works');
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Detect Database Type
console.log('Test 3: Detect Database Type');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    // From context.database
    const db1 = agent.detectDatabaseType({ database: 'MySQL' });
    assert(db1 === 'MySQL', 'Should detect from context.database');

    // From context.patterns.databases
    const db2 = agent.detectDatabaseType({
      patterns: {
        databases: [{ name: 'SQLite', version: '3.0' }]
      }
    });
    assert(db2 === 'SQLite', 'Should detect from context.patterns.databases');

    // Default
    const db3 = agent.detectDatabaseType({});
    assert(db3 === 'PostgreSQL', 'Should default to PostgreSQL');

    console.log('✓ Database type detection works');
    console.log(`  MySQL: ${db1}`);
    console.log(`  SQLite: ${db2}`);
    console.log(`  Default: ${db3}`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Assess Data Loss - High Risk
console.log('Test 4: Assess Data Loss - High Risk');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const risk1 = agent.assessDataLoss('DROP TABLE users;');
    assert(risk1 === 'high', 'DROP TABLE should be high risk');

    const risk2 = agent.assessDataLoss('ALTER TABLE users DROP COLUMN email;');
    assert(risk2 === 'high', 'DROP COLUMN should be high risk');

    const risk3 = agent.assessDataLoss('TRUNCATE TABLE sessions;');
    assert(risk3 === 'high', 'TRUNCATE should be high risk');

    const risk4 = agent.assessDataLoss('DROP DATABASE myapp;');
    assert(risk4 === 'high', 'DROP DATABASE should be high risk');

    console.log('✓ High risk operations detected');
    console.log('  DROP TABLE → high');
    console.log('  DROP COLUMN → high');
    console.log('  TRUNCATE → high');
    console.log('  DROP DATABASE → high');
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Assess Data Loss - Medium Risk
console.log('Test 5: Assess Data Loss - Medium Risk');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const risk1 = agent.assessDataLoss('ALTER TABLE users ALTER COLUMN age TYPE VARCHAR(10);');
    assert(risk1 === 'medium', 'ALTER TYPE should be medium risk');

    const risk2 = agent.assessDataLoss('ALTER TABLE users MODIFY COLUMN status;');
    assert(risk2 === 'medium', 'MODIFY COLUMN should be medium risk');

    console.log('✓ Medium risk operations detected');
    console.log('  ALTER TYPE → medium');
    console.log('  MODIFY COLUMN → medium');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Assess Data Loss - Low Risk
console.log('Test 6: Assess Data Loss - Low Risk');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const risk1 = agent.assessDataLoss('CREATE TABLE users (id INT PRIMARY KEY);');
    assert(risk1 === 'low', 'CREATE TABLE should be low risk');

    const risk2 = agent.assessDataLoss('ALTER TABLE users ADD COLUMN email VARCHAR(255);');
    assert(risk2 === 'low', 'ADD COLUMN should be low risk');

    const risk3 = agent.assessDataLoss('CREATE INDEX idx_email ON users(email);');
    assert(risk3 === 'low', 'CREATE INDEX should be low risk');

    console.log('✓ Low risk operations detected');
    console.log('  CREATE TABLE → low');
    console.log('  ADD COLUMN → low');
    console.log('  CREATE INDEX → low');
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Validate SQL - Valid SQL
console.log('Test 7: Validate SQL - Valid SQL');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const sql = `BEGIN;
CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255)
);
COMMIT;`;

    const result = agent.validateSQL(sql);

    assert(result.valid === true, 'Should be valid SQL');
    assert(result.errors.length === 0, 'Should have no errors');

    console.log('✓ Valid SQL accepted');
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Validate SQL - Empty SQL
console.log('Test 8: Validate SQL - Empty SQL');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const result = agent.validateSQL('');

    assert(result.valid === false, 'Empty SQL should be invalid');
    assert(result.errors.length > 0, 'Should have errors');
    assert(result.errors[0] === 'SQL is empty', 'Should report empty SQL');

    console.log('✓ Empty SQL rejected');
    console.log(`  Error: ${result.errors[0]}`);
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Validate SQL - No Keywords
console.log('Test 9: Validate SQL - No Keywords');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const result = agent.validateSQL('hello world;');

    assert(result.valid === false, 'Should reject non-SQL text');
    assert(result.errors.some(e => e.includes('SQL keywords')), 'Should report missing keywords');

    console.log('✓ Non-SQL text rejected');
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Validate SQL - Unbalanced Parentheses
console.log('Test 10: Validate SQL - Unbalanced Parentheses');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const result = agent.validateSQL('CREATE TABLE users (id INT;');

    assert(result.valid === false, 'Should reject unbalanced parentheses');
    assert(result.errors.some(e => e.includes('Unbalanced parentheses')), 'Should report unbalanced parentheses');

    console.log('✓ Unbalanced parentheses detected');
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Validate SQL - Warnings for Dangerous Ops
console.log('Test 11: Validate SQL - Warnings for Dangerous Operations');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const result = agent.validateSQL('DROP TABLE users;');

    assert(result.valid === true, 'Should be valid but with warnings');
    assert(result.warnings.some(w => w.includes('DROP TABLE')), 'Should warn about DROP TABLE without IF EXISTS');

    console.log('✓ Dangerous operations warned');
    console.log(`  Warnings: ${result.warnings.length}`);
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Generate Migration ID
console.log('Test 12: Generate Migration ID');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const id1 = agent.generateMigrationId('Create users table');
    const id2 = agent.generateMigrationId('Create users table');
    const id3 = agent.generateMigrationId('Create posts table');

    assert(typeof id1 === 'string', 'Should return string');
    assert(id1.length > 0, 'Should not be empty');
    assert(id1.includes('_'), 'Should contain underscore separator');

    // Same description should generate same hash part
    const hash1 = id1.split('_')[1];
    const hash2 = id2.split('_')[1];
    assert(hash1 === hash2, 'Same description should have same hash');

    // Different description should have different hash
    const hash3 = id3.split('_')[1];
    assert(hash1 !== hash3, 'Different description should have different hash');

    console.log('✓ Migration ID generation works');
    console.log(`  ID 1: ${id1}`);
    console.log(`  ID 2: ${id2}`);
    console.log(`  ID 3: ${id3}`);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Test 13: Get System Prompt
console.log('Test 13: Get System Prompt');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const prompt1 = agent.getSystemPrompt('PostgreSQL');
    const prompt2 = agent.getSystemPrompt('MySQL');

    assert(typeof prompt1 === 'string', 'Should return string');
    assert(prompt1.includes('PostgreSQL'), 'Should mention database type');
    assert(prompt1.includes('migration'), 'Should mention migrations');
    assert(prompt1.includes('transaction'), 'Should mention transactions');

    assert(prompt2.includes('MySQL'), 'Should mention MySQL');
    assert(prompt1 !== prompt2, 'Different databases should have different prompts');

    console.log('✓ System prompt generation works');
    console.log(`  PostgreSQL prompt: ${prompt1.substring(0, 50)}...`);
    console.log(`  MySQL prompt: ${prompt2.substring(0, 50)}...`);
    console.log('✓ Test 13 passed\n');
  } catch (error) {
    console.error('✗ Test 13 failed:', error.message);
    process.exit(1);
  }
})();

// Test 14: Get Migration Type
console.log('Test 14: Get Migration Type');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const type1 = agent.getMigrationType({ type: 'create_table' });
    assert(type1 === 'create_table', 'Should detect create_table');

    const type2 = agent.getMigrationType({ type: 'drop_column' });
    assert(type2 === 'drop_column', 'Should detect drop_column');

    const type3 = agent.getMigrationType({ type: 'add_index' });
    assert(type3 === 'add_index', 'Should detect add_index');

    const type4 = agent.getMigrationType({});
    assert(type4 === 'custom', 'Should default to custom');

    const type5 = agent.getMigrationType({ type: 'unknown_type' });
    assert(type5 === 'custom', 'Should default to custom for unknown types');

    console.log('✓ Migration type detection works');
    console.log('  create_table → create_table');
    console.log('  drop_column → drop_column');
    console.log('  add_index → add_index');
    console.log('  {} → custom');
    console.log('✓ Test 14 passed\n');
  } catch (error) {
    console.error('✗ Test 14 failed:', error.message);
    process.exit(1);
  }
})();

// Test 15: Get Supported Databases
console.log('Test 15: Get Supported Databases');
(() => {
  try {
    const agent = new MigrationSubAgent(mockOrchestrator);

    const databases = agent.getSupportedDatabases();

    assert(Array.isArray(databases), 'Should return array');
    assert(databases.length > 0, 'Should have databases');
    assert(databases.includes('PostgreSQL'), 'Should include PostgreSQL');
    assert(databases.includes('MySQL'), 'Should include MySQL');
    assert(databases.includes('SQLite'), 'Should include SQLite');

    console.log('✓ Supported databases list retrieved');
    console.log(`  Count: ${databases.length}`);
    console.log(`  Databases: ${databases.join(', ')}`);
    console.log('✓ Test 15 passed\n');
  } catch (error) {
    console.error('✗ Test 15 failed:', error.message);
    process.exit(1);
  }
})();

// Summary
console.log('========================================');
console.log('All Enhanced MigrationSubAgent Tests Passed! ✓');
console.log('========================================\n');
console.log('Tests Summary:');
console.log('1. ✓ Agent initialization (name: Migration, budget: 10000)');
console.log('2. ✓ Custom token budget');
console.log('3. ✓ Database type detection (MySQL, SQLite, PostgreSQL)');
console.log('4. ✓ Data loss assessment - high risk (DROP TABLE, DROP COLUMN, TRUNCATE)');
console.log('5. ✓ Data loss assessment - medium risk (ALTER TYPE, MODIFY COLUMN)');
console.log('6. ✓ Data loss assessment - low risk (CREATE TABLE, ADD COLUMN, CREATE INDEX)');
console.log('7. ✓ SQL validation - valid SQL');
console.log('8. ✓ SQL validation - empty SQL');
console.log('9. ✓ SQL validation - no keywords');
console.log('10. ✓ SQL validation - unbalanced parentheses');
console.log('11. ✓ SQL validation - dangerous operations warning');
console.log('12. ✓ Migration ID generation');
console.log('13. ✓ System prompt generation');
console.log('14. ✓ Migration type detection');
console.log('15. ✓ Supported databases list');
console.log('\nAll 15 tests passing!');
