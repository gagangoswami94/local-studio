/**
 * BundleApplier
 * Atomic bundle application with snapshot-based rollback
 *
 * Features:
 * - All-or-nothing application
 * - Automatic snapshot creation
 * - Conflict detection
 * - Progress events
 * - Full rollback on failure
 */

import { unpackBundle } from './BundleHandler';

/**
 * Apply a bundle atomically
 *
 * @param {Object} bundle - Bundle to apply
 * @param {Object} options - Application options
 * @param {boolean} options.skipSnapshot - Skip snapshot creation (default: false)
 * @param {boolean} options.skipValidation - Skip pre-apply validation (default: false)
 * @param {boolean} options.skipCommands - Skip running commands (default: false)
 * @param {boolean} options.skipMigrations - Skip migrations (default: false)
 * @param {Function} options.onProgress - Progress callback (step, data) => void
 * @param {Function} options.onConflict - Conflict handler (file, options) => 'ai' | 'local' | 'merge'
 * @returns {Promise<Object>} { success, snapshot, applied, errors }
 */
export async function applyBundle(bundle, options = {}) {
  const {
    skipSnapshot = false,
    skipValidation = false,
    skipCommands = false,
    skipMigrations = false,
    onProgress = () => {},
    onConflict = null
  } = options;

  let snapshot = null;
  let appliedFiles = [];
  let appliedMigrations = [];
  let executedCommands = [];

  try {
    // Step 1: Unpack bundle
    onProgress('unpacking', { message: 'Unpacking bundle...' });
    const { files, tests, migrations, commands } = unpackBundle(bundle);

    const allFiles = [...files, ...tests];

    onProgress('unpacked', {
      filesCount: allFiles.length,
      migrationsCount: migrations.length,
      commandsCount: commands.length
    });

    // Step 2: Create snapshot
    if (!skipSnapshot) {
      onProgress('snapshot_creating', { message: 'Creating snapshot...' });

      snapshot = await createSnapshot({
        bundleId: bundle.bundle_id,
        files: allFiles,
        migrations
      });

      onProgress('snapshot_created', { snapshotId: snapshot.id });
    }

    // Step 3: Validate
    if (!skipValidation) {
      onProgress('validating', { message: 'Validating changes...' });

      const validation = await validateBeforeApply(allFiles, migrations);

      if (!validation.canApply) {
        throw new ValidationError('Pre-apply validation failed', validation.errors);
      }

      // Check for conflicts
      if (validation.conflicts.length > 0) {
        onProgress('conflicts_detected', { conflicts: validation.conflicts });

        // Resolve conflicts
        for (const conflict of validation.conflicts) {
          const resolution = onConflict
            ? await onConflict(conflict)
            : 'fail'; // Default: fail on conflict

          if (resolution === 'fail' || resolution === 'cancel') {
            throw new ConflictError('Conflict detected and not resolved', conflict);
          }

          conflict.resolution = resolution;
        }
      }

      onProgress('validated', { conflicts: validation.conflicts.length });
    }

    // Step 4: Run pre-apply commands (e.g., npm install)
    if (!skipCommands) {
      const preCommands = commands.filter(cmd => isPreCommand(cmd.command));

      if (preCommands.length > 0) {
        onProgress('pre_commands_running', { count: preCommands.length });

        for (const cmd of preCommands) {
          onProgress('command_start', { command: cmd.command });

          const result = await executeCommand(cmd.command);

          if (!result.success) {
            throw new CommandError(`Pre-command failed: ${cmd.command}`, result.error);
          }

          executedCommands.push({ ...cmd, result });
          onProgress('command_complete', { command: cmd.command });
        }

        onProgress('pre_commands_complete', {});
      }
    }

    // Step 5: Apply file changes
    onProgress('files_applying', { total: allFiles.length });

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];

      onProgress('file_applying', {
        index: i,
        total: allFiles.length,
        file: file.path,
        action: file.action
      });

      try {
        await applyFile(file);
        appliedFiles.push(file);

        onProgress('file_applied', {
          index: i,
          total: allFiles.length,
          file: file.path
        });
      } catch (error) {
        throw new FileApplicationError(`Failed to apply ${file.path}`, error, file);
      }
    }

    onProgress('files_applied', { count: appliedFiles.length });

    // Step 6: Run migrations
    if (!skipMigrations && migrations.length > 0) {
      onProgress('migrations_running', { total: migrations.length });

      for (let i = 0; i < migrations.length; i++) {
        const migration = migrations[i];

        onProgress('migration_start', {
          index: i,
          total: migrations.length,
          migration: migration.id
        });

        try {
          await runMigration(migration);
          appliedMigrations.push(migration);

          onProgress('migration_complete', {
            index: i,
            total: migrations.length,
            migration: migration.id
          });
        } catch (error) {
          throw new MigrationError(`Migration ${migration.id} failed`, error, migration);
        }
      }

      onProgress('migrations_complete', { count: appliedMigrations.length });
    }

    // Step 7: Run post-apply commands
    if (!skipCommands) {
      const postCommands = commands.filter(cmd => !isPreCommand(cmd.command));

      if (postCommands.length > 0) {
        onProgress('post_commands_running', { count: postCommands.length });

        for (const cmd of postCommands) {
          onProgress('command_start', { command: cmd.command });

          const result = await executeCommand(cmd.command);

          if (!result.success) {
            // Post-commands are non-critical, just warn
            console.warn(`Post-command failed: ${cmd.command}`, result.error);
          }

          executedCommands.push({ ...cmd, result });
          onProgress('command_complete', { command: cmd.command });
        }

        onProgress('post_commands_complete', {});
      }
    }

    // Step 8: Verify success
    onProgress('verifying', { message: 'Verifying application...' });

    const verification = await verifyApplication(allFiles, migrations);

    if (!verification.success) {
      throw new VerificationError('Post-apply verification failed', verification.errors);
    }

    onProgress('verified', {});

    // Step 9: Complete
    onProgress('complete', {
      files: appliedFiles.length,
      migrations: appliedMigrations.length,
      commands: executedCommands.length
    });

    return {
      success: true,
      snapshot,
      applied: {
        files: appliedFiles,
        migrations: appliedMigrations,
        commands: executedCommands
      },
      errors: []
    };

  } catch (error) {
    // Rollback on any error
    console.error('[BundleApplier] Application failed:', error);

    onProgress('error', {
      message: error.message,
      step: error.step || 'unknown'
    });

    // Attempt rollback
    if (snapshot) {
      onProgress('rollback_starting', { snapshotId: snapshot.id });

      try {
        await rollbackToSnapshot(snapshot.id);

        onProgress('rollback_complete', { snapshotId: snapshot.id });
      } catch (rollbackError) {
        console.error('[BundleApplier] Rollback failed:', rollbackError);

        onProgress('rollback_failed', {
          snapshotId: snapshot.id,
          error: rollbackError.message
        });

        // Critical: rollback failed, workspace may be in inconsistent state
        return {
          success: false,
          snapshot,
          applied: {
            files: appliedFiles,
            migrations: appliedMigrations,
            commands: executedCommands
          },
          errors: [error, rollbackError],
          critical: true
        };
      }
    }

    return {
      success: false,
      snapshot,
      applied: {
        files: appliedFiles,
        migrations: appliedMigrations,
        commands: executedCommands
      },
      errors: [error]
    };
  }
}

