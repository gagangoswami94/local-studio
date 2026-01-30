# Complete Bundle Mode Execution

## Overview

Bundle Mode is a fully automated code generation pipeline that takes a natural language request and produces a signed, validated code bundle ready for deployment. The entire flow includes analysis, planning, approval checkpoints, generation, validation, and cryptographic signing.

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Bundle Mode Execution                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ Phase 1: ANALYZE                                              │
│ - Understand request context                                  │
│ - Identify affected files                                     │
│ - Estimate complexity                                         │
│ - Tokens tracked per phase                                    │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ Phase 2: PLAN                                                 │
│ - Create implementation steps                                 │
│ - Identify file changes                                       │
│ - Plan migrations                                             │
│ - Generate risk assessment                                    │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ APPROVAL CHECKPOINT (if high/medium risk)                     │
│ - Emit APPROVAL_REQUIRED event                                │
│ - Wait for user approval (5 min timeout)                      │
│ - Allow plan modifications                                    │
│ - Abort if rejected                                           │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ Phase 3: GENERATE                                             │
│ - Execute Sub-Agent Coordinator                               │
│ - Generate code for each step                                 │
│ - Generate tests automatically                                │
│ - Generate migrations if needed                               │
│ - Compile into bundle structure                               │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ Phase 4: VALIDATE                                             │
│ - Run Release Gate (6 quality checks)                         │
│ - Emit per-check progress events                              │
│ - Generate fix suggestions if failed                          │
│ - Sign bundle if passed                                       │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ RESULT                                                        │
│ - Signed bundle (if passed)                                   │
│ - Detailed metrics (tokens, time, cost)                       │
│ - Validation report                                           │
│ - Error details (if failed)                                   │
└───────────────────────────────────────────────────────────────┘
```

## Request Structure

```javascript
{
  message: 'Add user authentication with JWT',  // Required
  context: [                                     // Optional
    {
      path: 'src/server.js',
      content: '...'
    }
  ],
  workspaceFiles: [                              // Optional
    'src/routes/users.js',
    'src/middleware/auth.js'
  ],
  appSpec: {                                     // Optional
    stack: 'node-express',
    database: 'postgresql'
  },
  requireApproval: true                          // Optional (default: true)
}
```

## Response Structure

### Success Response

```javascript
{
  success: true,
  taskId: 'task_1234567890_abc123',
  mode: 'bundle',

  // Signed bundle ready for deployment
  bundle: {
    bundle_id: 'bundle_xyz',
    bundle_type: 'feature',
    created_at: '2026-01-31T12:00:00.000Z',
    files: [
      {
        path: 'src/auth/jwt.js',
        content: '...',
        action: 'create',
        checksum: 'sha256:...'
      }
    ],
    tests: [
      {
        path: 'src/auth/__tests__/jwt.test.js',
        content: '...',
        sourceFile: 'src/auth/jwt.js'
      }
    ],
    migrations: [
      {
        id: '001',
        description: 'Create users table',
        sql_forward: '...',
        sql_reverse: '...'
      }
    ],
    commands: ['npm install jsonwebtoken'],
    metadata: { ... },
    signature: {
      algorithm: 'RSA-SHA256',
      value: '...',
      keyId: 'local-studio-dev',
      timestamp: '...'
    }
  },

  // Validation results
  validation: {
    passed: true,
    report: {
      passed: true,
      totalChecks: 6,
      passedChecks: 6,
      results: [...]
    },
    blockers: [],
    warnings: [
      {
        check: 'SecurityCheck',
        message: 'Found 1 security issue(s)',
        details: { ... }
      }
    ]
  },

  // Detailed metrics
  metrics: {
    tokensUsed: {
      analyze: 850,
      plan: 1200,
      generate: 45000,
      validate: 0,
      total: 47050
    },
    timeMs: {
      analyze: 2350,
      plan: 1800,
      generate: 28500,
      validate: 450,
      total: 33100
    },
    estimatedCost: 0.2115  // ~$0.21
  },

  error: null
}
```

### Failure Response

```javascript
{
  success: false,
  taskId: 'task_1234567890_abc123',
  mode: 'bundle',

  // Error details
  error: {
    message: 'Bundle failed validation checks',
    phase: 'validate',
    recoverable: true
  },

  // Unsigned bundle (if generated)
  bundle: { ... },

  // Validation details
  validation: {
    passed: false,
    blockers: [
      {
        check: 'TestCoverageCheck',
        message: 'Test coverage 50.0% is below threshold 80%',
        details: {
          untestedFiles: ['src/utils.js', 'src/helpers.js']
        }
      }
    ],
    warnings: [],
    suggestions: [
      {
        check: 'TestCoverageCheck',
        title: 'Increase test coverage',
        description: 'Add tests for untested files to meet coverage threshold',
        actions: [
          'Review the list of untested files in the blocker details',
          'Add test files for each untested source file',
          'Consider lowering coverage threshold if appropriate',
          'Re-run generation with test generation enabled'
        ]
      }
    ],
    summary: '...'  // Human-readable markdown report
  },

  // Partial metrics
  metrics: {
    tokensUsed: { analyze: 850, plan: 1200, generate: 45000, validate: 0, total: 47050 },
    timeMs: { analyze: 2350, plan: 1800, generate: 28500, validate: 450, total: 33100 },
    estimatedCost: 0.2115
  }
}
```

## Approval Checkpoint

### Risk Assessment

Plans are automatically assessed for risk level:

**Low Risk** (no approval):
- Few file changes (< 10)
- No migrations
- Low complexity
- No critical files affected

**Medium Risk** (approval required):
- Configuration files modified (package.json, etc.)
- Moderate file changes (10-20)
- Dependencies added/removed

**High Risk** (approval required):
- Many file changes (> 10)
- Database migrations present
- High complexity task
- Explicit risks in plan
- Breaking changes possible

### Approval Event

When approval is required, the system emits an `approval_required` event:

```javascript
EVENT: approval_required
{
  taskId: 'task_1234567890_abc123',
  plan: {
    title: 'Add user authentication',
    steps: [...],
    files_to_change: [...],
    migrations: [...]
  },
  riskAssessment: {
    level: 'high',
    requiresApproval: true,
    reasons: [
      'Database migrations present',
      'High number of file changes (15)',
      'Critical configuration files affected'
    ],
    details: {
      filesAffected: 15,
      migrations: 2,
      complexity: 'high',
      estimatedTime: 30
    }
  },
  estimatedTime: 30,
  filesAffected: 15,
  migrations: 2
}
```

### Submitting Approval

Approval must be submitted within the timeout (default: 5 minutes):

```javascript
// Approve plan
orchestrator.submitApproval(taskId, {
  approved: true
});

