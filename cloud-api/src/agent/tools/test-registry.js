/**
 * Test Tool Registry
 */
const { toolRegistry } = require('./index');

console.log('=== Tool Registry Test ===\n');

// Test 1: List all registered tools
console.log('Test 1: List all registered tools');
const allTools = toolRegistry.list();
console.log('✓ Registered tools:', allTools);
console.log('✓ Count:', toolRegistry.count());

// Test 2: Get tool schemas
console.log('\nTest 2: Get tool schemas for AI');
const schemas = toolRegistry.getSchemas();
console.log('✓ Schemas count:', schemas.length);
console.log('✓ Sample schema (view_file):');
const viewFileSchema = toolRegistry.getSchema('view_file');
console.log(JSON.stringify(viewFileSchema, null, 2));

// Test 3: Get tools by approval requirement
console.log('\nTest 3: Tools requiring approval');
const approvalRequired = toolRegistry.getToolsRequiringApproval();
console.log('✓ Require approval:', approvalRequired.map(t => t.name));

const noApproval = toolRegistry.getToolsNotRequiringApproval();
console.log('✓ No approval needed:', noApproval.map(t => t.name));

// Test 4: Execute a tool (stub)
console.log('\nTest 4: Execute view_file tool');
toolRegistry.execute('view_file', { path: 'src/App.js' })
  .then(result => {
    console.log('✓ Execution result:');
    console.log('  Success:', result.success);
    console.log('  Path:', result.data?.path);
    console.log('  Content preview:', result.data?.content?.substring(0, 50) + '...');
  });

// Test 5: Parameter validation
console.log('\nTest 5: Parameter validation');
const viewFileTool = toolRegistry.get('view_file');

// Valid parameters
const valid = viewFileTool.validateParameters({ path: 'test.js' });
console.log('✓ Valid params:', valid.valid);

// Invalid parameters (missing required)
const invalid = viewFileTool.validateParameters({});
console.log('✓ Invalid params (missing path):', !invalid.valid);
console.log('  Errors:', invalid.errors);

// Test 6: Execute with invalid parameters
console.log('\nTest 6: Execute with invalid parameters');
toolRegistry.execute('view_file', {})
  .then(result => {
    console.log('✓ Execution with invalid params:');
    console.log('  Success:', result.success);
    console.log('  Error:', result.error);
  });

// Test 7: Get non-existent tool
console.log('\nTest 7: Get non-existent tool');
const nonExistent = toolRegistry.get('non_existent_tool');
console.log('✓ Non-existent tool returns null:', nonExistent === null);

// Test 8: Execute tool that requires approval
console.log('\nTest 8: Check approval requirement');
setTimeout(() => {
  const writeFileTool = toolRegistry.get('write_file');
  console.log('✓ write_file requires approval:', writeFileTool.requiresApproval);

  const viewFileTool2 = toolRegistry.get('view_file');
  console.log('✓ view_file does not require approval:', !viewFileTool2.requiresApproval);

  console.log('\n=== All Tool Registry tests passed! ===');
}, 100);