/**
 * Create a snapshot of the current workspace state
 */
async function createSnapshot({ bundleId, files, migrations }) {
  const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Collect current state of files that will be modified
  const fileSnapshots = [];

  for (const file of files) {
    try {
      // Check if file exists
      const exists = await window.electron.invoke('file:exists', file.path);

      if (exists) {
        // Read current content
        const content = await window.electron.invoke('file:read', file.path);

        fileSnapshots.push({
          path: file.path,
          content,
          existed: true
        });
      } else {
        // File will be created
        fileSnapshots.push({
          path: file.path,
          content: null,
          existed: false
        });
      }
    } catch (error) {
      console.error(`Failed to snapshot ${file.path}:`, error);
    }
  }

  // Get current database state (for migrations)
  let dbSnapshot = null;
  if (migrations.length > 0) {
    try {
      dbSnapshot = await window.electron.invoke('db:snapshot');
    } catch (error) {
      console.warn('Failed to create database snapshot:', error);
    }
  }

  const snapshot = {
    id: snapshotId,
    bundleId,
    createdAt: new Date().toISOString(),
    files: fileSnapshots,
    database: dbSnapshot
  };

  // Store snapshot
  await window.electron.invoke('snapshot:save', snapshot);

  return snapshot;
}

/**
 * Validate that changes can be applied
 */
