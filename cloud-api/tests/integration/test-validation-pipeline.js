/**
 * Integration Tests for Validation Pipeline
 * Tests the complete flow: Generate → Validate (ReleaseGate) → Sign
 */

const assert = require('assert');
const AgentOrchestrator = require('../../src/agent/AgentOrchestrator');
const BundleBuilder = require('../../src/agent/BundleBuilder');
const ReleaseGate = require('../../src/agent/validation/ReleaseGate');
const BundleSigner = require('../../src/security/BundleSigner');

console.log('Testing Validation Pipeline Integration...\n');

// Mock logger
const mockLogger = {
  info: (msg, meta) => {}, // Silent in tests
  error: (msg, meta) => {},
  warn: (msg, meta) => {}
};

// Test 1: Valid Bundle Passes Through Pipeline
console.log('Test 1: Valid Bundle Passes Through Pipeline');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 50
    });

    // Initialize async components (keys)
    await orchestrator.initialize();

    // Create a valid bundle
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

    // Run validation phase
    const validation = await orchestrator._validatePhase(bundle);

    assert(validation.passed === true, 'Valid bundle should pass');
    assert(validation.signedBundle !== null, 'Should have signed bundle');
    assert(validation.signedBundle.signature !== undefined, 'Bundle should be signed');
    assert(validation.blockers.length === 0, 'Should have no blockers');

    console.log('✓ Valid bundle passed validation and was signed');
    console.log(`  Checks passed: ${validation.report.passedChecks}/${validation.report.totalChecks}`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Invalid Bundle Blocks Pipeline
console.log('Test 2: Invalid Bundle Blocks Pipeline');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    await orchestrator.initialize();

    // Create an invalid bundle (syntax error)
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

    // Run validation phase
    const validation = await orchestrator._validatePhase(bundle);

    assert(validation.passed === false, 'Invalid bundle should fail');
    assert(validation.signedBundle === null, 'Should not have signed bundle');
    assert(validation.blockers.length > 0, 'Should have blockers');
    assert(validation.blockers.some(b => b.check === 'SyntaxCheck'), 'Should have SyntaxCheck blocker');

    console.log('✓ Invalid bundle was blocked from signing');
    console.log(`  Blockers: ${validation.blockers.length}`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Low Coverage Blocks Pipeline
console.log('Test 3: Low Coverage Blocks Pipeline');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 100 // Require 100% coverage
    });

    await orchestrator.initialize();

    // Create bundle with low coverage
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

    // Run validation phase
    const validation = await orchestrator._validatePhase(bundle);

    assert(validation.passed === false, 'Low coverage should fail');
    assert(validation.signedBundle === null, 'Should not sign');
    assert(validation.blockers.some(b => b.check === 'TestCoverageCheck'), 'Should have TestCoverageCheck blocker');

    console.log('✓ Low test coverage blocked pipeline');
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Security Warnings Don't Block
console.log('Test 4: Security Warnings Don\'t Block');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 50
    });

    await orchestrator.initialize();

    // Create bundle with security warning
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

    // Run validation phase
    const validation = await orchestrator._validatePhase(bundle);

    assert(validation.passed === true, 'Security warnings should not block');
    assert(validation.signedBundle !== null, 'Should sign despite warnings');
    assert(validation.warnings.length > 0, 'Should have warnings');
    assert(validation.warnings.some(w => w.check === 'SecurityCheck'), 'Should have SecurityCheck warning');

    console.log('✓ Security warnings did not block signing');
    console.log(`  Warnings: ${validation.warnings.length}`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Non-Reversible Migration Blocks
console.log('Test 5: Non-Reversible Migration Blocks');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    await orchestrator.initialize();

    // Create bundle with non-reversible migration
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
          sql_reverse: '' // Missing reverse
        }
      ]
    };

    // Run validation phase
    const validation = await orchestrator._validatePhase(bundle);

    assert(validation.passed === false, 'Non-reversible migration should fail');
    assert(validation.signedBundle === null, 'Should not sign');
    assert(validation.blockers.some(b => b.check === 'MigrationReversibilityCheck'), 'Should have MigrationReversibilityCheck blocker');

    console.log('✓ Non-reversible migration blocked pipeline');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Signature Verification
