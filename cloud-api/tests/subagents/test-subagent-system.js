const assert = require('assert');
const {
  SubAgentCoordinator,
  CodeGenSubAgent,
  TestGenSubAgent,
  MigrationSubAgent
} = require('../../src/agent/subagents');

/**
 * Test Sub-Agent System
 */

console.log('Testing Sub-Agent System...\n');

// Mock orchestrator
const mockOrchestrator = {
  logger: {
    info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || '')
  }
};

// Test 1: Create Sub-Agent Coordinator
console.log('Test 1: Create Sub-Agent Coordinator');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    assert(coordinator, 'Should create coordinator');
    assert(coordinator.agents instanceof Map, 'Should have agents map');
    assert(typeof coordinator.registerAgent === 'function', 'Should have registerAgent method');
    assert(typeof coordinator.executeSteps === 'function', 'Should have executeSteps method');

    console.log('✓ Coordinator created successfully');
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Register Sub-Agents
console.log('Test 2: Register Sub-Agents');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    // Create agents
    const codeGen = new CodeGenSubAgent(mockOrchestrator, { tokenBudget: 10000 });
    const testGen = new TestGenSubAgent(mockOrchestrator, { tokenBudget: 5000 });
    const migration = new MigrationSubAgent(mockOrchestrator, { tokenBudget: 3000 });

    // Register agents
    coordinator.registerAgent('CodeGenSubAgent', codeGen);
    coordinator.registerAgent('TestGenSubAgent', testGen);
    coordinator.registerAgent('MigrationSubAgent', migration);

    assert(coordinator.agents.size === 3, 'Should have 3 registered agents');
    assert(coordinator.agents.has('CodeGenSubAgent'), 'Should have CodeGenSubAgent');
    assert(coordinator.agents.has('TestGenSubAgent'), 'Should have TestGenSubAgent');
    assert(coordinator.agents.has('MigrationSubAgent'), 'Should have MigrationSubAgent');

    console.log('✓ Registered 3 sub-agents');
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Build Execution Order (No Dependencies)
console.log('Test 3: Build Execution Order (No Dependencies)');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    const steps = [
      { id: 's1', action: 'create', target: 'file1.js', dependencies: [] },
      { id: 's2', action: 'create', target: 'file2.js', dependencies: [] },
      { id: 's3', action: 'create', target: 'file3.js', dependencies: [] }
    ];

    const batches = coordinator.buildExecutionOrder(steps);

    assert(batches.length === 1, 'Should have 1 batch (all parallel)');
    assert(batches[0].length === 3, 'First batch should have 3 steps');

    console.log('✓ Built execution order: 1 batch with 3 parallel steps');
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Build Execution Order (With Dependencies)
console.log('Test 4: Build Execution Order (With Dependencies)');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    const steps = [
      { id: 's1', action: 'create', target: 'model.js', layer: 'database', dependencies: [] },
      { id: 's2', action: 'create', target: 'route.js', layer: 'backend', dependencies: ['s1'] },
      { id: 's3', action: 'create', target: 'component.jsx', layer: 'frontend', dependencies: ['s2'] },
      { id: 's4', action: 'create', target: 'test.js', layer: 'test', dependencies: ['s3'] }
    ];

    const batches = coordinator.buildExecutionOrder(steps);

    assert(batches.length === 4, 'Should have 4 batches (sequential)');
    assert(batches[0][0].id === 's1', 'First batch should be s1');
    assert(batches[1][0].id === 's2', 'Second batch should be s2');
    assert(batches[2][0].id === 's3', 'Third batch should be s3');
    assert(batches[3][0].id === 's4', 'Fourth batch should be s4');

    console.log('✓ Built execution order: 4 sequential batches');
    console.log('  Batch 1: s1 (database)');
    console.log('  Batch 2: s2 (backend)');
    console.log('  Batch 3: s3 (frontend)');
    console.log('  Batch 4: s4 (test)');
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Build Execution Order (Mixed Dependencies)
console.log('Test 5: Build Execution Order (Mixed Dependencies)');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    const steps = [
      { id: 's1', action: 'create', target: 'model1.js', layer: 'database', dependencies: [] },
      { id: 's2', action: 'create', target: 'model2.js', layer: 'database', dependencies: [] },
      { id: 's3', action: 'create', target: 'route1.js', layer: 'backend', dependencies: ['s1'] },
      { id: 's4', action: 'create', target: 'route2.js', layer: 'backend', dependencies: ['s2'] },
      { id: 's5', action: 'create', target: 'page.jsx', layer: 'frontend', dependencies: ['s3', 's4'] }
    ];

    const batches = coordinator.buildExecutionOrder(steps);

    assert(batches.length === 3, 'Should have 3 batches');
    assert(batches[0].length === 2, 'First batch should have 2 steps (s1, s2)');
    assert(batches[1].length === 2, 'Second batch should have 2 steps (s3, s4)');
    assert(batches[2].length === 1, 'Third batch should have 1 step (s5)');

    console.log('✓ Built execution order with mixed dependencies');
    console.log('  Batch 1: s1, s2 (parallel)');
    console.log('  Batch 2: s3, s4 (parallel)');
    console.log('  Batch 3: s5');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Detect Circular Dependencies