async function validateBeforeApply(files, migrations) {
  const errors = [];
  const conflicts = [];

  // Validate files
  for (const file of files) {
    // Check if file exists when it should
    const exists = await window.electron.invoke('file:exists', file.path);

    if (file.action === 'update' && !exists) {
      errors.push({
        file: file.path,
        message: `Cannot update non-existent file: ${file.path}`
      });
    }

    if (file.action === 'delete' && !exists) {
      errors.push({
        file: file.path,
        message: `Cannot delete non-existent file: ${file.path}`
      });
    }

    // Check for conflicts (file modified since plan)
    if ((file.action === 'update' || file.action === 'delete') && exists) {
      const currentContent = await window.electron.invoke('file:read', file.path);
      const expectedOldContent = file.oldContent || '';

      if (currentContent !== expectedOldContent) {
        conflicts.push({
          file: file.path,
          type: 'content_changed',
          message: `File ${file.path} has been modified since plan was created`,
          currentContent,
          expectedContent: expectedOldContent,
          newContent: file.content
        });
      }
    }

    // Check parent directory exists
    const parentDir = file.path.split('/').slice(0, -1).join('/');
    if (parentDir) {
      const parentExists = await window.electron.invoke('file:exists', parentDir);
      if (!parentExists) {
        errors.push({
          file: file.path,
          message: `Parent directory does not exist: ${parentDir}`
        });
      }
    }
  }

  // Validate migrations
  for (const migration of migrations) {
    // Check migration hasn't already been applied
    const applied = await window.electron.invoke('db:migration-applied', migration.id);

    if (applied) {
      errors.push({
        migration: migration.id,
        message: `Migration ${migration.id} has already been applied`
      });
    }
  }

  return {
    canApply: errors.length === 0,
    errors,
    conflicts
  };
}

/**
 * Apply a single file change
 */
async function applyFile(file) {
  const { path, content, action } = file;

  if (action === 'create' || action === 'update') {
    // Write file
    await window.electron.invoke('file:write', path, content);
  } else if (action === 'delete') {
    // Delete file
    await window.electron.invoke('file:delete', path);
  } else {
    throw new Error(`Unknown file action: ${action}`);
  }
}

/**
 * Run a database migration
 */
async function runMigration(migration) {
  const { id, sql_forward, dataLossRisk } = migration;

  // Warn if risky
  if (dataLossRisk && dataLossRisk !== 'none') {
    console.warn(`[BundleApplier] Running migration with ${dataLossRisk} data loss risk: ${id}`);
  }

  // Execute SQL
  await window.electron.invoke('db:execute', sql_forward);

  // Mark migration as applied
  await window.electron.invoke('db:migration-mark-applied', id);
}

/**
 * Execute a command
 */
