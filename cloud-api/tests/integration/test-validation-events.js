/**
 * Tests for Validation Event Emission and Progress Tracking
 */

const assert = require('assert');
const AgentOrchestrator = require('../../src/agent/AgentOrchestrator');

console.log('Testing Validation Events and Progress...\n');

// Mock logger
const mockLogger = {
  info: (msg, meta) => {}, // Silent in tests
  error: (msg, meta) => {},
  warn: (msg, meta) => {}
};

// Test 1: Per-Check Progress Events
console.log('Test 1: Per-Check Progress Events');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 50
    });

    await orchestrator.initialize();

    // Track validation events
    const events = [];
    orchestrator.eventBus.on('validation_check_start', (event) => {
      events.push({ type: 'start', check: event.data.check });
    });
    orchestrator.eventBus.on('validation_check_complete', (event) => {
      events.push({ type: 'complete', check: event.data.check, passed: event.data.passed });
    });

    // Create valid bundle
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

    // Run validation
    const validation = await orchestrator._validatePhase(bundle, 'test-task-1');

    // Verify events were emitted
    assert(events.length > 0, 'Should emit validation events');

    // Should have start/complete pairs for each check
    const startEvents = events.filter(e => e.type === 'start');
    const completeEvents = events.filter(e => e.type === 'complete');
    assert(startEvents.length === 6, 'Should emit 6 check start events');
    assert(completeEvents.length === 6, 'Should emit 6 check complete events');

    // All checks should pass
    const allPassed = completeEvents.every(e => e.passed === true);
    assert(allPassed, 'All checks should pass for valid bundle');

    console.log('✓ Per-check progress events emitted correctly');
    console.log(`  Start events: ${startEvents.length}`);
    console.log(`  Complete events: ${completeEvents.length}`);
    console.log(`  Checks: ${startEvents.map(e => e.check).join(', ')}`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Fix Suggestions Generation
console.log('Test 2: Fix Suggestions Generation');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 100
    });

    await orchestrator.initialize();

    // Create bundle with multiple issues
    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [
        {
          path: 'src/bad.js',
          content: 'function test() { return // incomplete',
          action: 'create'
        },
        {
          path: 'src/good.js',
          content: 'export function good() { return "ok"; }',
          action: 'create'
        }
      ],
      tests: [],
      migrations: [
        {
          id: '001',
          description: 'Create table',
          sql_forward: 'CREATE TABLE users (id INT);',
          sql_reverse: '' // Missing reverse
        }
      ]
    };

    // Run validation
    const validation = await orchestrator._validatePhase(bundle, 'test-task-2');

    // Should have failed
    assert(validation.passed === false, 'Validation should fail');
    assert(validation.blockers.length > 0, 'Should have blockers');
    assert(validation.suggestions !== undefined, 'Should have suggestions');
    assert(validation.suggestions.length > 0, 'Should have at least one suggestion');

    // Verify suggestions structure
    const suggestion = validation.suggestions[0];
    assert(suggestion.check !== undefined, 'Suggestion should have check name');
    assert(suggestion.title !== undefined, 'Suggestion should have title');
    assert(suggestion.description !== undefined, 'Suggestion should have description');
    assert(Array.isArray(suggestion.actions), 'Suggestion should have actions array');

    console.log('✓ Fix suggestions generated correctly');
    console.log(`  Blockers: ${validation.blockers.length}`);
    console.log(`  Suggestions: ${validation.suggestions.length}`);
    validation.suggestions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.title} (${s.check})`);
    });
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Validation Summary Event
console.log('Test 3: Validation Summary Event');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    await orchestrator.initialize();

    // Track summary event
    let summaryEvent = null;
    orchestrator.eventBus.on('validation_summary', (event) => {
      summaryEvent = event;
    });

    // Create valid bundle
    const bundle = {
      bundle_id: 'test-123',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [],
      tests: [],
      migrations: []
    };

    // Run validation
    await orchestrator._validatePhase(bundle, 'test-task-3');

    // Verify summary event was emitted
    assert(summaryEvent !== null, 'Should emit validation summary event');
    assert(summaryEvent.data.passed !== undefined, 'Summary should have passed field');
    assert(summaryEvent.data.checks !== undefined, 'Summary should have checks count');
    assert(summaryEvent.data.duration !== undefined, 'Summary should have duration');

    console.log('✓ Validation summary event emitted');
    console.log(`  Passed: ${summaryEvent.data.passed}`);
    console.log(`  Checks: ${summaryEvent.data.checks}`);
    console.log(`  Duration: ${summaryEvent.data.duration}ms`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Retry Validation
console.log('Test 4: Retry Validation');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 100 // Start with strict threshold
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
        }
      ],
      tests: [],
      migrations: []
    };

    // Create initial task
    const taskId = 'test-task-4';
    orchestrator.stateManager.createTask(taskId, 'Test task', {});
    orchestrator.stateManager.updateTask(taskId, { bundle });

    // First validation should fail (100% threshold, no tests)
    const validation1 = await orchestrator.retryValidation(taskId, { bundle });
    assert(validation1.passed === false, 'First validation should fail');
    assert(validation1.blockers.some(b => b.check === 'TestCoverageCheck'), 'Should fail on coverage');

    // Retry with lower threshold
    const validation2 = await orchestrator.retryValidation(taskId, {
      bundle,
      coverageThreshold: 0 // Allow 0% coverage
    });
    assert(validation2.passed === true, 'Second validation should pass');

    console.log('✓ Validation retry works correctly');
    console.log(`  First attempt: ${validation1.passed ? 'passed' : 'failed'}`);
    console.log(`  Second attempt: ${validation2.passed ? 'passed' : 'failed'}`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Validation Result Structure
console.log('Test 5: Validation Result Structure');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    await orchestrator.initialize();

    // Create invalid bundle
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

    // Run validation
    const validation = await orchestrator._validatePhase(bundle, 'test-task-5');

    // Verify structure
    assert(typeof validation.passed === 'boolean', 'Should have passed field');
    assert(typeof validation.valid === 'boolean', 'Should have valid field');
    assert(Array.isArray(validation.blockers), 'Should have blockers array');
    assert(Array.isArray(validation.warnings), 'Should have warnings array');
    assert(Array.isArray(validation.suggestions), 'Should have suggestions array');
    assert(validation.report !== undefined, 'Should have report');
    assert(typeof validation.summary === 'string', 'Should have summary string');
    assert(typeof validation.duration === 'number', 'Should have duration');
    assert(typeof validation.tokensUsed === 'number', 'Should have tokensUsed');

    // Verify report structure
    assert(typeof validation.report.passed === 'boolean', 'Report should have passed');
    assert(typeof validation.report.totalChecks === 'number', 'Report should have totalChecks');
    assert(typeof validation.report.passedChecks === 'number', 'Report should have passedChecks');
    assert(typeof validation.report.failedChecks === 'number', 'Report should have failedChecks');
    assert(Array.isArray(validation.report.results), 'Report should have results array');

    console.log('✓ Validation result structure is correct');
    console.log(`  Fields: passed, valid, blockers, warnings, suggestions, report, summary, duration, tokensUsed`);
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  console.log('========================================');
  console.log('All Validation Event Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Tests Summary:');
  console.log('1. ✓ Per-check progress events emitted');
  console.log('2. ✓ Fix suggestions generated for blockers');
  console.log('3. ✓ Validation summary event emitted');
  console.log('4. ✓ Retry validation works');
  console.log('5. ✓ Validation result structure correct');
  console.log('\nAll 5 event tests passing!');
}, 1000);