console.log('Test 6: Detect Circular Dependencies');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    const steps = [
      { id: 's1', action: 'create', target: 'file1.js', dependencies: ['s2'] },
      { id: 's2', action: 'create', target: 'file2.js', dependencies: ['s3'] },
      { id: 's3', action: 'create', target: 'file3.js', dependencies: ['s1'] }
    ];

    try {
      coordinator.buildExecutionOrder(steps);
      console.error('✗ Should have thrown circular dependency error');
      process.exit(1);
    } catch (error) {
      assert(error.message.includes('Circular dependency'), 'Should detect circular dependency');
      console.log('✓ Circular dependency detected correctly');
      console.log('✓ Test 6 passed\n');
    }
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Agent Selection
console.log('Test 7: Agent Selection');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    const codeGen = new CodeGenSubAgent(mockOrchestrator);
    const testGen = new TestGenSubAgent(mockOrchestrator);
    const migration = new MigrationSubAgent(mockOrchestrator);

    coordinator.registerAgent('CodeGenSubAgent', codeGen);
    coordinator.registerAgent('TestGenSubAgent', testGen);
    coordinator.registerAgent('MigrationSubAgent', migration);

    // Test selection logic
    const codeStep = { id: 's1', action: 'create', target: 'component.jsx', layer: 'frontend' };
    const testStep = { id: 's2', action: 'create', target: 'component.test.js', layer: 'test' };
    const migrationStep = { id: 's3', action: 'create', target: 'migration.js', layer: 'database' };

    const agent1 = coordinator.selectAgent(codeStep);
    const agent2 = coordinator.selectAgent(testStep);
    const agent3 = coordinator.selectAgent(migrationStep);

    assert(agent1.name === 'CodeGen', 'Should select CodeGen for component');
    assert(agent2.name === 'TestGen', 'Should select TestGen for test');
    assert(agent3.name === 'Migration', 'Should select Migration for migration');

    console.log('✓ Agent selection logic working correctly');
    console.log('  - Component → CodeGen');
    console.log('  - Test → TestGen');
    console.log('  - Migration → Migration');
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Token Budget Tracking
console.log('Test 8: Token Budget Tracking');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator, { tokenBudget: 1000 });

    assert(agent.tokenBudget === 1000, 'Should have correct token budget');
    assert(agent.tokensUsed === 0, 'Should start with 0 tokens used');

    // Simulate token usage
    agent.tokensUsed = 500;

    const report = agent.getUsageReport();
    assert(report.tokensUsed === 500, 'Should track tokens used');
    assert(report.percentageUsed === 50, 'Should calculate percentage');
    assert(report.remaining === 500, 'Should calculate remaining');
    assert(report.withinBudget === true, 'Should be within budget');

    console.log('✓ Token budget tracking working');
    console.log(`  Used: ${report.tokensUsed}/${report.tokenBudget}`);
    console.log(`  Percentage: ${report.percentageUsed}%`);
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Progress Events
console.log('Test 9: Progress Events');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);
    let eventReceived = false;

    agent.on('progress', (data) => {
      eventReceived = true;
      assert(data.agent === 'CodeGen', 'Should include agent name');
      assert(data.timestamp, 'Should include timestamp');
    });

    agent.emitProgress({ type: 'test', message: 'Test event' });

    // Wait a bit for event
    await new Promise(resolve => setTimeout(resolve, 100));

    assert(eventReceived, 'Should emit progress events');

    console.log('✓ Progress events working');
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Extract Code Blocks
console.log('Test 10: Extract Code Blocks');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const content = `Here is the code:

\`\`\`javascript
function hello() {
  console.log('Hello World');
}
\`\`\`

And another block:

\`\`\`css
.button {
  color: blue;
}
\`\`\``;

    const blocks = agent.extractCodeBlocks(content);

    assert(blocks.length === 2, 'Should extract 2 code blocks');
    assert(blocks[0].language === 'javascript', 'First block should be javascript');
    assert(blocks[1].language === 'css', 'Second block should be css');
    assert(blocks[0].code.includes('function hello'), 'Should extract code content');

    console.log('✓ Code block extraction working');
    console.log(`  Extracted ${blocks.length} blocks`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Task Validation
console.log('Test 11: Task Validation');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    // Valid task
    const validTask = { id: 's1', action: 'create', target: 'file.js' };
    const validResult = agent.validateTask(validTask);
    assert(validResult.valid === true, 'Should validate correct task');

    // Invalid task (missing fields)
    const invalidTask = { id: 's1' };
    const invalidResult = agent.validateTask(invalidTask);
    assert(invalidResult.valid === false, 'Should reject invalid task');
    assert(invalidResult.errors.length > 0, 'Should provide error messages');

    console.log('✓ Task validation working');
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Get Total Usage
console.log('Test 12: Get Total Usage');
(async () => {
  try {
    const coordinator = new SubAgentCoordinator(mockOrchestrator);

    const codeGen = new CodeGenSubAgent(mockOrchestrator, { tokenBudget: 10000 });
    const testGen = new TestGenSubAgent(mockOrchestrator, { tokenBudget: 5000 });

    codeGen.tokensUsed = 3000;
    testGen.tokensUsed = 1500;

    coordinator.registerAgent('CodeGenSubAgent', codeGen);
    coordinator.registerAgent('TestGenSubAgent', testGen);

    const usage = coordinator.getTotalUsage();

    assert(usage.total === 4500, 'Should calculate total usage');
    assert(usage.byAgent.CodeGenSubAgent === 3000, 'Should track by agent');
    assert(usage.byAgent.TestGenSubAgent === 1500, 'Should track by agent');

    console.log('✓ Total usage tracking working');
    console.log(`  Total: ${usage.total} tokens`);
    console.log(`  CodeGen: ${usage.byAgent.CodeGenSubAgent}`);
    console.log(`  TestGen: ${usage.byAgent.TestGenSubAgent}`);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests to complete
setTimeout(() => {
  console.log('\n========================================');
  console.log('All Sub-Agent System tests passed! ✓');
  console.log('========================================\n');
  console.log('Summary:');
  console.log('- BaseSubAgent: Token tracking, progress events, validation');
  console.log('- SubAgentCoordinator: Execution ordering, parallel batching');
  console.log('- CodeGenSubAgent: Code generation (stub)');
  console.log('- TestGenSubAgent: Test generation (stub)');
  console.log('- MigrationSubAgent: Migration generation (stub)');
  console.log('\nSystem ready for integration with AgentOrchestrator');
}, 2000);
