## Sub-Agent System

> Parallel code generation system with specialized AI agents

## Overview

The Sub-Agent System enables efficient parallel execution of plan steps by coordinating multiple specialized AI agents. Each agent focuses on a specific type of code generation (components, tests, migrations), and the coordinator intelligently batches and executes steps based on their dependencies.

## Architecture

```
SubAgentCoordinator
├── CodeGenSubAgent (generates code files)
├── TestGenSubAgent (generates test files)
└── MigrationSubAgent (generates migrations)
```

## Core Components

### BaseSubAgent

Abstract base class providing:
- Token budget tracking
- Progress event emission
- AI call management
- Task validation
- Code block extraction

### SubAgentCoordinator

Orchestrates execution:
- Registers and manages sub-agents
- Builds execution order with topological sort
- Executes steps in parallel batches
- Handles dependencies
- Tracks total usage

### CodeGenSubAgent

Generates code files:
- Components, routes, models
- Follows project patterns
- Includes error handling
- Adds documentation

### TestGenSubAgent

Generates test files:
- Unit and integration tests
- Detects test framework
- Ensures coverage
- Mocks dependencies

### MigrationSubAgent

Generates database migrations:
- Forward and reverse SQL
- Safety checks
- Transaction support
- Risk assessment

## Usage

### Basic Setup

```javascript
const {
  SubAgentCoordinator,
  CodeGenSubAgent,
  TestGenSubAgent,
  MigrationSubAgent
} = require('./agent/subagents');

// Create coordinator
const coordinator = new SubAgentCoordinator(orchestrator, {
  stopOnFailure: false,
  stopOnError: true
});

// Create and register agents
const codeGen = new CodeGenSubAgent(orchestrator, {
  tokenBudget: 50000,
  model: 'claude-3-5-sonnet-20241022'
});

const testGen = new TestGenSubAgent(orchestrator, {
  tokenBudget: 30000
});

const migration = new MigrationSubAgent(orchestrator, {
  tokenBudget: 20000
});

coordinator.registerAgent('CodeGenSubAgent', codeGen);
coordinator.registerAgent('TestGenSubAgent', testGen);
coordinator.registerAgent('MigrationSubAgent', migration);
```

### Execute Steps

```javascript
// Define steps from plan
const steps = [
  {
    id: 's1',
    action: 'create',
    target: 'src/models/User.js',
    description: 'Create User model',
    layer: 'database',
    dependencies: []
  },
  {
    id: 's2',
    action: 'create',
    target: 'src/routes/auth.js',
    description: 'Create auth routes',
    layer: 'backend',
    dependencies: ['s1']
  },
  {
    id: 's3',
    action: 'create',
    target: 'src/components/Login.jsx',
    description: 'Create Login component',
    layer: 'frontend',
    dependencies: ['s2']
  }
];

// Context for code generation
const context = {
  patterns: {
    frameworks: {
      frontend: [{ name: 'React', version: '^18.0.0' }],
      backend: [{ name: 'Express', version: '^4.18.0' }]
    },
    stateManagement: [{ name: 'Zustand' }]
  }
};

// Execute
const result = await coordinator.executeSteps(steps, context);

console.log(`Success: ${result.success}`);
console.log(`Completed: ${result.summary.successCount}/${result.summary.totalSteps}`);
console.log(`Duration: ${result.summary.duration}ms`);
console.log(`Tokens: ${result.summary.usage.total}`);
```

### Listen to Events

```javascript
// Execution events
coordinator.on('execution_start', (data) => {
  console.log(`Starting execution of ${data.totalSteps} steps`);
});

coordinator.on('batch_start', (data) => {
  console.log(`Batch ${data.batch}/${data.totalBatches}: ${data.stepsInBatch} steps`);
});

coordinator.on('step_complete', (data) => {
  console.log(`✓ Step ${data.stepId} completed by ${data.agent} (${data.duration}ms)`);
});

coordinator.on('execution_complete', (data) => {
  console.log(`Completed ${data.successCount}/${data.totalSteps} steps`);
  console.log(`Total tokens: ${data.tokensUsed}`);
});

// Agent progress events
coordinator.on('agent_progress', (data) => {
  console.log(`[${data.agent}] ${data.type}`, data);
});
```

## Parallel Execution

The coordinator automatically groups independent steps into batches for parallel execution:

### Example 1: Sequential (Dependencies)

```javascript
Steps: A → B → C

Batch 1: [A]
Batch 2: [B]  (waits for A)
Batch 3: [C]  (waits for B)
```

### Example 2: Parallel (Independent)

```javascript
Steps: A, B, C (no dependencies)

Batch 1: [A, B, C]  (all execute in parallel)
```

### Example 3: Mixed

```javascript
Steps:
  A (no deps)
  B (no deps)
  C (depends on A)
  D (depends on B)
  E (depends on C, D)

Batch 1: [A, B]         (parallel)
Batch 2: [C, D]         (parallel, wait for A, B)
Batch 3: [E]            (wait for C, D)
```

## Execution Order Algorithm

1. **Topological Sort**: Orders steps by dependencies
2. **Layer Priority**: Database → Backend → Frontend → Tests
3. **Batch Creation**: Groups independent steps
4. **Parallel Execution**: Uses `Promise.all` within batches
5. **Sequential Batches**: Executes batches one after another

## Agent Selection Logic

The coordinator automatically selects the appropriate agent:

```javascript
// Test files → TestGenSubAgent
target.includes('test') || target.includes('spec')

// Migrations → MigrationSubAgent
target.includes('migration') || layer === 'database'

// Everything else → CodeGenSubAgent
default
```

