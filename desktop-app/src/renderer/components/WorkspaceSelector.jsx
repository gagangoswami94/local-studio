import React from 'react';
import useWorkspaceStore from '../store/workspaceStore';

const WorkspaceSelector = () => {
  const { workspacePath, openWorkspace } = useWorkspaceStore();

  const handleOpenFolder = async () => {
    try {
      // Show open dialog
      const result = await window.electronAPI.workspace.showOpenDialog();

      if (result.success && result.data) {
        // Open workspace with selected path
        const openResult = await openWorkspace(result.data);

        if (!openResult.success) {
          console.error('Failed to open workspace:', openResult.error);
        }
      }
    } catch (error) {
      console.error('Error opening folder:', error);
    }
  };

  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <button
        onClick={handleOpenFolder}
        style={{
          padding: '8px 12px',
          backgroundColor: 'var(--accent-blue)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.9'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        Open Folder
      </button>

      {workspacePath && (
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          <strong>Workspace:</strong> {workspacePath}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelector;
