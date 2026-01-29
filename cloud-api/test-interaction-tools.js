/**
 * Test Interaction Tools
 * Simple test script for AskUser, Think, Plan, and Complete tools
 */

const assert = require('assert');
const { EventEmitter } = require('events');
const { toolRegistry } = require('./src/agent/tools');

// Test context with mock EventBus
function createTestContext() {
  const eventBus = new EventEmitter();
  return {
    workspacePath: __dirname,
    eventBus,
    thoughts: [],
    plan: null,
    status: 'running',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  };
}

// Test AskUserTool
async function testAskUser() {
  console.log('\n❓ Testing AskUserTool...');

  const tool = toolRegistry.get('ask_user');
  assert(tool, 'AskUserTool should be registered');

  // Test without EventBus (fallback mode)
  const contextNoEventBus = {
    workspacePath: __dirname,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  };

  const result1 = await tool.safeExecute({
    question: 'What color should the button be?',
    defaultAnswer: 'blue'
  }, contextNoEventBus);

  assert(result1.success, 'Should successfully handle question without EventBus');
  assert(result1.data.question, 'Should have question in response');
  assert(result1.data.answer, 'Should have answer in response');

  // Test with EventBus but immediate response
  const context = createTestContext();

  // Simulate user response after short delay
  setTimeout(() => {
    context.eventBus.emit('user:response', { answer: 'red' });
  }, 10);

  const resultPromise = tool.safeExecute({
    question: 'What color should the button be?',
    options: ['red', 'green', 'blue'],
    defaultAnswer: 'blue'
  }, context);

  const result2 = await resultPromise;

  assert(result2.success, 'Should successfully handle question with EventBus');
  assert(result2.data.answer === 'red', 'Should have user response');
  assert(result2.data.options.length === 3, 'Should have options');

  console.log('  ✅ AskUserTool passed all tests');
}

// Test ThinkTool
async function testThink() {
  console.log('\n💭 Testing ThinkTool...');

  const tool = toolRegistry.get('think');
  assert(tool, 'ThinkTool should be registered');

  const context = createTestContext();

  // Test basic thought
  const result1 = await tool.safeExecute({
    thought: 'I need to analyze the database schema first'
  }, context);

  assert(result1.success, 'Should successfully record thought');
  assert(result1.data.thought, 'Should have thought in response');
  assert(result1.data.category === 'observation', 'Should default to observation');
  assert(result1.data.recorded === true, 'Should be recorded');

  // Test thought with category
  const result2 = await tool.safeExecute({
    thought: 'Breaking this into 3 steps will be clearer',
    category: 'planning',
    importance: 'high'
  }, context);

  assert(result2.success, 'Should successfully record categorized thought');
  assert(result2.data.category === 'planning', 'Should have correct category');
  assert(result2.data.importance === 'high', 'Should have correct importance');

  // Check if thoughts are stored in context
  assert(context.thoughts.length === 2, 'Should store thoughts in context');

  // Test all categories
  const categories = ['analysis', 'planning', 'decision', 'observation', 'question', 'conclusion'];
  for (const category of categories) {
    const result = await tool.safeExecute({
      thought: `Test ${category}`,
      category
    }, context);
    assert(result.success, `Should handle ${category} category`);
  }

  console.log('  ✅ ThinkTool passed all tests');
}

