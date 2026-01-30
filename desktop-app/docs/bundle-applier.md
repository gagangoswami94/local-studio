# Bundle Applier - Atomic Application System

## Overview

The BundleApplier provides atomic, all-or-nothing bundle application with automatic snapshot-based rollback, conflict detection, and comprehensive progress tracking.

**Key Features:**
- ✅ Atomic transactions (all-or-nothing)
- ✅ Automatic snapshot creation
- ✅ Conflict detection and resolution
- ✅ Progress events for UI updates
- ✅ Full rollback on failure
- ✅ Pre/post command execution
- ✅ Database migration support
- ✅ Verification after application

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                  applyBundle()                          │
├────────────────────────────────────────────────────────┤
│                                                         │
│  1. Unpack Bundle                                      │
│     ↓                                                  │
│  2. Create Snapshot ──────────────────┐               │
│     ↓                                  │               │
│  3. Validate Changes                   │               │
│     ├─ Check file conflicts            │               │
│     └─ Validate migrations             │               │
│     ↓                                  │               │
│  4. Run Pre-Commands                   │               │
│     └─ npm install, etc.               │               │
│     ↓                                  │               │
│  5. Apply Files ───────────────────────┼──┐            │
│     ├─ Create new files                │  │ Rollback   │
│     ├─ Update existing files           │  │ on Error   │
│     └─ Delete files                    │  │            │
│     ↓                                  │  │            │
│  6. Run Migrations ────────────────────┼──┤            │
│     └─ Execute SQL forward             │  │            │
│     ↓                                  │  │            │
│  7. Run Post-Commands ─────────────────┼──┤            │
│     ↓                                  │  │            │
│  8. Verify Application ────────────────┼──┘            │
│     ↓                                  │               │
│  9. Complete ──────────────────────────┘               │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Usage

### Basic Application

```javascript
import { applyBundle } from '../services/BundleApplier';
import BundleApplicationProgress from '../components/BundleApplicationProgress';

async function handleApply(bundle) {
  let progressCallback;

  const result = await applyBundle(bundle, {
    onProgress: (cb) => { progressCallback = cb; },
    onConflict: async (conflict) => {
      // Show conflict dialog and get resolution
      return await showConflictDialog(conflict);
    }
  });

  if (result.success) {
    console.log('Bundle applied successfully!');

    // Run post-apply actions
    await postApplyActions(result.applied);
  } else {
    console.error('Bundle application failed:', result.errors);

    if (result.critical) {
      alert('CRITICAL: Rollback failed! Workspace may be in inconsistent state.');
    }
  }
}
```

### With Progress UI

```javascript
import { applyBundle } from '../services/BundleApplier';
import BundleApplicationProgress from '../components/BundleApplicationProgress';
import ConflictDialog from '../components/ConflictDialog';

function BundleApplication({ bundle }) {
  const [isApplying, setIsApplying] = useState(false);
  const [progressHandler, setProgressHandler] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [conflictResolver, setConflictResolver] = useState(null);

  const handleApply = async () => {
    setIsApplying(true);

    const result = await applyBundle(bundle, {
      onProgress: (handler) => {
        setProgressHandler(() => handler);
      },
      onConflict: async (conflict) => {
        // Show conflict dialog and wait for resolution
        return new Promise((resolve) => {
          setConflict(conflict);
          setConflictResolver(() => resolve);
        });
      }
    });

    setIsApplying(false);

    if (result.success) {
      alert('Bundle applied successfully!');
    } else {
      alert(`Application failed: ${result.errors[0].message}`);
    }
  };

  const handleConflictResolve = (resolution) => {
    if (conflictResolver) {
      conflictResolver(resolution);
      setConflict(null);
      setConflictResolver(null);
    }
  };

  return (
    <div>
      <button onClick={handleApply} disabled={isApplying}>
        Apply Bundle
      </button>

      {isApplying && (
        <BundleApplicationProgress
          onProgress={progressHandler}
          onComplete={(data) => console.log('Complete:', data)}
          onError={(error) => console.error('Error:', error)}
        />
      )}

      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={handleConflictResolve}
        />
      )}
    </div>
  );
}
```

