# DiffReviewModal Component

## Overview

The `DiffReviewModal` is a full-screen modal component for reviewing bundle changes before applying them. It provides a comprehensive interface for examining file diffs, selecting which files to apply, and reviewing database migrations.

## Features

✅ **File List with Grouping** - Group files by action (Created/Modified/Deleted)
✅ **Side-by-Side Diffs** - Monaco-powered diff viewer with syntax highlighting
✅ **File Selection** - Choose which files to apply with checkboxes
✅ **Keyboard Navigation** - Arrow keys to navigate between files
✅ **Migration Review** - View SQL with forward/reverse tabs and data loss warnings
✅ **Change Statistics** - +/- line counts per file
✅ **Responsive Layout** - Left sidebar + main diff area + bottom actions

---

## Usage

### Basic Example

```jsx
import React, { useState } from 'react';
import DiffReviewModal from '../components/DiffReviewModal';
import { verifyBundle, unpackBundle } from '../services/BundleHandler';

function BundleReview({ bundle }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleApply = async (fileIndices) => {
    console.log('Applying selected files:', fileIndices);

    // Apply only selected files
    const selectedFiles = fileIndices.map(i => bundle.files[i]);

    for (const file of selectedFiles) {
      await applyFile(file);
    }

    setIsModalOpen(false);
  };

  const handleApplyAll = async () => {
    console.log('Applying all files');

    // Apply all files
    const { files, tests, migrations, commands } = unpackBundle(bundle);

    for (const file of files) {
      await applyFile(file);
    }

    // Run migrations
    for (const migration of migrations) {
      await runMigration(migration);
    }

    // Run commands
    for (const cmd of commands) {
      await runCommand(cmd.command);
    }

    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>
        Review Changes
      </button>

      <DiffReviewModal
        bundle={bundle}
        onApply={handleApply}
        onApplyAll={handleApplyAll}
        onCancel={handleCancel}
        isOpen={isModalOpen}
      />
    </div>
  );
}
```

---

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `bundle` | Object | Yes | Bundle object with files, tests, migrations |
| `onApply` | Function | Yes | Called when user clicks "Apply Selected". Receives array of file indices. |
| `onApplyAll` | Function | Yes | Called when user clicks "Apply All". No arguments. |
| `onCancel` | Function | Yes | Called when user cancels (close button or Escape key). |
| `isOpen` | Boolean | Yes | Whether modal is visible. |

---

## Bundle Structure

The component expects a bundle object with this structure:

```javascript
{
  bundle_id: 'bundle_abc123',
  files: [
    {
      path: 'src/components/UserAuth.jsx',
      content: '...', // New content
      action: 'create', // 'create' | 'update' | 'delete'
      description: 'User authentication component',
      layer: 'application'
    },
    // ... more files
  ],
  tests: [
    {
      path: 'src/components/UserAuth.test.jsx',
      content: '...',
      sourceFile: 'src/components/UserAuth.jsx',
      framework: 'vitest'
    },
    // ... more tests
  ],
  migrations: [
    {
      id: 'migration_001',
      description: 'Add users table',
      sql_forward: 'CREATE TABLE users (...);',
      sql_reverse: 'DROP TABLE users;',
      dataLossRisk: 'none', // 'none' | 'low' | 'medium' | 'high'
      database: 'postgresql'
    },
    // ... more migrations
  ]
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow Left` / `Arrow Up` | Previous file |
| `Arrow Right` / `Arrow Down` | Next file |
| `Escape` | Close modal |

---

## Component Features

### 1. File List Sidebar

- **Group by Action**: Files are grouped into Created/Modified/Deleted sections
- **Checkboxes**: Select which files to apply
- **Select All/Deselect All**: Bulk selection controls
- **Change Indicators**: +/- line counts per file
- **Current File Highlight**: Active file is highlighted with blue border

### 2. Diff Viewer

- **Monaco Editor**: Uses Monaco's built-in diff viewer
- **Syntax Highlighting**: Automatic language detection based on file extension
- **Side-by-Side View**: Shows old vs. new content side-by-side
- **File Action Badge**: Visual indicator (+ for created, ~ for modified, - for deleted)
- **File Stats**: Line addition/deletion counts in header
- **Description**: Shows file description below header (if available)

### 3. Migrations Viewer

- **Migration List**: Dropdown to select migration (if multiple)
- **Forward/Reverse Tabs**: View SQL for applying or rolling back
- **Data Loss Warning**: Red warning banner for risky migrations
- **Metadata**: Shows migration ID, database type, risk level
- **SQL Display**: Syntax-highlighted SQL code

### 4. Footer Controls

- **Navigation**: Previous/Next buttons with X of Y indicator
- **Cancel**: Abort and close modal
- **Apply Selected**: Apply only checked files (shows count)
- **Apply All**: Apply all files regardless of selection

---

## Styling

The component uses CSS custom properties for theming:

```css
--bg-primary: #1e1e1e
--bg-secondary: #252526
--bg-tertiary: #2a2a2a
--bg-hover: #2a2d2e
--bg-active: #37373d
--border-color: #3e3e3e
--text-primary: #e0e0e0
--text-secondary: #a0a0a0
--text-tertiary: #666
--accent-color: #007acc
```

Override these in your app's CSS to match your theme.

---

## Integration with Bundle Workflow

### Complete Workflow Example