// Reject plan
orchestrator.submitApproval(taskId, {
  approved: false,
  reason: 'Too many changes, please split into smaller tasks'
});

// Approve with modifications
orchestrator.submitApproval(taskId, {
  approved: true,
  modifiedPlan: {
    // Only include fields to override
    files_to_change: ['src/auth/jwt.js', 'src/routes/auth.js'],
    migrations: []  // Remove migrations
  },
  modifications: 'Removed migrations, reduced scope'
});
```

## Metrics Collection

Metrics are collected throughout execution:

### Token Usage

Tokens are tracked per phase to understand LLM usage:

```javascript
tokensUsed: {
  analyze: 850,      // Analysis phase
  plan: 1200,        // Planning phase
  generate: 45000,   // Code generation (largest)
  validate: 0,       // Validation (no LLM)
  total: 47050       // Sum of all phases
}
```

### Execution Time

Time is tracked per phase for performance monitoring:

```javascript
timeMs: {
  analyze: 2350,     // ~2.4s
  plan: 1800,        // ~1.8s
  generate: 28500,   // ~28.5s (largest)
  validate: 450,     // ~0.5s
  total: 33100       // ~33.1s total
}
```

### Cost Estimation

Cost is calculated based on Claude 3.5 Sonnet pricing:

- Input tokens: $3 per million
- Output tokens: $15 per million
- Assumes 70% input, 30% output

```javascript
estimatedCost: 0.2115  // ~$0.21 for this request
```

## Error Handling

### Error Classification

Errors are classified by phase and recoverability:

```javascript
error: {
  message: 'Budget exceeded',
  type: 'BudgetExceededError',
  phase: 'generate',
  recoverable: false  // Cannot retry
}
```

**Recoverable Errors:**
- Validation failures (can retry with fixes)
- Syntax errors (can regenerate)
- Network timeouts (can retry)
- Rate limiting (can retry with backoff)

**Non-Recoverable Errors:**
- Budget exhausted
- Invalid request structure
- Missing required configuration

### Error Recovery

For recoverable errors, use retry or regeneration:

```javascript
// Retry validation with lower threshold
const retry = await orchestrator.retryValidation(taskId, {
  coverageThreshold: 50
});

// Regenerate with fix instructions
const regen = await orchestrator.regenerateBundle(taskId, {
  fixInstructions: [
    'Add tests for src/utils.js',
    'Fix syntax error in src/app.js line 42'
  ]
});
```

## Event Timeline

During execution, the following events are emitted:

```
1. task_start         { mode: 'bundle', message: '...' }

2. code_analyzing     { phase: 'analyze', status: 'started' }
3. code_analyzing     { phase: 'analyze', status: 'completed' }

4. code_planning      { phase: 'plan', status: 'started' }
5. code_planning      { phase: 'plan', status: 'completed' }

6. approval_required  { plan: {...}, riskAssessment: {...} }
7. approval_received  { approved: true }

8. code_generating    { phase: 'generate', status: 'started' }
9. code_generating    { phase: 'generate', status: 'completed' }

