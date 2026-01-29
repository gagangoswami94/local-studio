/**
 * Test File Operation Tools
 * Simple test script for ViewFile, ViewDirectory, GrepSearch, WriteFile, and EditFile tools
 */

const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const { toolRegistry } = require('./src/agent/tools');

// Test workspace
const TEST_WORKSPACE = path.join(__dirname, 'test-workspace');

// Setup test workspace
async function setupTestWorkspace() {
  await fs.mkdir(TEST_WORKSPACE, { recursive: true });

  // Create test directory structure
  await fs.mkdir(path.join(TEST_WORKSPACE, 'subdir'), { recursive: true });

  // Create test files
  await fs.writeFile(
    path.join(TEST_WORKSPACE, 'test.txt'),
    'Line 1: Hello World\nLine 2: Test Content\nLine 3: More content\nLine 4: End',
    'utf8'
  );

  await fs.writeFile(
    path.join(TEST_WORKSPACE, 'test.js'),
    'const foo = "bar";\nconst baz = 42;\nfunction test() {\n  return true;\n}',
    'utf8'
  );

  await fs.writeFile(
    path.join(TEST_WORKSPACE, 'subdir', 'nested.txt'),
    'Nested file content',
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

// Test ViewFileTool
async function testViewFile() {
  console.log('\n📋 Testing ViewFileTool...');

  const tool = toolRegistry.get('view_file');
  assert(tool, 'ViewFileTool should be registered');

  // Test reading entire file
  const result1 = await tool.safeExecute({ path: 'test.txt' }, context);
  assert(result1.success, 'Should successfully read file');
  assert(result1.data.totalLines === 4, 'Should have 4 total lines');
  assert(result1.data.displayedLines.count === 4, 'Should display all 4 lines');
  assert(result1.data.content.includes('Line 1'), 'Should include first line content');

  // Test reading with line range
  const result2 = await tool.safeExecute({
    path: 'test.txt',
    start_line: 2,
    end_line: 3
  }, context);
  assert(result2.success, 'Should successfully read line range');
  assert(result2.data.displayedLines.count === 2, 'Should display 2 lines');
  assert(result2.data.displayedLines.start === 2, 'Should start at line 2');
  assert(result2.data.displayedLines.end === 3, 'Should end at line 3');

  // Test reading non-existent file
  const result3 = await tool.safeExecute({ path: 'nonexistent.txt' }, context);
  assert(!result3.success, 'Should fail for non-existent file');
  assert(result3.error.includes('not found'), 'Error should mention not found');

  console.log('  ✅ ViewFileTool passed all tests');
}

// Test ViewDirectoryTool
async function testViewDirectory() {
  console.log('\n📂 Testing ViewDirectoryTool...');

  const tool = toolRegistry.get('view_directory');
  assert(tool, 'ViewDirectoryTool should be registered');

  // Test listing root directory
  const result1 = await tool.safeExecute({ path: '.' }, context);
  assert(result1.success, 'Should successfully list directory');
  assert(result1.data.tree.length >= 2, 'Should find at least 2 items');

  // Test recursive listing
  const result2 = await tool.safeExecute({
    path: '.',
    recursive: true,
    max_depth: 2
  }, context);
  assert(result2.success, 'Should successfully list recursively');
  const subdirItem = result2.data.tree.find(item => item.name === 'subdir');
  assert(subdirItem, 'Should find subdir');
  assert(subdirItem.children, 'Should have children for subdir');

  // Test listing non-existent directory
  const result3 = await tool.safeExecute({ path: 'nonexistent' }, context);
  assert(!result3.success, 'Should fail for non-existent directory');

  console.log('  ✅ ViewDirectoryTool passed all tests');
}

// Test GrepSearchTool
async function testGrepSearch() {
  console.log('\n🔍 Testing GrepSearchTool...');

  const tool = toolRegistry.get('grep_search');
  assert(tool, 'GrepSearchTool should be registered');

  // Test basic search
  const result1 = await tool.safeExecute({ pattern: 'Hello' }, context);
  assert(result1.success, 'Should successfully search');
  assert(result1.data.totalMatches >= 1, 'Should find at least 1 match');

  // Test case insensitive search
  const result2 = await tool.safeExecute({
    pattern: 'hello',
    case_sensitive: false
  }, context);
  assert(result2.success, 'Should successfully search case insensitive');
  assert(result2.data.totalMatches >= 1, 'Should find matches');

  // Test with include filter
  const result3 = await tool.safeExecute({
    pattern: 'const',
    include: '*.js'
  }, context);
  assert(result3.success, 'Should successfully search with include filter');
  if (result3.data.totalMatches > 0) {
    assert(
      result3.data.matches.every(m => m.file.endsWith('.js')),
      'Should only match .js files'
    );
  }

  console.log('  ✅ GrepSearchTool passed all tests');
}

// Test WriteFileTool
async function testWriteFile() {
  console.log('\n✏️  Testing WriteFileTool...');

  const tool = toolRegistry.get('write_file');
  assert(tool, 'WriteFileTool should be registered');

  // Test creating new file
  const result1 = await tool.safeExecute({
    path: 'new-file.txt',
    content: 'New file content'
  }, context);
  assert(result1.success, 'Should successfully create file');
  assert(result1.data.action === 'created', 'Should mark as created');

  // Verify file was created
  const fileContent = await fs.readFile(
    path.join(TEST_WORKSPACE, 'new-file.txt'),
    'utf8'
  );
  assert(fileContent === 'New file content', 'File should have correct content');

  // Test overwriting existing file
  const result2 = await tool.safeExecute({
    path: 'new-file.txt',
    content: 'Updated content'
  }, context);
  assert(result2.success, 'Should successfully overwrite file');
  assert(result2.data.action === 'overwritten', 'Should mark as overwritten');

  // Test creating file with nested directories
  const result3 = await tool.safeExecute({
    path: 'deep/nested/file.txt',
    content: 'Deep content'
  }, context);
  assert(result3.success, 'Should successfully create file in nested dirs');

  console.log('  ✅ WriteFileTool passed all tests');
}

// Test EditFileTool
async function testEditFile() {
  console.log('\n✂️  Testing EditFileTool...');

  const tool = toolRegistry.get('edit_file');
  assert(tool, 'EditFileTool should be registered');

  // Test editing existing file
  const result1 = await tool.safeExecute({
    path: 'test.txt',
    old_content: 'Line 2: Test Content',
    new_content: 'Line 2: Modified Content'
  }, context);
  assert(result1.success, 'Should successfully edit file');

  // Verify edit was applied
  const fileContent = await fs.readFile(
    path.join(TEST_WORKSPACE, 'test.txt'),
    'utf8'
  );
  assert(fileContent.includes('Modified Content'), 'Should have modified content');
  assert(!fileContent.includes('Test Content'), 'Should not have old content');

  // Test editing non-existent content
  const result2 = await tool.safeExecute({
    path: 'test.txt',
    old_content: 'Non-existent content',
    new_content: 'New content'
  }, context);
  assert(!result2.success, 'Should fail when old content not found');
  assert(result2.error.includes('not found'), 'Error should mention not found');

  // Test editing non-existent file
  const result3 = await tool.safeExecute({
    path: 'nonexistent.txt',
    old_content: 'old',
    new_content: 'new'
  }, context);
  assert(!result3.success, 'Should fail for non-existent file');

  console.log('  ✅ EditFileTool passed all tests');
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting File Operation Tools Tests...');
  console.log('Test workspace:', TEST_WORKSPACE);

  try {
    // Setup
    await cleanupTestWorkspace();
    await setupTestWorkspace();

    // Run tests
    await testViewFile();
    await testViewDirectory();
    await testGrepSearch();
    await testWriteFile();
    await testEditFile();

    // Cleanup
    await cleanupTestWorkspace();

    console.log('\n✅ All tests passed!\n');
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
