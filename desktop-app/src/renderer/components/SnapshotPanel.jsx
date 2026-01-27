import React, { useEffect, useState } from 'react';
import useSnapshotStore from '../store/snapshotStore';
import useWorkspaceStore from '../store/workspaceStore';

const SnapshotPanel = () => {
  const {
    snapshots,
    isLoading,
    isCreating,
    isRestoring,
    error,
    loadSnapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot
  } = useSnapshotStore();

  const { workspacePath } = useWorkspaceStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [description, setDescription] = useState('');

  // Load snapshots on mount and when workspace changes
  useEffect(() => {
    if (workspacePath) {
      loadSnapshots(workspacePath);
    }
  }, [workspacePath, loadSnapshots]);

  const handleCreateSnapshot = async () => {
    if (!workspacePath) return;

    const success = await createSnapshot(workspacePath, description);

    if (success) {
      setDescription('');
      setShowCreateDialog(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId) => {
    if (!workspacePath) return;

    const confirmed = window.confirm(
      'Are you sure you want to restore this snapshot?\n\n' +
      'This will replace your current workspace with the snapshot contents.\n' +
      'A backup of your current state will be created automatically.'
    );

    if (!confirmed) return;

    const success = await restoreSnapshot(workspacePath, snapshotId);

    if (success) {
      alert('Snapshot restored successfully!\n\nYou may need to reload the file tree to see changes.');
      // Reload workspace
      window.location.reload();
    }
  };

  const handleDeleteSnapshot = async (snapshotId, event) => {
    event.stopPropagation();

    const confirmed = window.confirm(
      'Are you sure you want to delete this snapshot?\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    await deleteSnapshot(workspacePath, snapshotId);
  };

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!workspacePath) {
    return (
      <div className="snapshot-panel">
        <div className="snapshot-panel-header">
          <h3>Snapshots</h3>
        </div>
        <div className="snapshot-panel-empty">
          <p>No workspace open</p>
          <p className="snapshot-panel-hint">
            Open a workspace to manage snapshots
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="snapshot-panel">
      <div className="snapshot-panel-header">
        <h3>Snapshots</h3>
        <button
          className="snapshot-create-btn"
          onClick={() => setShowCreateDialog(true)}
          disabled={isCreating || isRestoring}
        >
          {isCreating ? 'Creating...' : '+ New Snapshot'}
        </button>
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="snapshot-dialog">
          <div className="snapshot-dialog-content">
            <h4>Create Snapshot</h4>
            <input
              type="text"
              className="snapshot-input"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSnapshot();
                }
              }}
              autoFocus
            />
            <div className="snapshot-dialog-actions">
              <button
                className="snapshot-btn snapshot-btn-primary"
                onClick={handleCreateSnapshot}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                className="snapshot-btn snapshot-btn-secondary"
                onClick={() => {
                  setShowCreateDialog(false);
                  setDescription('');
                }}
                disabled={isCreating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="snapshot-error">
          Error: {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && !isCreating && (
        <div className="snapshot-panel-loading">
          Loading snapshots...
        </div>
      )}

      {/* Restoring State */}
      {isRestoring && (
        <div className="snapshot-panel-restoring">
          Restoring snapshot... This may take a moment.
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isRestoring && snapshots.length === 0 && (
        <div className="snapshot-panel-empty">
          <p>No snapshots yet</p>
          <p className="snapshot-panel-hint">
            Create a snapshot to backup your workspace
          </p>
        </div>
      )}

      {/* Snapshot List */}
      {!isLoading && !isRestoring && snapshots.length > 0 && (
        <div className="snapshot-list">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="snapshot-item"
            >
              <div className="snapshot-info">
                <div className="snapshot-date">
                  {formatDate(snapshot.date)}
                </div>
                <div className="snapshot-description">
                  {snapshot.description || 'No description'}
                </div>
                <div className="snapshot-meta">
                  <span className="snapshot-size">
                    {snapshot.archiveSizeFormatted}
                  </span>
                  <span className="snapshot-separator">•</span>
                  <span className="snapshot-workspace">
                    {snapshot.workspaceName}
                  </span>
                </div>
              </div>
              <div className="snapshot-actions">
                <button
                  className="snapshot-action-btn snapshot-restore-btn"
                  onClick={() => handleRestoreSnapshot(snapshot.id)}
                  disabled={isRestoring || isCreating}
                  title="Restore this snapshot"
                >
                  Restore
                </button>
                <button
                  className="snapshot-action-btn snapshot-delete-btn"
                  onClick={(e) => handleDeleteSnapshot(snapshot.id, e)}
                  disabled={isRestoring || isCreating}
                  title="Delete this snapshot"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SnapshotPanel;
