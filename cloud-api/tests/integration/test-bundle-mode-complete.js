/**
 * Integration Tests for Complete Bundle Mode Execution
 * Tests the full flow: analyze → plan → [approval] → generate → validate → sign
 */

const assert = require('assert');
const AgentOrchestrator = require('../../src/agent/AgentOrchestrator');

console.log('Testing Complete Bundle Mode Execution...\n');

// Mock logger
const mockLogger = {
  info: (msg, meta) => {}, // Silent in tests
  error: (msg, meta) => {},
  warn: (msg, meta) => {}
};

// Test 1: Low-Risk Plan (No Approval Required)
console.log('Test 1: Low-Risk Plan (No Approval Required)');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 0 // Allow any coverage for test
    });

    await orchestrator.initialize();

    // Override _analyzePhase for test
    orchestrator._analyzePhase = async () => ({
      understanding: 'Test analysis',
      requirements: [],
      affectedFiles: [],
      estimatedComplexity: 'low',
      tokensUsed: 100
    });

    // Override _planPhase for test (low risk)
    orchestrator._planPhase = async () => ({
      plan_id: 'test-plan-1',
      title: 'Low risk change',
      complexity: 'low',
      steps: [],
      files_to_change: ['src/utils.js'], // Only 1 file
      estimated_minutes: 5,
      risks: [],
      migrations: null,
      tokensUsed: 200
    });

    // Track events
    const events = [];
    orchestrator.eventBus.on('*', (event) => {
      events.push(event.type);
    });

    // Execute bundle mode
    const result = await orchestrator.executeBundleMode({
      message: 'Add utility function',
      context: [],
      requireApproval: true // Even though required, should skip for low risk
    });

    // Verify success (may fail validation, but should not require approval)
    assert(result.taskId !== undefined, 'Should have task ID');
    assert(result.mode === 'bundle', 'Should be bundle mode');
    assert(result.metrics !== undefined, 'Should have metrics');
    assert(result.metrics.tokensUsed !== undefined, 'Should have token metrics');
    assert(result.metrics.timeMs !== undefined, 'Should have time metrics');
    assert(result.metrics.estimatedCost !== undefined, 'Should have cost estimate');

    // Should not have emitted approval events
    const hasApprovalEvent = events.includes('approval_required');
    assert(hasApprovalEvent === false, 'Should not require approval for low-risk plan');

    console.log('✓ Low-risk plan executed without approval');
    console.log(`  Metrics: ${result.metrics.tokensUsed.total} tokens, ${result.metrics.timeMs.total}ms, ~$${result.metrics.estimatedCost.toFixed(4)}`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: High-Risk Plan (Approval Required - Approved)
console.log('Test 2: High-Risk Plan (Approval Required - Approved)');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 0
    });

    await orchestrator.initialize();

    // Override phases
    orchestrator._analyzePhase = async () => ({
      understanding: 'Test analysis',
      requirements: [],
      affectedFiles: [],
      estimatedComplexity: 'high',
      tokensUsed: 100
    });

    orchestrator._planPhase = async () => ({
      plan_id: 'test-plan-2',
      title: 'High risk change',
      complexity: 'high',
      steps: [],
      files_to_change: Array(15).fill('src/file.js'), // 15 files = high risk
      estimated_minutes: 30,
      risks: ['Multiple files affected'],
      migrations: [{ id: '001', description: 'Migration' }],
      tokensUsed: 200
    });

    // Track approval event
    let approvalEmitted = false;
    orchestrator.eventBus.on('approval_required', (event) => {
      approvalEmitted = true;

      // Auto-approve after short delay
      setTimeout(() => {
        orchestrator.submitApproval(event.taskId, {
          approved: true
        });
      }, 100);
    });

    // Execute bundle mode
    const result = await orchestrator.executeBundleMode({
      message: 'Major refactor',
      context: [],
      requireApproval: true
    });

    // Verify approval was required
    assert(approvalEmitted === true, 'Should have emitted approval_required event');

    console.log('✓ High-risk plan required and received approval');
    console.log(`  Risk assessment: high`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Plan Rejection
console.log('Test 3: Plan Rejection');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    await orchestrator.initialize();

    // Override phases
    orchestrator._analyzePhase = async () => ({
      understanding: 'Test analysis',
      tokensUsed: 100
    });

    orchestrator._planPhase = async () => ({
      plan_id: 'test-plan-3',
      title: 'High risk change',
      complexity: 'high',
      files_to_change: Array(20).fill('src/file.js'),
      risks: ['Too many changes'],
      tokensUsed: 200
    });

    // Auto-reject approval
    orchestrator.eventBus.on('approval_required', (event) => {
      setTimeout(() => {
        orchestrator.submitApproval(event.taskId, {
          approved: false,
          reason: 'Too risky'
        });
      }, 100);
    });

    // Execute bundle mode
    const result = await orchestrator.executeBundleMode({
      message: 'Risky change',
      context: [],
      requireApproval: true
    });

    // Should fail
    assert(result.success === false, 'Should fail on rejection');
    assert(result.error !== undefined, 'Should have error');
    assert(result.error.phase === 'plan', 'Should fail in plan phase');
    assert(result.error.recoverable === true, 'Should be recoverable');

    console.log('✓ Plan rejection handled correctly');
    console.log(`  Error: ${result.error.message}`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Metrics Collection
console.log('Test 4: Metrics Collection');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 0
    });

    await orchestrator.initialize();

    // Override phases with known token usage
    orchestrator._analyzePhase = async () => {
      orchestrator.budgetManager.recordUsage(100);
      return { understanding: 'Test', tokensUsed: 100 };
    };

    orchestrator._planPhase = async () => {
      orchestrator.budgetManager.recordUsage(200);
      return {
        plan_id: 'test-plan-4',
        complexity: 'low',
        steps: [],
        files_to_change: [],
        tokensUsed: 200
      };
    };

    orchestrator._generatePhase = async () => {
      orchestrator.budgetManager.recordUsage(5000);
      return {
        bundle_id: 'test-bundle',
        bundle_type: 'patch',
        created_at: new Date().toISOString(),
        files: [],
        tests: [],
        migrations: []
      };
    };

    // Execute
    const result = await orchestrator.executeBundleMode({
      message: 'Test metrics',
      context: [],
      requireApproval: false
    });

    // Verify metrics structure
    assert(result.metrics !== undefined, 'Should have metrics');
    assert(result.metrics.tokensUsed !== undefined, 'Should have tokensUsed');
    assert(result.metrics.timeMs !== undefined, 'Should have timeMs');
    assert(result.metrics.estimatedCost !== undefined, 'Should have estimatedCost');

    // Verify per-phase metrics
    assert(typeof result.metrics.tokensUsed.analyze === 'number', 'Should have analyze tokens');
    assert(typeof result.metrics.tokensUsed.plan === 'number', 'Should have plan tokens');
    assert(typeof result.metrics.tokensUsed.generate === 'number', 'Should have generate tokens');
    assert(typeof result.metrics.tokensUsed.validate === 'number', 'Should have validate tokens');
    assert(typeof result.metrics.tokensUsed.total === 'number', 'Should have total tokens');

    assert(typeof result.metrics.timeMs.analyze === 'number', 'Should have analyze time');
    assert(typeof result.metrics.timeMs.plan === 'number', 'Should have plan time');
    assert(typeof result.metrics.timeMs.generate === 'number', 'Should have generate time');
    assert(typeof result.metrics.timeMs.validate === 'number', 'Should have validate time');
    assert(typeof result.metrics.timeMs.total === 'number', 'Should have total time');

    // Verify cost calculation
    assert(result.metrics.estimatedCost >= 0, 'Should have non-negative cost');

    console.log('✓ Metrics collected correctly');
    console.log(`  Tokens: analyze=${result.metrics.tokensUsed.analyze}, plan=${result.metrics.tokensUsed.plan}, generate=${result.metrics.tokensUsed.generate}, validate=${result.metrics.tokensUsed.validate}, total=${result.metrics.tokensUsed.total}`);
    console.log(`  Time: total=${result.metrics.timeMs.total}ms`);
    console.log(`  Cost: ~$${result.metrics.estimatedCost.toFixed(4)}`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Response Structure
console.log('Test 5: Response Structure');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000,
      coverageThreshold: 0
    });

    await orchestrator.initialize();

    // Override phases
    orchestrator._analyzePhase = async () => ({
      understanding: 'Test',
      tokensUsed: 100
    });

    orchestrator._planPhase = async () => ({
      plan_id: 'test-plan-5',
      complexity: 'low',
      steps: [],
      files_to_change: [],
      tokensUsed: 200
    });

    orchestrator._generatePhase = async () => ({
      bundle_id: 'test-bundle',
      bundle_type: 'patch',
      created_at: new Date().toISOString(),
      files: [],
      tests: [],
      migrations: []
    });

    // Execute
    const result = await orchestrator.executeBundleMode({
      message: 'Test structure',
      context: [],
      requireApproval: false
    });

    // Verify response structure
    assert(typeof result.success === 'boolean', 'Should have success field');
    assert(typeof result.taskId === 'string', 'Should have taskId field');
    assert(result.mode === 'bundle', 'Should have mode field');
    assert(result.bundle !== undefined, 'Should have bundle field');
    assert(result.validation !== undefined, 'Should have validation field');
    assert(result.metrics !== undefined, 'Should have metrics field');

    // Metrics structure
    assert(result.metrics.tokensUsed.analyze !== undefined, 'Should have tokensUsed.analyze');
    assert(result.metrics.tokensUsed.plan !== undefined, 'Should have tokensUsed.plan');
    assert(result.metrics.tokensUsed.generate !== undefined, 'Should have tokensUsed.generate');
    assert(result.metrics.tokensUsed.validate !== undefined, 'Should have tokensUsed.validate');
    assert(result.metrics.tokensUsed.total !== undefined, 'Should have tokensUsed.total');

    assert(result.metrics.timeMs.analyze !== undefined, 'Should have timeMs.analyze');
    assert(result.metrics.timeMs.plan !== undefined, 'Should have timeMs.plan');
    assert(result.metrics.timeMs.generate !== undefined, 'Should have timeMs.generate');
    assert(result.metrics.timeMs.validate !== undefined, 'Should have timeMs.validate');
    assert(result.metrics.timeMs.total !== undefined, 'Should have timeMs.total');

    assert(typeof result.metrics.estimatedCost === 'number', 'Should have estimatedCost');

    console.log('✓ Response structure is correct');
    console.log(`  Fields: success, taskId, mode, bundle, validation, metrics, error`);
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Risk Assessment
console.log('Test 6: Risk Assessment');
(async () => {
  try {
    const orchestrator = new AgentOrchestrator({
      logger: mockLogger,
      tokenBudget: 100000
    });

    // Test low risk
    const lowRisk = orchestrator._assessPlanRisks({
      complexity: 'low',
      files_to_change: ['src/utils.js'],
      migrations: null,
      risks: []
    });

    assert(lowRisk.level === 'low', 'Should assess as low risk');
    assert(lowRisk.requiresApproval === false, 'Should not require approval');

    // Test medium risk
    const mediumRisk = orchestrator._assessPlanRisks({
      complexity: 'medium',
      files_to_change: ['package.json'],
      migrations: null,
      risks: []
    });

    assert(mediumRisk.level === 'medium', 'Should assess as medium risk');
    assert(mediumRisk.requiresApproval === true, 'Should require approval');

    // Test high risk
    const highRisk = orchestrator._assessPlanRisks({
      complexity: 'high',
      files_to_change: Array(15).fill('src/file.js'),
      migrations: [{ id: '001' }],
      risks: ['Breaking change']
    });

    assert(highRisk.level === 'high', 'Should assess as high risk');
    assert(highRisk.requiresApproval === true, 'Should require approval');
    assert(highRisk.reasons.length > 0, 'Should have risk reasons');

    console.log('✓ Risk assessment works correctly');
    console.log(`  Low risk: ${lowRisk.level} (approval: ${lowRisk.requiresApproval})`);
    console.log(`  Medium risk: ${mediumRisk.level} (approval: ${mediumRisk.requiresApproval})`);
    console.log(`  High risk: ${highRisk.level} (approval: ${highRisk.requiresApproval})`);
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  console.log('========================================');
  console.log('All Bundle Mode Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Tests Summary:');
  console.log('1. ✓ Low-risk plan executed without approval');
  console.log('2. ✓ High-risk plan required approval');
  console.log('3. ✓ Plan rejection handled correctly');
  console.log('4. ✓ Metrics collected per phase');
  console.log('5. ✓ Response structure complete');
  console.log('6. ✓ Risk assessment accurate');
  console.log('\nAll 6 bundle mode tests passing!');
}, 2000);