## Token Budget Management

Each agent has an independent token budget:

```javascript
// Set budgets
const codeGen = new CodeGenSubAgent(orchestrator, {
  tokenBudget: 50000  // 50k tokens max
});

// Check usage
const report = codeGen.getUsageReport();
console.log(`Used: ${report.tokensUsed}/${report.tokenBudget}`);
console.log(`Remaining: ${report.remaining}`);
console.log(`Percentage: ${report.percentageUsed}%`);

// Get total across all agents
const totalUsage = coordinator.getTotalUsage();
console.log(`Total: ${totalUsage.total} tokens`);
```

## Error Handling

The system handles errors gracefully:

```javascript
// Configure error handling
const coordinator = new SubAgentCoordinator(orchestrator, {
  stopOnFailure: false,  // Continue even if steps fail
  stopOnError: true      // Stop on critical errors
});

// Failed steps are reported in results
result.results.forEach(stepResult => {
  if (!stepResult.success) {
    console.error(`Step ${stepResult.step.id} failed: ${stepResult.error}`);
  }
});
```

## Creating Custom Sub-Agents

Extend `BaseSubAgent` to create custom agents:

```javascript
const BaseSubAgent = require('./BaseSubAgent');

class CustomSubAgent extends BaseSubAgent {
  constructor(orchestrator, config = {}) {
    super(orchestrator, {
      name: 'CustomSubAgent',
      tokenBudget: config.tokenBudget || 10000,
      ...config
    });
  }

  async execute(step, context = {}) {
    // Validate step
    const validation = this.validateTask(step);
    if (!validation.valid) {
      throw new Error(`Invalid task: ${validation.errors.join(', ')}`);
    }

    // Build prompt
    const prompt = this.buildCustomPrompt(step, context);

    // Call AI
    const response = await this.callAI([
      { role: 'user', content: prompt }
    ]);

    // Process response
    return {
      success: true,
      step: step.id,
      result: response.content,
      usage: response.usage
    };
  }

  buildCustomPrompt(step, context) {
    // Custom prompt building logic
    return `Generate ${step.target}...`;
  }
}

module.exports = CustomSubAgent;
```

## Testing

Run the comprehensive test suite:

```bash
node tests/subagents/test-subagent-system.js
```

Tests cover:
- Coordinator creation and registration
- Execution order building
- Parallel batch execution
- Dependency resolution
- Circular dependency detection
- Agent selection
- Token budget tracking
- Progress events
- Error handling

## Performance

### Benchmarks (Estimated)

**Sequential Execution:**
- 10 steps: ~300 seconds (30s per step)

**Parallel Execution (5 independent steps + 5 dependent):**
- 2 batches: ~60 seconds (batch 1: 5 parallel, batch 2: 5 parallel)
- **5x faster** for independent steps

### Best Practices

1. **Minimize Dependencies**: More independence = more parallelism
2. **Set Appropriate Budgets**: Allocate based on complexity
3. **Monitor Progress**: Listen to events for visibility
4. **Handle Failures**: Plan for partial failures
5. **Batch Related Steps**: Group by layer when possible

## Integration with AgentOrchestrator

```javascript
// In AgentOrchestrator.js
const { SubAgentCoordinator, CodeGenSubAgent } = require('./subagents');

class AgentOrchestrator {
  constructor() {
    // Create sub-agent coordinator
    this.subAgentCoordinator = new SubAgentCoordinator(this);

    // Register agents
    this.subAgentCoordinator.registerAgent(
      'CodeGenSubAgent',
      new CodeGenSubAgent(this, { tokenBudget: 50000 })
    );
  }

  async executePlan(plan) {
    // Use sub-agent coordinator to execute steps
    const result = await this.subAgentCoordinator.executeSteps(
      plan.steps,
      { patterns: this.context.patterns }
    );

    return result;
  }
}
```

## Future Enhancements

- [ ] Retry logic for failed steps
- [ ] Step result caching
- [ ] Dynamic agent selection based on complexity
- [ ] Agent performance metrics
- [ ] Custom execution strategies
- [ ] Streaming progress updates
- [ ] Rollback on failure
- [ ] Distributed execution

## API Reference

### SubAgentCoordinator

**Methods:**
- `registerAgent(name, agent)` - Register a sub-agent
- `executeSteps(steps, context)` - Execute all steps
- `buildExecutionOrder(steps)` - Build execution batches
- `executeBatch(batch, context)` - Execute batch in parallel
- `executeStep(step, context)` - Execute single step
- `selectAgent(step)` - Select agent for step
- `getTotalUsage()` - Get total token usage
- `reset()` - Reset all agents
- `getSummary()` - Get execution summary

**Events:**
- `execution_start` - Execution started
- `execution_plan` - Execution plan created
- `batch_start` - Batch started
- `batch_complete` - Batch completed
- `step_start` - Step started
- `step_complete` - Step completed
- `step_error` - Step failed
- `execution_complete` - Execution finished
- `agent_progress` - Agent progress update

### BaseSubAgent

**Methods:**
- `execute(task, context)` - Execute task (override)
- `callAI(messages, options)` - Call AI with budget tracking
- `emitProgress(data)` - Emit progress event
- `estimateTokens(content)` - Estimate token count
- `getUsageReport()` - Get usage statistics
- `resetUsage()` - Reset token counter
- `canAfford(tokens)` - Check if budget allows
- `extractCodeBlocks(content)` - Extract code from response
- `validateTask(task)` - Validate task
- `log(level, message, meta)` - Log with agent context

**Events:**
- `progress` - Progress update

## License

MIT
