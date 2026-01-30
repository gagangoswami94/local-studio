/**
 * Tests for BundleBuilder
 */

const assert = require('assert');
const BundleBuilder = require('../../src/agent/BundleBuilder');

console.log('Testing BundleBuilder...\n');

// Mock logger
const mockLogger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || '')
};

// Test 1: Create BundleBuilder
console.log('Test 1: Create BundleBuilder');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    assert(builder, 'Should create BundleBuilder');
    assert(typeof builder.compileBundle === 'function', 'Should have compileBundle method');
    assert(typeof builder.validateBundle === 'function', 'Should have validateBundle method');
    assert(typeof builder.getBundleSummary === 'function', 'Should have getBundleSummary method');

    console.log('✓ BundleBuilder created successfully');
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Compile Simple Bundle
console.log('Test 2: Compile Simple Bundle');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/app.js', content: 'console.log("hello");', action: 'create', layer: 'backend' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null, { tokensUsed: 1000 });

    assert(bundle.bundle_id, 'Should have bundle_id');
    assert(bundle.bundle_type, 'Should have bundle_type');
    assert(bundle.created_at, 'Should have created_at');
    assert(Array.isArray(bundle.files), 'Should have files array');
    assert(bundle.files.length === 1, 'Should have 1 file');
    assert(bundle.files[0].checksum, 'File should have checksum');
    assert(bundle.metadata.tokensUsed === 1000, 'Should track tokens used');
    assert(bundle.metadata.filesCreated === 1, 'Should count files created');

    console.log('✓ Simple bundle compiled');
    console.log(`  Bundle ID: ${bundle.bundle_id}`);
    console.log(`  Bundle Type: ${bundle.bundle_type}`);
    console.log(`  Files: ${bundle.files.length}`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Compile Bundle with Tests
console.log('Test 3: Compile Bundle with Tests');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/math.js', content: 'export const add = (a, b) => a + b;', action: 'create' }
    ];

    const tests = [
      {
        path: 'src/__tests__/math.test.js',
        content: 'import { add } from "../math"; test("add", () => {});',
        sourceFile: 'src/math.js',
        framework: 'vitest',
        coverage: { percentage: 100 }
      }
    ];

    const bundle = builder.compileBundle(files, tests, [], null, null);

    assert(bundle.tests.length === 1, 'Should have 1 test');
    assert(bundle.tests[0].checksum, 'Test should have checksum');
    assert(bundle.tests[0].sourceFile === 'src/math.js', 'Test should reference source file');
    assert(bundle.metadata.testsGenerated === 1, 'Should count tests generated');

    console.log('✓ Bundle with tests compiled');
    console.log(`  Tests: ${bundle.tests.length}`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Compile Bundle with Migrations
console.log('Test 4: Compile Bundle with Migrations');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/models/User.js', content: 'class User {}', action: 'create' }
    ];

    const migrations = [
      {
        migrationId: '20260130_abc123',
        description: 'Create users table',
        sql_forward: 'CREATE TABLE users (id INT);',
        sql_reverse: 'DROP TABLE users;',
        dataLossRisk: 'low',
        database: 'PostgreSQL'
      }
    ];

    const bundle = builder.compileBundle(files, [], migrations, null, null);

    assert(bundle.migrations.length === 1, 'Should have 1 migration');
    assert(bundle.migrations[0].id === '20260130_abc123', 'Migration should have ID');
    assert(bundle.migrations[0].checksum_forward, 'Migration should have forward checksum');
    assert(bundle.migrations[0].checksum_reverse, 'Migration should have reverse checksum');
    assert(bundle.metadata.migrationsGenerated === 1, 'Should count migrations generated');

    console.log('✓ Bundle with migrations compiled');
    console.log(`  Migrations: ${bundle.migrations.length}`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Command Detection - package.json Changed
console.log('Test 5: Command Detection - package.json Changed');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'package.json', content: '{"dependencies": {}}', action: 'modify' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null);

    assert(bundle.commands.length > 0, 'Should detect commands');
    const npmInstall = bundle.commands.find(c => c.command === 'npm install');
    assert(npmInstall, 'Should include npm install command');
    assert(npmInstall.when === 'pre-apply', 'npm install should run pre-apply');

    console.log('✓ package.json change detected');
    console.log(`  Commands: ${bundle.commands.map(c => c.command).join(', ')}`);
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Command Detection - Migrations Present
console.log('Test 6: Command Detection - Migrations Present');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const migrations = [
      {
        migrationId: '001',
        description: 'Migration',
        sql_forward: 'CREATE TABLE test;',
        sql_reverse: 'DROP TABLE test;',
        dataLossRisk: 'low',
        database: 'PostgreSQL'
      }
    ];

    const bundle = builder.compileBundle([], [], migrations, null, null);

    assert(bundle.commands.length > 0, 'Should detect migration command');
    const migrateCmd = bundle.commands.find(c => c.command.includes('migrate'));
    assert(migrateCmd, 'Should include migration command');
    assert(migrateCmd.riskLevel === 'low', 'Should assess migration risk');

    console.log('✓ Migration command detected');
    console.log(`  Command: ${migrateCmd.command}`);
    console.log(`  Risk: ${migrateCmd.riskLevel}`);
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Bundle Type Detection - Full
console.log('Test 7: Bundle Type Detection - Full');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/app.js', content: 'code', action: 'create' },
      { path: 'src/utils.js', content: 'code', action: 'create' },
      { path: 'src/config.js', content: 'code', action: 'create' },
      { path: 'src/index.js', content: 'code', action: 'create' },
      { path: 'src/server.js', content: 'code', action: 'create' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null);

    assert(bundle.bundle_type === 'full', 'Should detect full bundle (>80% creates)');

    console.log('✓ Full bundle type detected');
    console.log(`  Bundle Type: ${bundle.bundle_type}`);
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Bundle Type Detection - Patch
console.log('Test 8: Bundle Type Detection - Patch');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/app.js', content: 'code', action: 'modify' },
      { path: 'src/utils.js', content: 'code', action: 'modify' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null);

    assert(bundle.bundle_type === 'patch', 'Should detect patch bundle (mostly modifies)');

    console.log('✓ Patch bundle type detected');
    console.log(`  Bundle Type: ${bundle.bundle_type}`);
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Bundle Type Detection - Feature
console.log('Test 9: Bundle Type Detection - Feature');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/newFeature.js', content: 'code', action: 'create' },
      { path: 'src/app.js', content: 'code', action: 'modify' },
      { path: 'src/index.js', content: 'code', action: 'modify' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null);

    assert(bundle.bundle_type === 'feature', 'Should detect feature bundle (mix of creates/modifies)');

    console.log('✓ Feature bundle type detected');
    console.log(`  Bundle Type: ${bundle.bundle_type}`);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Validate Bundle - Valid