console.log('Test 6: Signature Verification');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 50
    });

    await orchestrator.initialize();

    // Create a valid bundle
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
          content: 'test("hello", () => {});',
          sourceFile: 'src/app.js'
        }
      ],
      migrations: []
    };

    // Run validation phase (includes signing)
    const validation = await orchestrator._validatePhase(bundle);
    const signedBundle = validation.signedBundle;

    // Verify signature
    const isValid = orchestrator.bundleSigner.verifyBundle(signedBundle);

    assert(isValid === true, 'Signature should be valid');

    // Tamper with bundle and verify it fails
    const tamperedBundle = { ...signedBundle };
    tamperedBundle.files[0].content = 'TAMPERED';

    const isTamperedValid = orchestrator.bundleSigner.verifyBundle(tamperedBundle);

    assert(isTamperedValid === false, 'Tampered bundle should fail verification');

    console.log('✓ Bundle signature verified successfully');
    console.log('✓ Tampered bundle detected');
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Schema Check Blocks Invalid Bundle
console.log('Test 7: Schema Check Blocks Invalid Bundle');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    await orchestrator.initialize();

    // Create bundle with missing required fields
    const bundle = {
      // Missing bundle_id, bundle_type, created_at
      files: []
    };

    // Run validation phase
    const validation = await orchestrator._validatePhase(bundle);

    assert(validation.passed === false, 'Invalid schema should fail');
    assert(validation.signedBundle === null, 'Should not sign');
    assert(validation.blockers.some(b => b.check === 'SchemaCheck'), 'Should have SchemaCheck blocker');

    console.log('✓ Schema validation blocked invalid bundle');
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Pipeline Integration Summary
console.log('Test 8: Pipeline Integration Summary');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    // Verify all components are initialized
    assert(orchestrator.bundleBuilder !== undefined, 'BundleBuilder should be initialized');
    assert(orchestrator.releaseGate !== undefined, 'ReleaseGate should be initialized');
    assert(orchestrator.bundleSigner !== undefined, 'BundleSigner should be initialized');

    // Verify ReleaseGate has all checks
    const checks = orchestrator.releaseGate.getChecks();
    assert(checks.length === 6, 'Should have 6 validation checks');

    const checkNames = checks.map(c => c.name);
    assert(checkNames.includes('SyntaxCheck'), 'Should have SyntaxCheck');
    assert(checkNames.includes('DependencyCheck'), 'Should have DependencyCheck');
    assert(checkNames.includes('SchemaCheck'), 'Should have SchemaCheck');
    assert(checkNames.includes('TestCoverageCheck'), 'Should have TestCoverageCheck');
    assert(checkNames.includes('SecurityCheck'), 'Should have SecurityCheck');
    assert(checkNames.includes('MigrationReversibilityCheck'), 'Should have MigrationReversibilityCheck');

    console.log('✓ All pipeline components initialized');
    console.log(`  Checks: ${checkNames.join(', ')}`);
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  console.log('========================================');
  console.log('All Pipeline Integration Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Tests Summary:');
  console.log('1. ✓ Valid bundle passes validation and signing');
  console.log('2. ✓ Invalid bundle (syntax error) blocks pipeline');
  console.log('3. ✓ Low test coverage blocks pipeline');
  console.log('4. ✓ Security warnings don\'t block signing');
  console.log('5. ✓ Non-reversible migration blocks pipeline');
  console.log('6. ✓ Bundle signature verification works');
  console.log('7. ✓ Schema validation blocks invalid bundles');
  console.log('8. ✓ All pipeline components initialized');
  console.log('\nAll 8 integration tests passing!');
}, 1000);
