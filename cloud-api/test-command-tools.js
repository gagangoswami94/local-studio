/**
 * Test Command Execution Tools
 * Simple test script for RunCommand, RunTests, and InstallPackage tools
 */

const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const { toolRegistry } = require('./src/agent/tools');

// Test workspace
const TEST_WORKSPACE = path.join(__dirname, 'test-workspace-commands');

// Setup test workspace
async function setupTestWorkspace() {
  await fs.mkdir(TEST_WORKSPACE, { recursive: true });

  // Create a minimal package.json for npm operations
  const packageJson = {
    name: 'test-workspace',
    version: '1.0.0',
    description: 'Test workspace',
    scripts: {
      test: 'echo "Test passed" && exit 0'
    },
    dependencies: {},
    devDependencies: {}
  };

  await fs.writeFile(
    path.join(TEST_WORKSPACE, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );

  // Create a simple test file
  await fs.writeFile(
    path.join(TEST_WORKSPACE, 'test.js'),
    'console.log("Test file");',
    'utf8'
  );
}

// Cleanup test workspace
async function cleanupTestWorkspace() {
  try {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
  } catch (error) {
    console.log('Cleanup warning:', error.message);
  }
}

// Test context
const context = {
  workspacePath: TEST_WORKSPACE,
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
};

// Test RunCommandTool
async function testRunCommand() {
  console.log('\n⚙️  Testing RunCommandTool...');

  const tool = toolRegistry.get('run_command');
  assert(tool, 'RunCommandTool should be registered');

  // Test allowed command
  const result1 = await tool.safeExecute({ command: 'echo "Hello World"' }, context);
  assert(result1.success, 'Should successfully execute echo command');
  assert(result1.data.exitCode === 0, 'Exit code should be 0');
  assert(result1.data.stdout.includes('Hello World'), 'Should have correct output');

  // Test ls command
  const result2 = await tool.safeExecute({ command: 'ls' }, context);
  assert(result2.success, 'Should successfully execute ls command');
  assert(result2.data.exitCode === 0, 'Exit code should be 0');

  // Test blocked command
  const result3 = await tool.safeExecute({ command: 'sudo whoami' }, context);
  assert(!result3.success, 'Should fail for blocked command');
  assert(result3.error.includes('blocked'), 'Error should mention blocked');

  // Test dangerous pattern
  const result4 = await tool.safeExecute({ command: 'rm -rf /' }, context);
  assert(!result4.success, 'Should fail for dangerous pattern');
  assert(result4.error.includes('dangerous'), 'Error should mention dangerous');

  // Test non-whitelisted command
  const result5 = await tool.safeExecute({ command: 'curl http://example.com' }, context);
  assert(!result5.success, 'Should fail for non-whitelisted command');

  console.log('  ✅ RunCommandTool passed all tests');
}

// Test RunTestsTool
async function testRunTests() {
  console.log('\n🧪 Testing RunTestsTool...');

  const tool = toolRegistry.get('run_tests');
  assert(tool, 'RunTestsTool should be registered');

  // Test with npm script (from package.json)
  const result1 = await tool.safeExecute({}, context);
  assert(result1.success, 'Should successfully run tests');
  assert(result1.data.exitCode === 0, 'Exit code should be 0');
  assert(result1.data.framework === 'npm-script', 'Should detect npm-script framework');

  // Test with custom command
  const result2 = await tool.safeExecute({
    command: 'echo "5 passing (10ms)"'
  }, context);
  assert(result2.success, 'Should successfully run custom test command');

  console.log('  ✅ RunTestsTool passed all tests');
}

// Test InstallPackageTool
async function testInstallPackage() {
  console.log('\n📦 Testing InstallPackageTool...');

  const tool = toolRegistry.get('install_package');
  assert(tool, 'InstallPackageTool should be registered');

  // Test package name validation - invalid name
  const result1 = await tool.safeExecute({
    package: '../../../etc/passwd'
  }, context);
  assert(!result1.success, 'Should fail for invalid package name');
  assert(result1.error.includes('Invalid'), 'Error should mention invalid');

  // Test dangerous package blocking
  const result2 = await tool.safeExecute({
    package: 'shelljs'
  }, context);
  assert(!result2.success, 'Should block dangerous package');
  assert(result2.error.includes('not allowed'), 'Error should mention not allowed');

  // Test valid package installation (lodash is small and safe)
  console.log('  Installing lodash (this may take a moment)...');
  const result3 = await tool.safeExecute({
    package: 'lodash@4.17.21',
    exact: true
  }, context);
  assert(result3.success, 'Should successfully install package');
  assert(result3.data.exitCode === 0, 'Exit code should be 0');
  assert(result3.data.packageName === 'lodash@4.17.21', 'Should have correct package name');

  // Verify package was installed
  const packageJsonPath = path.join(TEST_WORKSPACE, 'package.json');
  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  assert(packageJson.dependencies.lodash, 'Lodash should be in dependencies');

  console.log('  ✅ InstallPackageTool passed all tests');
}

// Test Security Features
async function testSecurity() {
  console.log('\n🔒 Testing Security Features...');

  const runCommandTool = toolRegistry.get('run_command');

  // Test path traversal protection
  const result1 = await runCommandTool.safeExecute({
    command: 'ls',
    cwd: '../../../etc'
  }, context);
  assert(!result1.success, 'Should block path traversal');
  assert(result1.error.includes('outside workspace'), 'Error should mention outside workspace');

  // Test command injection patterns
  const injectionPatterns = [
    'echo "test"; rm -rf /',
    'ls | sudo whoami'
  ];

  for (const pattern of injectionPatterns) {
    const result = await runCommandTool.safeExecute({ command: pattern }, context);
    assert(!result.success, `Should block injection: ${pattern}`);
  }

  // Note: 'cat /etc/passwd' is allowed as cat is a safe read-only command

  console.log('  ✅ Security tests passed');
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Command Execution Tools Tests...');
  console.log('Test workspace:', TEST_WORKSPACE);

  try {
    // Setup
    await cleanupTestWorkspace();
    await setupTestWorkspace();

    // Run tests
    await testRunCommand();
    await testRunTests();
    await testInstallPackage();
    await testSecurity();

    // Cleanup
    await cleanupTestWorkspace();

    console.log('\n✅ All command execution tool tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);

    // Cleanup on failure
    await cleanupTestWorkspace();

    process.exit(1);
  }
}

// Run tests
runTests();