// Test PlanTool
async function testPlan() {
  console.log('\n📋 Testing PlanTool...');

  const tool = toolRegistry.get('create_plan');
  assert(tool, 'PlanTool should be registered');

  const context = createTestContext();

  // Test valid plan
  const result1 = await tool.safeExecute({
    title: 'Add User Authentication',
    description: 'Implement JWT-based authentication system',
    steps: [
      {
        action: 'Create database schema',
        description: 'Create users table with email, password_hash, and timestamps',
        tool: 'write_file',
        estimated_time: '5 minutes'
      },
      {
        action: 'Implement auth middleware',
        description: 'Create middleware to verify JWT tokens',
        tool: 'write_file',
        estimated_time: '10 minutes',
        dependencies: [1]
      },
      {
        action: 'Create login endpoint',
        description: 'POST /api/login endpoint that generates JWT',
        tool: 'write_file',
        estimated_time: '15 minutes',
        dependencies: [1, 2]
      },
      {
        action: 'Run tests',
        description: 'Test authentication flow',
        tool: 'run_tests',
        estimated_time: '5 minutes',
        dependencies: [3]
      }
    ],
    risks: [
      'Password security - must use bcrypt with proper salt rounds',
      'JWT secret must be stored in environment variables'
    ]
  }, context);

  assert(result1.success, 'Should successfully create plan');
  assert(result1.data.title === 'Add User Authentication', 'Should have correct title');
  assert(result1.data.stepCount === 4, 'Should have 4 steps');
  assert(result1.data.steps.length === 4, 'Should have steps array');
  assert(result1.data.risks.length === 2, 'Should have risks');
  assert(result1.data.status === 'pending_approval', 'Should be pending approval');

  // Check if plan is stored in context
  assert(context.plan !== null, 'Should store plan in context');
  assert(context.plan.title === 'Add User Authentication', 'Should store correct plan');

  // Test plan with no steps (should fail)
  const result2 = await tool.safeExecute({
    title: 'Empty Plan',
    steps: []
  }, context);

  assert(!result2.success, 'Should fail for plan with no steps');
  assert(result2.error.includes('at least one step'), 'Error should mention steps');

  // Test plan with invalid step (missing required fields)
  const result3 = await tool.safeExecute({
    title: 'Invalid Plan',
    steps: [{ action: 'Do something' }] // missing description
  }, context);

  assert(!result3.success, 'Should fail for step with missing fields');

  console.log('  ✅ PlanTool passed all tests');
}

// Test CompleteTool
async function testComplete() {
  console.log('\n✅ Testing CompleteTool...');

  const tool = toolRegistry.get('task_complete');
  assert(tool, 'CompleteTool should be registered');

  const context = createTestContext();

  // Test basic completion
  const result1 = await tool.safeExecute({
    summary: 'Successfully added user authentication with JWT tokens'
  }, context);

  assert(result1.success, 'Should successfully mark task complete');
  assert(result1.data.summary, 'Should have summary');
  assert(result1.data.completed === true, 'Should be marked as completed');
  assert(context.status === 'completed', 'Should update context status');

  // Test completion with all fields
  const result2 = await tool.safeExecute({
    summary: 'Implemented search feature with filters',
    files_changed: [
      'src/components/Search.jsx',
      'src/services/searchService.js',
      'src/utils/filters.js'
    ],
    tests_passed: true,
    next_steps: [
      'Add search analytics',
      'Optimize search performance for large datasets',
      'Add advanced filter options'
    ],
    warnings: [
      'Search is not indexed yet, may be slow with large datasets'
    ]
  }, createTestContext());

  assert(result2.success, 'Should successfully mark task complete with details');
  assert(result2.data.files_changed.length === 3, 'Should have files changed');
  assert(result2.data.tests_passed === true, 'Should have tests passed flag');
  assert(result2.data.next_steps.length === 3, 'Should have next steps');
  assert(result2.data.warnings.length === 1, 'Should have warnings');

  console.log('  ✅ CompleteTool passed all tests');
}

// Test EventBus integration
async function testEventBusIntegration() {
  console.log('\n📡 Testing EventBus Integration...');

  const context = createTestContext();
  let eventsFired = 0;

  // Test ThinkTool event
  context.eventBus.on('agent:thought', (data) => {
    assert(data.thought, 'Thought event should have thought');
    assert(data.category, 'Thought event should have category');
    eventsFired++;
  });

  const thinkTool = toolRegistry.get('think');
  await thinkTool.safeExecute({ thought: 'Test thought' }, context);

  // Test PlanTool event
  context.eventBus.on('agent:plan:created', (data) => {
    assert(data.title, 'Plan event should have title');
    assert(data.steps, 'Plan event should have steps');
    eventsFired++;
  });

  const planTool = toolRegistry.get('create_plan');
  await planTool.safeExecute({
    title: 'Test Plan',
    steps: [{ action: 'Step 1', description: 'Do something' }]
  }, context);

  // Test CompleteTool event
  context.eventBus.on('task:complete', (data) => {
    assert(data.summary, 'Complete event should have summary');
    eventsFired++;
  });

  const completeTool = toolRegistry.get('task_complete');
  await completeTool.safeExecute({ summary: 'Test complete' }, context);

  // Give events time to fire
  await new Promise(resolve => setTimeout(resolve, 10));

  assert(eventsFired === 3, `Should have fired 3 events, fired ${eventsFired}`);

  console.log('  ✅ EventBus integration tests passed');
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Interaction Tools Tests...');

  try {
    // Run tests
    await testAskUser();
    await testThink();
    await testPlan();
    await testComplete();
    await testEventBusIntegration();

    console.log('\n✅ All interaction tool tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
