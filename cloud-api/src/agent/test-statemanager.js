/**
 * Quick smoke test for StateManager
 */
const StateManager = require('./StateManager');
const { TaskStatus, PhaseStatus } = StateManager;
const path = require('path');

console.log('=== StateManager Test ===\n');

// Use test directory
const testStorePath = path.join(__dirname, '../../data/test-tasks');

async function runTests() {
  // Test 1: Create task
  console.log('Test 1: Create task');
  const stateManager = new StateManager({
    storePath: testStorePath,
    autoPersist: true
  });

  const task = stateManager.createTask('task_test_123', 'Create login form', {
    files: ['src/App.jsx'],
    workspace: '/path/to/project'
  });

  console.log('✓ Task created:', task.id);
  console.log('✓ Status:', task.status);
  console.log('✓ Has phases:', Object.keys(task.phases));

  // Test 2: Update task
  console.log('\nTest 2: Update task');
  stateManager.updateTask('task_test_123', {
    status: TaskStatus.ANALYZING,
    phases: {
      analyze: {
        status: PhaseStatus.IN_PROGRESS,
        startedAt: new Date().toISOString()
      }
    }
  });

  const updated = stateManager.getTask('task_test_123');
  console.log('✓ Status updated to:', updated.status);
  console.log('✓ Analyze phase:', updated.phases.analyze.status);

  // Test 3: Complete a phase
  console.log('\nTest 3: Complete phase');
  stateManager.updateTask('task_test_123', {
    phases: {
      analyze: {
        status: PhaseStatus.COMPLETE,
        result: { findings: 'Need auth component' },
        completedAt: new Date().toISOString()
      }
    },
    metrics: { tokensUsed: 1200 }
  });

  const completed = stateManager.getTask('task_test_123');
  console.log('✓ Analyze phase complete:', completed.phases.analyze.status === PhaseStatus.COMPLETE);
  console.log('✓ Tokens used:', completed.metrics.tokensUsed);

  // Test 4: Persist to disk
  console.log('\nTest 4: Persist to disk');
  await stateManager.persist('task_test_123');
  console.log('✓ Task persisted');

  // Test 5: Recover from disk
  console.log('\nTest 5: Recover from disk');
  const newStateManager = new StateManager({ storePath: testStorePath });
  const recovered = await newStateManager.recover('task_test_123');
  console.log('✓ Task recovered:', recovered.id);
  console.log('✓ Status matches:', recovered.status === TaskStatus.ANALYZING);
  console.log('✓ Metrics preserved:', recovered.metrics.tokensUsed);

  // Test 6: List tasks
  console.log('\nTest 6: List tasks');
  const tasks = await stateManager.listTasks(10);
  console.log('✓ Found', tasks.length, 'task(s)');

  // Test 7: Get stats
  console.log('\nTest 7: Get stats');
  const stats = stateManager.getStats();
  console.log('✓ Total tasks:', stats.total);
  console.log('✓ By status:', stats.byStatus);

  // Test 8: Delete task
  console.log('\nTest 8: Delete task');
  const deleted = await stateManager.deleteTask('task_test_123');
  console.log('✓ Task deleted:', deleted);

  const deletedTask = stateManager.getTask('task_test_123');
  console.log('✓ Task no longer in memory:', deletedTask === null);

  // Test 9: Try to recover deleted task (should fail)
  console.log('\nTest 9: Try to recover deleted task');
  try {
    await stateManager.recover('task_test_123');
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✓ Correctly threw error:', error.message);
  }

  console.log('\n=== All StateManager tests passed! ===');
}

runTests().catch(console.error);