console.log('Test 10: Validate Bundle - Valid');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/app.js', content: 'code', action: 'create' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null);
    const validation = builder.validateBundle(bundle);

    assert(validation.valid === true, 'Bundle should be valid');
    assert(validation.errors.length === 0, 'Should have no errors');

    console.log('✓ Valid bundle passed validation');
    console.log(`  Errors: ${validation.errors.length}`);
    console.log(`  Warnings: ${validation.warnings.length}`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Validate Bundle - Missing Fields
console.log('Test 11: Validate Bundle - Missing Fields');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const invalidBundle = {
      files: []
    };

    const validation = builder.validateBundle(invalidBundle);

    assert(validation.valid === false, 'Invalid bundle should fail validation');
    assert(validation.errors.length > 0, 'Should have errors');
    assert(validation.errors.some(e => e.includes('bundle_id')), 'Should report missing bundle_id');

    console.log('✓ Invalid bundle rejected');
    console.log(`  Errors: ${validation.errors.join(', ')}`);
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Get Bundle Summary
console.log('Test 12: Get Bundle Summary');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/app.js', content: 'code', action: 'create' },
      { path: 'src/utils.js', content: 'code', action: 'modify' }
    ];

    const tests = [
      { path: 'src/__tests__/app.test.js', content: 'test', sourceFile: 'src/app.js' }
    ];

    const bundle = builder.compileBundle(files, tests, [], null, null);
    const summary = builder.getBundleSummary(bundle);

    assert(summary.bundle_id, 'Summary should have bundle_id');
    assert(summary.files.total === 2, 'Summary should count files');
    assert(summary.files.created === 1, 'Summary should count created files');
    assert(summary.files.modified === 1, 'Summary should count modified files');
    assert(summary.tests.total === 1, 'Summary should count tests');

    console.log('✓ Bundle summary generated');
    console.log(`  Files: ${summary.files.total} (${summary.files.created} created, ${summary.files.modified} modified)`);
    console.log(`  Tests: ${summary.tests.total}`);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Test 13: File Checksums