---

## API Reference

### applyBundle(bundle, options)

Applies a bundle atomically with rollback on failure.

**Parameters:**
- `bundle` (Object) - Bundle to apply
- `options` (Object) - Application options
  - `skipSnapshot` (Boolean) - Skip snapshot creation (default: false)
  - `skipValidation` (Boolean) - Skip pre-apply validation (default: false)
  - `skipCommands` (Boolean) - Skip running commands (default: false)
  - `skipMigrations` (Boolean) - Skip migrations (default: false)
  - `onProgress` (Function) - Progress callback: `(handler) => void`
  - `onConflict` (Function) - Conflict handler: `(conflict) => Promise<'ai' | 'local' | 'merge' | 'cancel'>`

**Returns:**
Promise<Object>
```javascript
{
  success: boolean,
  snapshot: Object,  // Snapshot created (if any)
  applied: {
    files: Array,    // Applied files
    migrations: Array, // Applied migrations
    commands: Array  // Executed commands
  },
  errors: Array,     // Errors encountered
  critical: boolean  // True if rollback failed
}
```

### postApplyActions(applied)

Performs post-application cleanup and suggestions.

**Parameters:**
- `applied` (Object) - Applied items from applyBundle result

**Returns:**
Promise<Object>
```javascript
{
  completed: number,      // Number of actions completed
  suggestions: Array<string> // Suggestions for user
}
```

---

## Application Flow

### Step 1: Unpack Bundle

Extracts files, tests, migrations, and commands from bundle.

**Progress Events:**
- `unpacking` - Starting unpacking
- `unpacked` - Complete with counts

### Step 2: Create Snapshot

Creates a snapshot of current workspace state for rollback.

**What's Captured:**
- Current content of all files that will be modified
- Database state (if migrations present)
- Timestamp and metadata

**Progress Events:**
- `snapshot_creating` - Starting snapshot
- `snapshot_created` - Complete with snapshot ID

**Skip:** Set `skipSnapshot: true` (not recommended for production)

### Step 3: Validate Changes

Validates that changes can be applied.