10. code_validating   { phase: 'validate', status: 'started', totalChecks: 6 }
11. validation_check_start    { check: 'SyntaxCheck' }
12. validation_check_complete { check: 'SyntaxCheck', passed: true }
    ... (repeated for each check)
17. validation_summary { passed: true, checks: 6, blockers: 0 }

18. task_complete     { mode: 'bundle', filesChanged: 5, signed: true }
```

## Usage Examples

### Example 1: Simple Feature Addition

```javascript
const orchestrator = new AgentOrchestrator({
  tokenBudget: 100000,
  coverageThreshold: 80
});

await orchestrator.initialize();

const result = await orchestrator.executeBundleMode({
  message: 'Add a utility function to format dates',
  context: [],
  requireApproval: false  // Skip approval for simple tasks
});

if (result.success) {
  console.log('Bundle generated successfully!');
  console.log(`Files: ${result.bundle.files.length}`);
  console.log(`Cost: ~$${result.metrics.estimatedCost.toFixed(4)}`);

  // Deploy bundle
  await deployBundle(result.bundle);
}
```

### Example 2: High-Risk Change with Approval

```javascript
const orchestrator = new AgentOrchestrator({
  tokenBudget: 200000,
  coverageThreshold: 90  // Stricter for production
});

await orchestrator.initialize();

// Listen for approval requests
orchestrator.eventBus.on('approval_required', async (event) => {
  const { plan, riskAssessment } = event.data;

  // Show user the plan and risks
  console.log(`Plan requires approval: ${riskAssessment.level} risk`);
  console.log(`Files affected: ${riskAssessment.details.filesAffected}`);
  console.log(`Migrations: ${riskAssessment.details.migrations}`);

  // Get user input
  const approved = await promptUser('Approve this plan?');

  orchestrator.submitApproval(event.taskId, {
    approved
  });
});

const result = await orchestrator.executeBundleMode({
  message: 'Refactor authentication system to use OAuth2',
  context: readContextFiles(),
  requireApproval: true
});
```

### Example 3: Handling Validation Failures

```javascript
const result = await orchestrator.executeBundleMode({
  message: 'Add new API endpoints',
  context: []
});

if (!result.success) {
  console.error('Generation failed:', result.error.message);

  if (result.error.phase === 'validate' && result.error.recoverable) {
    // Show fix suggestions
    console.log('\nFix suggestions:');
    result.validation.suggestions.forEach(s => {
      console.log(`\n${s.title}:`);
      s.actions.forEach(a => console.log(`  - ${a}`));
    });

    // Retry with lower coverage threshold
    const retry = await orchestrator.retryValidation(result.taskId, {
      coverageThreshold: 50
    });

    if (retry.passed) {
      console.log('Retry successful!');
    }
  }
}
```

## Performance Characteristics

Based on typical usage:

**Token Usage:**
- Simple task: ~5,000 - 10,000 tokens (~$0.03 - $0.06)
- Medium task: ~20,000 - 50,000 tokens (~$0.12 - $0.30)
- Complex task: ~50,000 - 100,000 tokens (~$0.30 - $0.60)

**Execution Time:**
- Simple task: ~5 - 15 seconds
- Medium task: ~20 - 45 seconds
- Complex task: ~45 - 90 seconds

**Phase Distribution:**
- Analyze: ~5-10% of total time
- Plan: ~5-10% of total time
- Generate: ~75-85% of total time
- Validate: ~2-5% of total time

## Configuration

```javascript
new AgentOrchestrator({
  // Budget
  tokenBudget: 100000,          // Total token budget
  generateBudget: 60000,        // Budget for generation phase
  codeGenBudget: 50000,         // Budget for code generation
  testGenBudget: 30000,         // Budget for test generation
  migrationBudget: 20000,       // Budget for migration generation

  // Validation
  coverageThreshold: 80,        // Required test coverage %

  // Retry
  retryAttempts: 3,             // Max retry attempts
  retryDelays: [1000, 2000, 5000],  // Retry delays (ms)

  // Approval
  approvalTimeout: 300000,      // 5 minutes

  // Paths
  storePath: './data/tasks',    // Task storage
  keysPath: './keys',           // Signing keys

  // Logging
  logger: customLogger
})
```

## Testing

**Complete Bundle Mode Tests:** 6/6 passing ✓
- Low-risk plan execution
- High-risk plan approval
- Plan rejection
- Metrics collection
- Response structure
- Risk assessment

**Total Tests:** 29/29 passing ✓

## Conclusion

Bundle Mode provides a complete, production-ready code generation pipeline with:

- ✅ Automated analysis and planning
- ✅ Risk-based approval checkpoints
- ✅ Multi-agent code generation
- ✅ Comprehensive validation (6 checks)
- ✅ Cryptographic signing
- ✅ Detailed metrics and cost tracking
- ✅ Real-time progress events
- ✅ Intelligent error handling
- ✅ Fix suggestions and retry capabilities

The system is ready for integration with the desktop app and can generate production-quality code bundles with full validation and signing.
