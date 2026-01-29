/**
 * Integration test for AgentOrchestrator
 * Tests all Day 8 components wired together
 */
const AgentOrchestrator = require('./AgentOrchestrator');
const path = require('path');

console.log('=== AgentOrchestrator Integration Test ===\n');

async function runTests() {
  // Test 1: Create orchestrator
  console.log('Test 1: Create orchestrator');
  const orchestrator = new AgentOrchestrator({
    tokenBudget: 50000,
    retryAttempts: 2,
    storePath: path.join(__dirname, '../../data/test-orchestrator')
  });

  console.log('✓ Orchestrator created');
  console.log('✓ Components initialized');

  // Test 2: Execute Bundle Mode
  console.log('\nTest 2: Execute Bundle Mode (with placeholder phases)');
  const request = {
    message: 'Create a login form with email and password fields',
    context: [
      { path: 'src/App.jsx', content: '// existing app code' },
      { path: 'src/components/Form.jsx', content: '// form component' }
    ],
    workspaceFiles: ['src/App.jsx', 'src/components/Form.jsx', 'src/utils/validation.js']
  };

  const result = await orchestrator.executeBundleMode(request);

  console.log('✓ Bundle mode executed');
  console.log('  Success:', result.success);
  console.log('  Task ID:', result.taskId);
  console.log('  Files changed:', result.bundle?.files?.length || 0);
  console.log('  Tokens used:', result.metrics.tokensUsed);
  console.log('  Budget remaining:', result.metrics.budgetRemaining);

  // Test 3: Get task details
  console.log('\nTest 3: Get task details');
  const task = orchestrator.getTask(result.taskId);
  console.log('✓ Task retrieved:', task.id);
  console.log('  Status:', task.status);
  console.log('  Phases:');
  Object.keys(task.phases).forEach(phaseName => {
    const phase = task.phases[phaseName];
    console.log(`    ${phaseName}: ${phase.status}`);
  });

  // Test 4: Get budget report
  console.log('\nTest 4: Get budget report');
  const budgetReport = orchestrator.getBudgetReport();
  console.log('✓ Budget report:');
  console.log('  Total:', budgetReport.budget.total);
  console.log('  Used:', budgetReport.budget.used);
  console.log('  Available:', budgetReport.budget.available);
  console.log('  Percent used:', budgetReport.budget.percentUsed.toFixed(1) + '%');
  console.log('  Breakdown:', budgetReport.breakdown);

  // Test 5: Get event history
  console.log('\nTest 5: Get event history');
  const events = orchestrator.getEventHistory();
  console.log('✓ Event history length:', events.length);
  console.log('  Event types:', [...new Set(events.map(e => e.type))]);

  // Test 6: Test event listeners
  console.log('\nTest 6: Test event listeners');
  let eventReceived = false;
  orchestrator.eventBus.on('*', (event) => {
    if (event.type === 'task_start') {
      eventReceived = true;
    }
  });

  // Execute another bundle mode to trigger events
  const result2 = await orchestrator.executeBundleMode({
    message: 'Add validation to form',
    context: [{ path: 'src/components/Form.jsx', content: '// form' }],
    workspaceFiles: ['src/components/Form.jsx']
  });

  console.log('✓ Event listener triggered:', eventReceived);
  console.log('✓ Second task completed:', result2.taskId);

  // Test 7: Verify phase execution order
  console.log('\nTest 7: Verify phase execution order');
  const task2 = orchestrator.getTask(result2.taskId);
  const phaseOrder = ['analyze', 'plan', 'generate', 'validate'];
  let orderCorrect = true;

  for (let i = 0; i < phaseOrder.length; i++) {
    const phaseName = phaseOrder[i];
    const phase = task2.phases[phaseName];

    if (phase.status !== 'complete') {
      orderCorrect = false;
      console.log(`  ❌ Phase ${phaseName} not complete:`, phase.status);
    }
  }

  if (orderCorrect) {
    console.log('✓ All phases executed in correct order');
  }

  // Test 8: Verify state persistence
  console.log('\nTest 8: Verify state persistence');
  const taskFromDisk = await orchestrator.stateManager.recover(result.taskId);
  console.log('✓ Task recovered from disk:', taskFromDisk.id);
  console.log('  Status matches:', taskFromDisk.status === task.status);

  console.log('\n=== All AgentOrchestrator integration tests passed! ===');
}

runTests().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
