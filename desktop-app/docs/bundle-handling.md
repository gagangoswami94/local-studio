# Bundle Handling in Desktop App

## Overview

The desktop app provides a complete bundle handling system that integrates with the cloud API to generate, verify, and apply code bundles. This system includes real-time progress tracking, cryptographic verification, and comprehensive error handling.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Desktop App                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │  API Service │───────▶│ Cloud API    │                  │
│  └──────────────┘        └──────────────┘                  │
│         │                        │                           │
│         │  Bundle +          WebSocket                      │
│         │  Progress          Events                         │
│         ↓                        ↓                           │
│  ┌──────────────────────────────────────┐                  │
│  │    BundleProgress Component          │                  │
│  │  - Phase tracking                    │                  │
│  │  - Validation checks                 │                  │
│  │  - Approval handling                 │                  │
│  │  - Metrics display                   │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         │  Bundle                                           │
│         ↓                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │     BundleHandler Service            │                  │
│  │  - Signature verification            │                  │
│  │  - Bundle unpacking                  │                  │
│  │  - Change summary                    │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         │  Files                                            │
│         ↓                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │      File System (Apply Changes)      │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. API Service (`services/api.js`)

Handles all communication with the cloud API.

**Bundle Generation:**
```javascript
import { generateBundle } from '../services/api';

const result = await generateBundle({
  message: 'Add user authentication',
  context: [
    { path: 'src/server.js', content: '...' }
  ],
  workspaceFiles: ['src/routes/users.js'],
  appSpec: { stack: 'node-express' },
  requireApproval: true
}, (type, data) => {
  // Progress callback
  console.log('Progress:', type, data);
});
```

**Other Methods:**
- `downloadBundle(bundleId)` - Fetch bundle by ID
- `getBundleStatus(taskId)` - Check generation status
- `submitApproval(taskId, approval)` - Approve/reject plan
- `retryValidation(taskId, options)` - Retry with different parameters
- `regenerateBundle(taskId, options)` - Regenerate with fixes

### 2. BundleHandler Service (`services/BundleHandler.js`)

Handles bundle verification and processing.

**Verify Bundle:**
```javascript
import { verifyBundle } from '../services/BundleHandler';

const isValid = await verifyBundle(bundle);

if (!isValid) {
  throw new Error('Bundle signature is invalid!');
}
```

**Unpack Bundle:**
```javascript
import { unpackBundle } from '../services/BundleHandler';

const { files, tests, migrations, commands } = unpackBundle(bundle);

// Apply files
for (const file of files) {
  await applyFile(file);
}

// Run commands
for (const cmd of commands) {
  await runCommand(cmd.command);
}

// Run migrations
for (const migration of migrations) {
  await runMigration(migration);
}
```

**Get Change Summary:**
```javascript
import { getChangeSummary } from '../services/BundleHandler';

const summary = getChangeSummary(bundle);

console.log(summary.overview);
// "This bundle creates 3 file(s), updates 2 file(s), adds 5 test(s), includes 1 migration(s)"

console.log('Statistics:', summary.statistics);
// { filesChanged: 5, linesAdded: 250, linesRemoved: 10, testsAdded: 5, migrationsAdded: 1 }

console.log('Risks:', summary.risks);
// [{ level: 'medium', message: 'Database migrations present - backup your database before applying' }]
```

### 3. BundleProgress Component (`components/BundleProgress.jsx`)

Shows real-time progress of bundle generation.

**Usage:**
```jsx
import BundleProgress from '../components/BundleProgress';

function MyComponent() {
  const [taskId, setTaskId] = useState(null);

  const handleGenerate = async () => {
    const result = await generateBundle(request, (type, data) => {
      // Forward progress events to component
      if (window.__bundleProgressHandler) {
        window.__bundleProgressHandler.emit(type, data);
      }
    });

    setTaskId(result.taskId);
  };

  return (
    <div>
      <button onClick={handleGenerate}>Generate Bundle</button>

      {taskId && (
        <BundleProgress
          taskId={taskId}
          onCancel={() => {
            // Cancel generation
          }}
          onApproval={(approved) => {
            // Handle approval
            submitApproval(taskId, { approved });
          }}
        />
      )}
    </div>
  );
}
```

## Complete Workflow

### Step 1: Initiate Bundle Generation

```javascript
import { generateBundle } from '../services/api';

// Prepare request
const request = {
  message: 'Add JWT authentication to API',
  context: [
    { path: 'src/server.js', content: readFile('src/server.js') },
    { path: 'src/routes/users.js', content: readFile('src/routes/users.js') }
  ],
  workspaceFiles: getAllWorkspaceFiles(),
  appSpec: {
    stack: 'node-express',
    database: 'postgresql'
  },
  requireApproval: true
};

// Start generation with progress tracking
const result = await generateBundle(request, (type, data) => {
  handleProgressEvent(type, data);
});
```