async function executeCommand(command) {
  try {
    const result = await window.electron.invoke('shell:execute', command);

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if command is a pre-command (should run before files)
 */
function isPreCommand(command) {
  // Commands that install dependencies should run first
  const prePatterns = [
    /^npm install/,
    /^npm i /,
    /^yarn install/,
    /^yarn add/,
    /^pnpm install/,
    /^pip install/,
    /^bundle install/
  ];

  return prePatterns.some(pattern => pattern.test(command));
}

/**
 * Verify that application was successful
 */
async function verifyApplication(files, migrations) {
  const errors = [];

  // Verify files
  for (const file of files) {
    const exists = await window.electron.invoke('file:exists', file.path);

    if (file.action === 'create' || file.action === 'update') {
      if (!exists) {
        errors.push({
          file: file.path,
          message: `File was not created/updated: ${file.path}`
        });
      } else {
        // Verify content matches
        const content = await window.electron.invoke('file:read', file.path);
        if (content !== file.content) {
          errors.push({
            file: file.path,
            message: `File content does not match expected: ${file.path}`
          });
        }
      }
    } else if (file.action === 'delete') {
      if (exists) {
        errors.push({
          file: file.path,
          message: `File was not deleted: ${file.path}`
        });
      }
    }
  }

  // Verify migrations
  for (const migration of migrations) {
    const applied = await window.electron.invoke('db:migration-applied', migration.id);

    if (!applied) {
      errors.push({
        migration: migration.id,
        message: `Migration was not applied: ${migration.id}`
      });
    }
  }

  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Rollback to a snapshot
 */
async function rollbackToSnapshot(snapshotId) {
  console.log(`[BundleApplier] Rolling back to snapshot: ${snapshotId}`);

  // Load snapshot
  const snapshot = await window.electron.invoke('snapshot:load', snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  // Restore files
  for (const fileSnapshot of snapshot.files) {
    if (fileSnapshot.existed) {
      // Restore original content
      await window.electron.invoke('file:write', fileSnapshot.path, fileSnapshot.content);
    } else {
      // Delete file that was created
      const exists = await window.electron.invoke('file:exists', fileSnapshot.path);
      if (exists) {
        await window.electron.invoke('file:delete', fileSnapshot.path);
      }
    }
  }

  // Restore database
  if (snapshot.database) {
    await window.electron.invoke('db:restore', snapshot.database);
  }

  console.log(`[BundleApplier] Rollback complete: ${snapshotId}`);
}

/**
 * Post-apply actions
 */
export async function postApplyActions(applied) {
  const actions = [];

  // Reload workspace file tree
  actions.push({
    name: 'Reload workspace',
    action: async () => {
      await window.electron.invoke('workspace:reload');
    }
  });

  // Reopen modified files in editor
  if (applied.files.length > 0) {
    actions.push({
      name: 'Reopen modified files',
      action: async () => {
        for (const file of applied.files) {
          if (file.action === 'create' || file.action === 'update') {
            await window.electron.invoke('editor:open', file.path);
          }
        }
      }
    });
  }

  // Update git status
  actions.push({
    name: 'Update git status',
    action: async () => {
      await window.electron.invoke('git:status');
    }
  });

  // Execute all actions
  for (const { name, action } of actions) {
    try {
      await action();
      console.log(`[PostApply] ${name} - complete`);
    } catch (error) {
      console.error(`[PostApply] ${name} - failed:`, error);
    }
  }

  return {
    completed: actions.length,
    suggestions: [
      'Run tests to verify changes',
      'Review git diff before committing',
      'Check application logs for errors'
    ]
  };
}

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.step = 'validation';
    this.errors = errors;
  }
}

class ConflictError extends Error {
  constructor(message, conflict) {
    super(message);
    this.name = 'ConflictError';
    this.step = 'validation';
    this.conflict = conflict;
  }
}

class FileApplicationError extends Error {
  constructor(message, cause, file) {
    super(message);
    this.name = 'FileApplicationError';
    this.step = 'file_application';
    this.cause = cause;
    this.file = file;
  }
}

class MigrationError extends Error {
  constructor(message, cause, migration) {
    super(message);
    this.name = 'MigrationError';
    this.step = 'migration';
    this.cause = cause;
    this.migration = migration;
  }
}

class CommandError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CommandError';
    this.step = 'command';
    this.cause = cause;
  }
}

class VerificationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'VerificationError';
    this.step = 'verification';
    this.errors = errors;
  }
}

export default {
  applyBundle,
  postApplyActions
};