console.log('Test 13: File Checksums');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/app.js', content: 'console.log("hello");', action: 'create' }
    ];

    const bundle = builder.compileBundle(files, [], [], null, null);

    assert(bundle.files[0].checksum, 'File should have checksum');
    assert(bundle.files[0].checksum.length === 64, 'Checksum should be SHA256 (64 chars)');

    // Same content should produce same checksum
    const bundle2 = builder.compileBundle(files, [], [], null, null);
    assert(bundle.files[0].checksum === bundle2.files[0].checksum, 'Same content should have same checksum');

    console.log('✓ File checksums working');
    console.log(`  Checksum: ${bundle.files[0].checksum.substring(0, 16)}...`);
    console.log('✓ Test 13 passed\n');
  } catch (error) {
    console.error('✗ Test 13 failed:', error.message);
    process.exit(1);
  }
})();

// Test 14: Migration Risk Assessment
console.log('Test 14: Migration Risk Assessment');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const highRiskMigrations = [
      {
        migrationId: '001',
        description: 'Drop table',
        sql_forward: 'DROP TABLE users;',
        sql_reverse: 'CREATE TABLE users;',
        dataLossRisk: 'high'
      }
    ];

    const bundle = builder.compileBundle([], [], highRiskMigrations, null, null);

    const migrateCmd = bundle.commands.find(c => c.command.includes('migrate'));
    assert(migrateCmd.riskLevel === 'high', 'Should detect high risk migrations');

    console.log('✓ Migration risk assessment working');
    console.log(`  Risk Level: ${migrateCmd.riskLevel}`);
    console.log('✓ Test 14 passed\n');
  } catch (error) {
    console.error('✗ Test 14 failed:', error.message);
    process.exit(1);
  }
})();

// Test 15: Complete Bundle with All Components
console.log('Test 15: Complete Bundle with All Components');
(() => {
  try {
    const builder = new BundleBuilder({ logger: mockLogger });

    const files = [
      { path: 'src/models/User.js', content: 'class User {}', action: 'create', layer: 'backend' },
      { path: 'package.json', content: '{"dependencies": {}}', action: 'modify' }
    ];

    const tests = [
      { path: 'src/__tests__/User.test.js', content: 'test', sourceFile: 'src/models/User.js' }
    ];

    const migrations = [
      {
        migrationId: '001',
        description: 'Create users',
        sql_forward: 'CREATE TABLE users;',
        sql_reverse: 'DROP TABLE users;',
        dataLossRisk: 'low',
        database: 'PostgreSQL'
      }
    ];

    const appSpec = { name: 'TestApp', version: '1.0.0' };
    const plan = { title: 'Add user model' };
    const metadata = { tokensUsed: 5000, generationTime: 12000 };

    const bundle = builder.compileBundle(files, tests, migrations, appSpec, plan, metadata);

    assert(bundle.files.length === 2, 'Should have 2 files');
    assert(bundle.tests.length === 1, 'Should have 1 test');
    assert(bundle.migrations.length === 1, 'Should have 1 migration');
    assert(bundle.commands.length >= 2, 'Should have multiple commands (npm install + migrate)');
    assert(bundle.appSpec.name === 'TestApp', 'Should include appSpec');
    assert(bundle.plan.title === 'Add user model', 'Should include plan');
    assert(bundle.metadata.tokensUsed === 5000, 'Should include metadata');

    const validation = builder.validateBundle(bundle);
    assert(validation.valid === true, 'Complete bundle should be valid');

    console.log('✓ Complete bundle compiled successfully');
    console.log(`  Bundle ID: ${bundle.bundle_id}`);
    console.log(`  Files: ${bundle.files.length}`);
    console.log(`  Tests: ${bundle.tests.length}`);
    console.log(`  Migrations: ${bundle.migrations.length}`);
    console.log(`  Commands: ${bundle.commands.length}`);
    console.log('✓ Test 15 passed\n');
  } catch (error) {
    console.error('✗ Test 15 failed:', error.message);
    process.exit(1);
  }
})();

// Summary
console.log('========================================');
console.log('All BundleBuilder Tests Passed! ✓');
console.log('========================================\n');
console.log('Tests Summary:');
console.log('1. ✓ BundleBuilder creation');
console.log('2. ✓ Simple bundle compilation');
console.log('3. ✓ Bundle with tests');
console.log('4. ✓ Bundle with migrations');
console.log('5. ✓ Command detection - package.json');
console.log('6. ✓ Command detection - migrations');
console.log('7. ✓ Bundle type - full');
console.log('8. ✓ Bundle type - patch');
console.log('9. ✓ Bundle type - feature');
console.log('10. ✓ Bundle validation - valid');
console.log('11. ✓ Bundle validation - invalid');
console.log('12. ✓ Bundle summary');
console.log('13. ✓ File checksums');
console.log('14. ✓ Migration risk assessment');
console.log('15. ✓ Complete bundle with all components');
console.log('\nAll 15 tests passing!');