```jsx
import { generateBundle } from '../services/api';
import { verifyBundle, getChangeSummary } from '../services/BundleHandler';
import DiffReviewModal from '../components/DiffReviewModal';
import BundleProgress from '../components/BundleProgress';

function BundleWorkflow() {
  const [taskId, setTaskId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [showReview, setShowReview] = useState(false);

  // Step 1: Start generation
  const handleGenerate = async () => {
    const result = await generateBundle({
      message: 'Add user authentication',
      context: [...],
      workspaceFiles: [...],
      requireApproval: true
    }, (type, data) => {
      // Progress callback
      console.log('Progress:', type, data);
    });

    setTaskId(result.taskId);
  };

  // Step 2: Show progress
  const handleComplete = async (bundleData) => {
    // Verify signature
    const isValid = await verifyBundle(bundleData);
    if (!isValid) {
      alert('Bundle signature invalid!');
      return;
    }

    // Get change summary
    const summary = getChangeSummary(bundleData);
    console.log('Changes:', summary.overview);
    console.log('Risks:', summary.risks);

    // Show review modal
    setBundle(bundleData);
    setShowReview(true);
  };

  // Step 3: Apply files
  const handleApply = async (fileIndices) => {
    for (const index of fileIndices) {
      const file = bundle.files[index];
      await applyFile(file);
    }

    alert('Files applied successfully!');
    setShowReview(false);
  };

  return (
    <div>
      {!taskId && (
        <button onClick={handleGenerate}>
          Generate Bundle
        </button>
      )}

      {taskId && !bundle && (
        <BundleProgress
          taskId={taskId}
          onCancel={() => setTaskId(null)}
          onApproval={(approved) => {
            submitApproval(taskId, { approved });
          }}
        />
      )}

      {bundle && (
        <DiffReviewModal
          bundle={bundle}
          onApply={handleApply}
          onApplyAll={async () => {
            // Apply all files, migrations, commands
            const { files, migrations, commands } = unpackBundle(bundle);

            for (const file of files) await applyFile(file);
            for (const migration of migrations) await runMigration(migration);
            for (const cmd of commands) await runCommand(cmd.command);

            setShowReview(false);
          }}
          onCancel={() => setShowReview(false)}
          isOpen={showReview}
        />
      )}
    </div>
  );
}
```

---

## File Application

Example file application function:

```javascript
async function applyFile(file) {
  const { path, content, action } = file;

  if (action === 'delete') {
    // Delete file
    await window.electron.invoke('file:delete', path);
  } else if (action === 'create' || action === 'update') {
    // Create or update file
    await window.electron.invoke('file:write', path, content);
  }

  console.log(`Applied: ${action} ${path}`);
}
```

---

## Migration Execution

Example migration execution:

```javascript
async function runMigration(migration) {
  const { id, description, sql_forward, dataLossRisk } = migration;

  // Warn user if data loss risk
  if (dataLossRisk !== 'none') {
    const confirmed = confirm(
      `Migration "${description}" has ${dataLossRisk} data loss risk. Continue?`
    );

    if (!confirmed) {
      throw new Error('Migration cancelled by user');
    }
  }

  // Execute SQL
  try {
    await window.electron.invoke('db:execute', sql_forward);
    console.log(`Migration ${id} applied successfully`);
  } catch (error) {
    console.error(`Migration ${id} failed:`, error);
    throw error;
  }
}
```

---

## Advanced Features

### Filtering Files by Layer

```jsx
<DiffReviewModal
  bundle={{
    ...bundle,
    files: bundle.files.filter(f => f.layer === 'application')
  }}
  // ...
/>
```

### Pre-selecting Files

The component auto-selects all files by default. To customize:

```jsx
// Modify the component to accept initialSelectedFiles prop
// Or filter the bundle before passing to the modal
```

### Custom File Ordering

```jsx
const sortedBundle = {
  ...bundle,
  files: [...bundle.files].sort((a, b) => {
    // Sort by action: create, update, delete
    const order = { create: 0, update: 1, delete: 2 };
    return order[a.action] - order[b.action];
  })
};

<DiffReviewModal bundle={sortedBundle} ... />
```

---

## Troubleshooting

### Monaco Editor Not Loading

If the diff viewer shows "Loading diff viewer..." indefinitely:

1. Check that Monaco is properly initialized in the app
2. Verify that `@monaco-editor/react` is installed
3. Check console for Monaco errors

### Diffs Not Showing

If diffs appear empty:

1. Verify `file.content` and `file.oldContent` are strings
2. Check that `file.path` has a valid file extension for language detection
3. Look for errors in browser console

### Keyboard Navigation Not Working

If arrow keys don't navigate:

1. Click inside the modal to focus it
2. Ensure no input fields are focused
3. Check browser console for JavaScript errors

---

## Accessibility

The component supports:

- ✅ Keyboard navigation (arrow keys, Escape)
- ✅ Semantic HTML structure
- ✅ Focus management
- ✅ High contrast mode support
- ⚠️ Screen reader support (basic - can be improved)

---

## Performance

**Optimizations:**

- Uses `useMemo` for expensive calculations (grouping, stats)
- Monaco diff viewer handles large files efficiently
- Only renders visible file in main area
- Lazy-loads migration SQL

**Limits:**

- Works well with 100+ files
- Monaco may struggle with files > 10,000 lines
- Consider pagination for 500+ files

---

## Future Enhancements

- [ ] Search/filter files by path
- [ ] Unified view option (single column)
- [ ] Collapse unchanged sections
- [ ] Export diff as patch file
- [ ] Conflict resolution UI
- [ ] Syntax highlighting for migrations SQL
- [ ] Undo/redo support
- [ ] Snapshot comparison

---

## Related Components

- **DiffViewer** - Monaco-based diff viewer (used internally)
- **BundleProgress** - Progress tracking during generation
- **BundleHandler** - Verification and unpacking utilities

---

## License

Part of Local Studio Desktop App. See project LICENSE.