### Step 2: Handle Progress Events

```javascript
function handleProgressEvent(type, data) {
  switch (type) {
    case 'task_start':
      showProgress('Starting bundle generation...');
      break;

    case 'code_analyzing':
      if (data.status === 'started') {
        showProgress('Analyzing request...');
      }
      break;

    case 'code_planning':
      if (data.status === 'started') {
        showProgress('Creating implementation plan...');
      }
      break;

    case 'approval_required':
      showApprovalDialog(data.plan, data.riskAssessment);
      break;

    case 'code_generating':
      if (data.status === 'started') {
        showProgress('Generating code...');
      }
      break;

    case 'validation_check_start':
      showProgress(`Running ${data.check}...`);
      break;

    case 'validation_check_complete':
      showCheckResult(data.check, data.passed);
      break;

    case 'task_complete':
      showSuccess('Bundle generation complete!');
      break;

    case 'task_error':
      showError(data.error);
      break;
  }
}
```

### Step 3: Handle Approval (if required)

```javascript
async function handleApproval(approved, modifiedPlan = null) {
  await submitApproval(taskId, {
    approved,
    reason: approved ? null : 'Too risky',
    modifiedPlan
  });

  if (approved) {
    // Continue generation
    showProgress('Plan approved, continuing generation...');
  } else {
    // Cancel generation
    showMessage('Plan rejected');
  }
}
```

### Step 4: Verify Bundle

```javascript
import { verifyBundle } from '../services/BundleHandler';

if (!result.success) {
  showError(result.error);
  return;
}

const bundle = result.bundle;

// Verify signature
showProgress('Verifying bundle signature...');

const isValid = await verifyBundle(bundle);

if (!isValid) {
  showError('Bundle verification failed! The bundle may be corrupted or tampered with.');
  return;
}

showSuccess('Bundle signature verified ✓');
```

### Step 5: Review Changes

```javascript
import { getChangeSummary } from '../services/BundleHandler';

// Get summary
const summary = getChangeSummary(bundle);

// Show summary to user
showSummary({
  overview: summary.overview,
  statistics: summary.statistics,
  changes: summary.changes,
  warnings: summary.warnings,
  risks: summary.risks
});

// Let user review
const confirmed = await confirmApply(summary);

if (!confirmed) {
  showMessage('Bundle application cancelled');
  return;
}
```

### Step 6: Apply Bundle

```javascript
import { unpackBundle } from '../services/BundleHandler';

// Unpack bundle
const { files, tests, migrations, commands } = unpackBundle(bundle);

try {
  // Apply files
  showProgress('Applying file changes...');
  for (const file of files) {
    await applyFile(file);
  }

  // Run commands (npm install, etc.)
  if (commands.length > 0) {
    showProgress('Running commands...');
    for (const cmd of commands) {
      await runCommand(cmd.command);
    }
  }

  // Run migrations
  if (migrations.length > 0) {
    showProgress('Running database migrations...');
    for (const migration of migrations) {
      await runMigration(migration);
    }
  }

  showSuccess('Bundle applied successfully!');

} catch (error) {
  showError(`Failed to apply bundle: ${error.message}`);

  // Offer rollback
  const shouldRollback = await confirmRollback();
  if (shouldRollback) {
    await rollbackChanges(bundle);
  }
}
```

## Error Handling

### Network Errors

```javascript
try {
  const result = await generateBundle(request);
} catch (error) {
  if (error.type === 'network') {
    showError({
      title: 'Connection Error',
      message: "Can't connect to cloud API",
      actions: [
        { label: 'Check API Status', action: () => checkApiStatus() },
        { label: 'Retry', action: () => retryGeneration() }
      ]
    });
  }
}
```

### Validation Errors

```javascript
if (!result.success && result.error.type === 'validation') {
  const { blockers, suggestions } = result.validation;

  showValidationError({
    title: 'Bundle Validation Failed',
    blockers: blockers.map(b => ({
      check: b.check,
      message: b.message
    })),
    suggestions: suggestions.map(s => ({
      title: s.title,
      description: s.description,
      actions: s.actions
    })),
    actions: [
      { label: 'Retry with Lower Coverage', action: () => retryWithLowerCoverage() },
      { label: 'Regenerate with Fixes', action: () => regenerateWithFixes(suggestions) },
      { label: 'Cancel', action: () => cancel() }
    ]
  });
}
```

### Signature Verification Errors

