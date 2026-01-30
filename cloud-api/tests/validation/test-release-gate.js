/**
 * Tests for Release Gate
 */

const assert = require('assert');
const ReleaseGate = require('../../src/agent/validation/ReleaseGate');

console.log('Testing Release Gate...\n');

// Mock logger
const mockLogger = {
  info: (msg, meta) => {}, // Silent in tests
  error: (msg, meta) => {},
  warn: (msg, meta) => {}
};

// Test 1: Create Release Gate
console.log('Test 1: Create Release Gate');
(() => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    assert(gate, 'Should create ReleaseGate');
    assert(typeof gate.runAll === 'function', 'Should have runAll method');
    assert(typeof gate.getChecks === 'function', 'Should have getChecks method');

    const checks = gate.getChecks();
    assert(checks.length === 6, 'Should have 6 default checks');

    console.log('✓ ReleaseGate created successfully');
    console.log(`  Checks: ${checks.map(c => c.name).join(', ')}`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Valid Bundle Passes
console.log('Test 2: Valid Bundle Passes');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger, coverageThreshold: 50 });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        {
          path: 'src/app.js',
          content: 'export function hello() { return "world"; }',
          action: 'create'
        }
      ],
      tests: [
        {
          path: 'src/__tests__/app.test.js',
          content: 'import { hello } from "../app"; test("hello", () => {});',
          sourceFile: 'src/app.js'
        }
      ],
      migrations: [],
      commands: [],
      metadata: { tokensUsed: 1000 }
    };

    const result = await gate.runAll(bundle);

    assert(result.passed === true, 'Valid bundle should pass');
    assert(result.blockers.length === 0, 'Should have no blockers');

    console.log('✓ Valid bundle passed all checks');
    console.log(`  Checks passed: ${result.report.passedChecks}/${result.report.totalChecks}`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Syntax Error Blocks
console.log('Test 3: Syntax Error Blocks');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        {
          path: 'src/bad.js',
          content: 'function test() { return // incomplete',
          action: 'create'
        }
      ],
      tests: [],
      migrations: []
    };

    const result = await gate.runAll(bundle);

    assert(result.passed === false, 'Bundle with syntax error should fail');
    assert(result.blockers.length > 0, 'Should have blockers');
    assert(result.blockers.some(b => b.check === 'SyntaxCheck'), 'Should have SyntaxCheck blocker');

    console.log('✓ Syntax error detected and blocked');
    console.log(`  Blockers: ${result.blockers.length}`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Schema Error Blocks
console.log('Test 4: Schema Error Blocks');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    const bundle = {
      // Missing required fields
      files: []
    };

    const result = await gate.runAll(bundle);

    assert(result.passed === false, 'Bundle with schema error should fail');
    assert(result.blockers.some(b => b.check === 'SchemaCheck'), 'Should have SchemaCheck blocker');

    console.log('✓ Schema error detected and blocked');
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Low Test Coverage Blocks
console.log('Test 5: Low Test Coverage Blocks');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger, coverageThreshold: 100 });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        {
          path: 'src/app.js',
          content: 'export function hello() {}',
          action: 'create'
        },
        {
          path: 'src/utils.js',
          content: 'export function utils() {}',
          action: 'create'
        }
      ],
      tests: [
        {
          path: 'src/__tests__/app.test.js',
          content: 'test("hello", () => {});',
          sourceFile: 'src/app.js'
        }
      ],
      migrations: []
    };

    const result = await gate.runAll(bundle);

    assert(result.passed === false, 'Bundle with low coverage should fail');
    assert(result.blockers.some(b => b.check === 'TestCoverageCheck'), 'Should have TestCoverageCheck blocker');

    console.log('✓ Low test coverage detected and blocked');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Security Check Warning (Doesn't Block)
console.log('Test 6: Security Check Warning (Doesn\'t Block)');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger, coverageThreshold: 50 });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        {
          path: 'src/dangerous.js',
          content: 'const code = "alert(1)"; eval(code);', // Has eval()
          action: 'create'
        }
      ],
      tests: [
        {
          path: 'src/__tests__/dangerous.test.js',
          content: 'test("test", () => {});',
          sourceFile: 'src/dangerous.js'
        }
      ],
      migrations: []
    };

    const result = await gate.runAll(bundle);

    // Security check is warning level, shouldn't block
    assert(result.passed === true, 'Security warnings should not block');
    assert(result.warnings.length > 0, 'Should have warnings');
    assert(result.warnings.some(w => w.check === 'SecurityCheck'), 'Should have SecurityCheck warning');

    console.log('✓ Security warning detected (did not block)');
    console.log(`  Warnings: ${result.warnings.length}`);
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Non-Reversible Migration Blocks
console.log('Test 7: Non-Reversible Migration Blocks');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [],
      tests: [],
      migrations: [
        {
          id: '001',
          description: 'Create users table',
          sql_forward: 'CREATE TABLE users (id INT);',
          sql_reverse: '' // Missing reverse migration
        }
      ]
    };

    const result = await gate.runAll(bundle);

    assert(result.passed === false, 'Bundle with non-reversible migration should fail');
    assert(result.blockers.some(b => b.check === 'MigrationReversibilityCheck'), 'Should have MigrationReversibilityCheck blocker');

    console.log('✓ Non-reversible migration detected and blocked');
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Reversible Migration Passes
console.log('Test 8: Reversible Migration Passes');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [],
      tests: [],
      migrations: [
        {
          id: '001',
          description: 'Create users table',
          sql_forward: 'CREATE TABLE users (id INT);',
          sql_reverse: 'DROP TABLE users;'
        }
      ]
    };

    const result = await gate.runAll(bundle);

    assert(result.passed === true, 'Bundle with reversible migration should pass');

    console.log('✓ Reversible migration passed');
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Generate Summary
console.log('Test 9: Generate Summary');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        {
          path: 'src/bad.js',
          content: 'function bad() { // incomplete',
          action: 'create'
        }
      ],
      tests: [],
      migrations: []
    };

    const result = await gate.runAll(bundle);
    const summary = gate.generateSummary(result);

    assert(typeof summary === 'string', 'Summary should be string');
    assert(summary.includes('Release Gate Validation Report'), 'Should have title');
    assert(summary.includes('FAILED'), 'Should show failed status');
    assert(summary.includes('BLOCKERS'), 'Should show blockers section');

    console.log('✓ Summary generated');
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Run Specific Check
console.log('Test 10: Run Specific Check');
(async () => {
  try {
    const gate = new ReleaseGate({ logger: mockLogger });

    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [],
      tests: [],
      migrations: []
    };

    const result = await gate.runCheck('SchemaCheck', bundle);

    assert(result.passed !== undefined, 'Should return result');
    assert(typeof result.message === 'string', 'Should have message');

    console.log('✓ Specific check run successfully');
    console.log(`  Result: ${result.passed ? 'passed' : 'failed'}`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  console.log('========================================');
  console.log('All Release Gate Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Tests Summary:');
  console.log('1. ✓ ReleaseGate creation');
  console.log('2. ✓ Valid bundle passes all checks');
  console.log('3. ✓ Syntax error blocks release');
  console.log('4. ✓ Schema error blocks release');
  console.log('5. ✓ Low test coverage blocks release');
  console.log('6. ✓ Security warnings don\'t block');
  console.log('7. ✓ Non-reversible migration blocks');
  console.log('8. ✓ Reversible migration passes');
  console.log('9. ✓ Summary generation');
  console.log('10. ✓ Run specific check');
  console.log('\nAll 10 tests passing!');
}, 1000);