**Validation Checks:**
- File existence (can't update non-existent file)
- Parent directories exist
- Migrations not already applied
- File conflicts (content changed since plan)

**Progress Events:**
- `validating` - Starting validation
- `conflicts_detected` - Conflicts found (requires resolution)
- `validated` - Complete

**Conflict Resolution:**

If `onConflict` is provided, it's called for each conflict:

```javascript
const resolution = await onConflict({
  file: 'src/app.js',
  type: 'content_changed',
  message: 'File has been modified since plan',
  currentContent: '...',      // Current file content
  expectedContent: '...',     // Expected old content
  newContent: '...'           // AI-generated content
});

// resolution: 'ai' | 'local' | 'merge' | 'cancel'
```

**Resolution Options:**
- `ai` - Use AI version (replace file)
- `local` - Keep local version (skip this file)
- `merge` - Manual merge (opens merge editor)
- `cancel` - Cancel entire application

### Step 4: Run Pre-Commands

Executes commands that should run before files are applied.

**Pre-Commands:**
- `npm install` / `npm i`
- `yarn install` / `yarn add`
- `pnpm install`
- `pip install`
- `bundle install`

**Progress Events:**
- `pre_commands_running` - Starting
- `command_start` - Command started
- `command_complete` - Command finished
- `pre_commands_complete` - All complete

**Failure:** If pre-command fails, entire application is rolled back.

### Step 5: Apply Files

Applies file changes (create, update, delete).

**Progress Events:**
- `files_applying` - Starting (with total count)
- `file_applying` - File started (with index and path)
- `file_applied` - File completed
- `files_applied` - All files complete

**File Actions:**
- `create` - Write new file
- `update` - Replace existing file
- `delete` - Remove file

**Failure:** If any file fails, entire application is rolled back.

### Step 6: Run Migrations

Executes database migrations.

**Progress Events:**
- `migrations_running` - Starting (with total count)
- `migration_start` - Migration started
- `migration_complete` - Migration finished
- `migrations_complete` - All complete

**Migration Execution:**
1. Check not already applied
2. Execute SQL forward
3. Mark migration as applied

**Failure:** If migration fails, entire application is rolled back (including database).

### Step 7: Run Post-Commands

Executes commands after files are applied.

**Post-Commands:** All commands except pre-commands

**Progress Events:**
- `post_commands_running` - Starting
- `command_start` - Command started
- `command_complete` - Command finished
- `post_commands_complete` - All complete

**Failure:** Post-command failures are non-critical (logged as warnings).

### Step 8: Verify Application

Verifies that changes were applied correctly.

**Verification Checks:**
- Files created/updated/deleted as expected
- File content matches expected
- Migrations marked as applied

**Progress Events:**
- `verifying` - Starting verification
- `verified` - Complete

**Failure:** If verification fails, entire application is rolled back.

### Step 9: Complete

Application successful.

**Progress Events:**
- `complete` - Application complete (with counts)

---

## Rollback

If ANY step fails, the entire application is rolled back.

### Rollback Process

1. Emit `rollback_starting` event
2. Restore files from snapshot
   - Files that existed: restore original content
   - Files that were created: delete
3. Restore database from snapshot
4. Emit `rollback_complete` or `rollback_failed`

### Rollback Failure

If rollback fails (very rare), the result includes `critical: true`.

**What to do:**
- Workspace may be in inconsistent state
- Alert user immediately
- Suggest manual restoration from snapshot
- Consider creating bug report

---

## Conflict Resolution

### Conflict Types

**content_changed:**
File has been modified since plan was created.

```javascript
{
  file: 'src/app.js',
  type: 'content_changed',
  message: 'File has been modified since plan',
  currentContent: '...',  // What's in workspace now
  expectedContent: '...', // What AI expected
  newContent: '...'       // What AI wants to write
}
```

### ConflictDialog Component

Shows conflict and resolution options:

**Options:**
1. **Use AI Version** (recommended)
   - Replaces file with AI version
   - Local changes are lost

2. **Keep My Version**
   - Keeps local changes
   - Skips this file (AI changes not applied)

3. **Manual Merge** (advanced)
   - Opens merge editor
   - User manually combines versions

**Usage:**
```jsx
<ConflictDialog
  conflict={conflict}
  onResolve={(resolution) => {
    // resolution: 'ai' | 'local' | 'merge' | 'cancel'
  }}
/>
```

---

## Progress Events

All progress events are emitted through the `onProgress` callback:

```javascript
onProgress: (handler) => {
  // handler is a function: (step, data) => void
  // Call handler for each progress update
}
```

### Event Reference

| Event | Data | Description |
|-------|------|-------------|
| `unpacking` | `{ message }` | Starting to unpack bundle |
| `unpacked` | `{ filesCount, migrationsCount, commandsCount }` | Unpacking complete |
| `snapshot_creating` | `{ message }` | Creating snapshot |
| `snapshot_created` | `{ snapshotId }` | Snapshot created |
| `validating` | `{ message }` | Starting validation |
| `conflicts_detected` | `{ conflicts }` | Conflicts found |
| `validated` | `{ conflicts }` | Validation complete |
| `pre_commands_running` | `{ count }` | Starting pre-commands |
| `command_start` | `{ command }` | Command started |
| `command_complete` | `{ command }` | Command finished |
| `pre_commands_complete` | `{}` | All pre-commands done |
| `files_applying` | `{ total }` | Starting to apply files |
| `file_applying` | `{ index, total, file, action }` | Applying file |
| `file_applied` | `{ index, total, file }` | File applied |
| `files_applied` | `{ count }` | All files applied |
| `migrations_running` | `{ total }` | Starting migrations |
| `migration_start` | `{ index, total, migration }` | Migration started |
| `migration_complete` | `{ index, total, migration }` | Migration finished |
| `migrations_complete` | `{ count }` | All migrations done |
| `post_commands_running` | `{ count }` | Starting post-commands |
| `post_commands_complete` | `{}` | Post-commands done |
| `verifying` | `{ message }` | Starting verification |
| `verified` | `{}` | Verification complete |
| `complete` | `{ files, migrations, commands }` | Application complete |
| `error` | `{ message, step }` | Error occurred |
| `rollback_starting` | `{ snapshotId }` | Starting rollback |
| `rollback_complete` | `{ snapshotId }` | Rollback complete |
| `rollback_failed` | `{ snapshotId, error }` | Rollback failed |

---

## Post-Apply Actions

After successful application, perform cleanup:

```javascript
import { postApplyActions } from '../services/BundleApplier';

const result = await applyBundle(bundle, options);

if (result.success) {
  const postResult = await postApplyActions(result.applied);

  console.log('Completed actions:', postResult.completed);
  console.log('Suggestions:', postResult.suggestions);
}
```

### Actions Performed

1. **Reload Workspace** - Refresh file tree
2. **Reopen Modified Files** - Open files in editor
3. **Update Git Status** - Refresh git state

### Suggestions

- Run tests to verify changes
- Review git diff before committing
- Check application logs for errors

---

## Error Handling

### Error Types

**ValidationError:**
Pre-apply validation failed.
```javascript
{
  name: 'ValidationError',
  step: 'validation',
  errors: [{ file, message }, ...]
}
```

**ConflictError:**
Conflict detected and not resolved.
```javascript
{
  name: 'ConflictError',
  step: 'validation',
  conflict: { file, type, message, ... }
}
```

**FileApplicationError:**
Failed to apply file.
```javascript
{
  name: 'FileApplicationError',
  step: 'file_application',
  file: { path, action, ... },
  cause: Error
}
```

**MigrationError:**
Migration failed.
```javascript
{
  name: 'MigrationError',
  step: 'migration',
  migration: { id, description, ... },
  cause: Error
}
```

**CommandError:**
Command execution failed.
```javascript
{
  name: 'CommandError',
  step: 'command',
  cause: Error
}
```

**VerificationError:**
Post-apply verification failed.
```javascript
{
  name: 'VerificationError',
  step: 'verification',
  errors: [{ file, message }, ...]
}
```

### Handling Errors

```javascript
const result = await applyBundle(bundle, options);

if (!result.success) {
  const error = result.errors[0];

  switch (error.name) {
    case 'ValidationError':
      console.error('Validation failed:', error.errors);
      break;

    case 'ConflictError':
      console.error('Conflict not resolved:', error.conflict);
      break;

    case 'FileApplicationError':
      console.error('File application failed:', error.file.path, error.cause);
      break;

    case 'MigrationError':
      console.error('Migration failed:', error.migration.id, error.cause);
      break;

    case 'CommandError':
      console.error('Command failed:', error.cause);
      break;

    case 'VerificationError':
      console.error('Verification failed:', error.errors);
      break;

    default:
      console.error('Unknown error:', error);
  }

  // Check if rollback failed
  if (result.critical) {
    alert('CRITICAL: Rollback failed! Workspace may be in inconsistent state.');
    // Suggest manual restoration
  }
}
```

---

## Best Practices

### 1. Always Create Snapshots

Don't skip snapshot creation in production:

```javascript
// ❌ BAD
await applyBundle(bundle, { skipSnapshot: true });

// ✅ GOOD
await applyBundle(bundle, {});
```

### 2. Handle Conflicts

Always provide conflict handler:

```javascript
await applyBundle(bundle, {
  onConflict: async (conflict) => {
    // Show conflict dialog
    return await showConflictDialog(conflict);
  }
});
```

### 3. Show Progress to User

Use progress UI for better UX:

```javascript
<BundleApplicationProgress
  onProgress={progressHandler}
  onComplete={(data) => console.log('Done!')}
  onError={(error) => console.error('Failed!')}
/>
```

### 4. Verify Before Production

Test bundle application in development first:

```javascript
if (process.env.NODE_ENV === 'production') {
  const confirmed = confirm('Apply bundle in production?');
  if (!confirmed) return;
}
```

### 5. Run Post-Apply Actions

Always run post-apply actions:

```javascript
if (result.success) {
  await postApplyActions(result.applied);
}
```

---

## Troubleshooting

### Issue: Snapshot Creation Fails

**Cause:** Insufficient permissions or disk space

**Solution:**
- Check file permissions
- Check disk space
- Try with `skipSnapshot: true` (not recommended)

### Issue: Conflict Resolution Hangs

**Cause:** `onConflict` not responding

**Solution:**
- Ensure conflict dialog is shown
- Check promise is being resolved
- Add timeout to conflict resolution

### Issue: Rollback Fails

**Cause:** Snapshot corrupted or file permissions

**Solution:**
- Alert user immediately
- Show snapshot location
- Suggest manual restoration
- Create bug report

### Issue: Migration Already Applied

**Cause:** Migration was applied in previous run

**Solution:**
- Check migration tracking
- Skip migration or regenerate bundle
- Consider migration versioning

---

## Example: Complete Workflow

```javascript
import { applyBundle, postApplyActions } from '../services/BundleApplier';
import BundleApplicationProgress from '../components/BundleApplicationProgress';
import ConflictDialog from '../components/ConflictDialog';

function CompleteBundleApplication({ bundle }) {
  const [stage, setStage] = useState('ready'); // ready, applying, complete, error
  const [progressHandler, setProgressHandler] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [conflictResolver, setConflictResolver] = useState(null);
  const [result, setResult] = useState(null);

  const handleApply = async () => {
    setStage('applying');

    const applicationResult = await applyBundle(bundle, {
      onProgress: (handler) => {
        setProgressHandler(() => handler);
      },
      onConflict: async (conflict) => {
        return new Promise((resolve) => {
          setConflict(conflict);
          setConflictResolver(() => resolve);
        });
      }
    });

    if (applicationResult.success) {
      // Run post-apply actions
      await postApplyActions(applicationResult.applied);

      setResult(applicationResult);
      setStage('complete');
    } else {
      setResult(applicationResult);
      setStage('error');

      if (applicationResult.critical) {
        alert('CRITICAL: Rollback failed! Check console for details.');
      }
    }
  };

  const handleConflictResolve = (resolution) => {
    if (conflictResolver) {
      conflictResolver(resolution);
      setConflict(null);
      setConflictResolver(null);
    }
  };

  return (
    <div>
      {stage === 'ready' && (
        <button onClick={handleApply}>Apply Bundle</button>
      )}

      {stage === 'applying' && (
        <BundleApplicationProgress
          onProgress={progressHandler}
          onComplete={(data) => console.log('Complete:', data)}
          onError={(error) => console.error('Error:', error)}
        />
      )}

      {stage === 'complete' && (
        <div>
          <h2>✓ Bundle Applied Successfully</h2>
          <p>Applied {result.applied.files.length} files</p>
          <p>Ran {result.applied.migrations.length} migrations</p>
          <p>Executed {result.applied.commands.length} commands</p>
          <h3>Next Steps:</h3>
          <ul>
            <li>Run tests to verify changes</li>
            <li>Review git diff before committing</li>
            <li>Check application logs for errors</li>
          </ul>
        </div>
      )}

      {stage === 'error' && (
        <div>
          <h2>✗ Application Failed</h2>
          <p>{result.errors[0].message}</p>
          <p>Step: {result.errors[0].step}</p>
        </div>
      )}

      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={handleConflictResolve}
        />
      )}
    </div>
  );
}
```

---

## Summary

The BundleApplier provides:

✅ **Atomic Application** - All-or-nothing with rollback
✅ **Snapshot Protection** - Automatic workspace backup
✅ **Conflict Resolution** - Interactive conflict handling
✅ **Progress Tracking** - Real-time UI updates
✅ **Error Recovery** - Full rollback on failure
✅ **Command Execution** - Pre/post command support
✅ **Migration Support** - Database migrations with tracking
✅ **Verification** - Post-apply validation

**Ready for production use with comprehensive error handling and user feedback!**