```javascript
const isValid = await verifyBundle(bundle);

if (!isValid) {
  showError({
    title: 'Bundle Verification Failed',
    message: 'The bundle signature is invalid. This bundle may be corrupted or tampered with.',
    severity: 'critical',
    actions: [
      { label: 'Download Again', action: () => downloadBundle(bundle.bundle_id) },
      { label: 'Cancel', action: () => cancel() }
    ]
  });

  // DO NOT apply the bundle
  return;
}
```

## Security Considerations

### 1. Always Verify Signatures

```javascript
// ❌ BAD: Applying bundle without verification
const { files } = unpackBundle(bundle);
await applyFiles(files); // DANGEROUS!

// ✅ GOOD: Always verify first
const isValid = await verifyBundle(bundle);
if (!isValid) {
  throw new Error('Bundle verification failed');
}

const { files } = unpackBundle(bundle);
await applyFiles(files); // Safe
```

### 2. Show Change Summary

```javascript
// ❌ BAD: Applying bundle without user review
await applyBundle(bundle); // User doesn't know what's changing

// ✅ GOOD: Show summary and get confirmation
const summary = getChangeSummary(bundle);
const confirmed = await showSummaryAndConfirm(summary);

if (confirmed) {
  await applyBundle(bundle);
}
```

### 3. Handle Risks Appropriately

```javascript
const summary = getChangeSummary(bundle);

// Check for high-risk changes
const highRisks = summary.risks.filter(r => r.level === 'high');

if (highRisks.length > 0) {
  const confirmed = await showHighRiskWarning({
    risks: highRisks,
    requireExplicitConfirmation: true
  });

  if (!confirmed) {
    return; // Don't apply high-risk bundle without explicit confirmation
  }
}
```

## Testing

### Mock Bundle Generation

```javascript
// For testing UI without API
const mockGenerateBundle = (request, onProgress) => {
  return new Promise((resolve) => {
    setTimeout(() => onProgress('task_start', {}), 100);
    setTimeout(() => onProgress('code_analyzing', { status: 'started' }), 500);
    setTimeout(() => onProgress('code_analyzing', { status: 'completed' }), 1500);
    setTimeout(() => onProgress('code_planning', { status: 'started' }), 2000);
    setTimeout(() => onProgress('code_planning', { status: 'completed' }), 3000);
    setTimeout(() => onProgress('code_generating', { status: 'started' }), 3500);
    setTimeout(() => onProgress('code_generating', { status: 'completed' }), 6000);
    setTimeout(() => onProgress('code_validating', { status: 'started', totalChecks: 6 }), 6500);

    const checks = ['SyntaxCheck', 'DependencyCheck', 'SchemaCheck', 'TestCoverageCheck', 'SecurityCheck', 'MigrationReversibilityCheck'];
    checks.forEach((check, i) => {
      setTimeout(() => onProgress('validation_check_start', { check }), 7000 + i * 500);
      setTimeout(() => onProgress('validation_check_complete', { check, passed: true }), 7200 + i * 500);
    });

    setTimeout(() => onProgress('task_complete', { tokensUsed: 45000 }), 10000);

    setTimeout(() => resolve({
      success: true,
      taskId: 'mock-task-123',
      bundle: createMockBundle(),
      validation: { passed: true, blockers: [], warnings: [] },
      metrics: { tokensUsed: { total: 45000 }, timeMs: { total: 10000 }, estimatedCost: 0.21 }
    }), 10000);
  });
};
```

## Performance Tips

1. **Use WebSocket for Progress**
   - Reduces HTTP polling overhead
   - Real-time updates
   - Better user experience

2. **Cache Bundle Verifications**
   - Verification is CPU-intensive
   - Cache verified bundles by bundle_id
   - Re-verify only if bundle changes

3. **Show Progress Incrementally**
   - Don't wait for completion to show anything
   - Show each phase as it completes
   - Keeps user engaged

4. **Handle Large Bundles**
   - Show file count early
   - Apply files in batches
   - Show progress per file

## Troubleshooting

### Bundle Verification Always Fails

1. Check public key is correct
2. Ensure clock is synchronized
3. Check signature timestamp age

### WebSocket Connection Fails

1. Check API is running
2. Verify WebSocket endpoint
3. Check CORS settings

### Approval Not Working

1. Verify `submitApproval` is called
2. Check taskId matches
3. Ensure approval sent before timeout

## Conclusion

The bundle handling system provides a complete, secure workflow for generating and applying code bundles. Key features:

- ✅ Real-time progress tracking
- ✅ Cryptographic verification
- ✅ Risk-based approvals
- ✅ Comprehensive error handling
- ✅ Change summaries
- ✅ Rollback support

Always verify signatures, show change summaries, and handle errors appropriately to ensure a secure and reliable experience.
