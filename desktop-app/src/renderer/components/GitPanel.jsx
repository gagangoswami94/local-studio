import React, { useEffect, useState } from 'react';
import useGitStore from '../store/gitStore';
import useWorkspaceStore from '../store/workspaceStore';

const GitPanel = () => {
  const {
    isGitRepo,
    branch,
    ahead,
    behind,
    files,
    isLoading,
    error,
    fetchGitStatus,
    getFileDiff
  } = useGitStore();

  const { workspacePath, openFileDiff } = useWorkspaceStore();

  const [expandedSections, setExpandedSections] = useState({
    changes: true,
    staged: true,
    untracked: true
  });

  // Fetch git status on mount and workspace change
  useEffect(() => {
    if (workspacePath) {
      fetchGitStatus(workspacePath);
    }
  }, [workspacePath, fetchGitStatus]);

  // Auto-refresh git status every 5 seconds if it's a git repo
  useEffect(() => {
    if (!workspacePath || !isGitRepo) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchGitStatus(workspacePath);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [workspacePath, isGitRepo, fetchGitStatus]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFileClick = async (file) => {
    if (!workspacePath) return;

    // For deleted files, we can't open them
    if (file.working_dir === 'D') {
      return;
    }

    const fullPath = `${workspacePath}/${file.path}`;
    // Extract file name from path
    const fileName = file.path.split('/').pop();

    // Get git diff for this file
    const diff = await getFileDiff(file.path);

    // Open file in diff mode
    await openFileDiff(fullPath, fileName, diff);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'M': return { icon: 'M', color: '#FFA500', label: 'Modified' };
      case 'A': return { icon: 'A', color: '#4CAF50', label: 'Added' };
      case 'D': return { icon: 'D', color: '#F44336', label: 'Deleted' };
      case '?': return { icon: 'U', color: '#2196F3', label: 'Untracked' };
      case 'R': return { icon: 'R', color: '#9C27B0', label: 'Renamed' };
      case 'C': return { icon: 'C', color: '#FF5722', label: 'Conflicted' };
      default: return { icon: '•', color: '#999', label: 'Changed' };
    }
  };

  const categorizeFiles = () => {
    const staged = [];
    const unstaged = [];
    const untracked = [];

    files.forEach(file => {
      // Index status (staged)
      if (file.index && file.index !== ' ' && file.index !== '?') {
        staged.push({ ...file, status: file.index });
      }
      // Working directory status (unstaged)
      if (file.working_dir && file.working_dir !== ' ') {
        if (file.working_dir === '?') {
          untracked.push({ ...file, status: '?' });
        } else {
          unstaged.push({ ...file, status: file.working_dir });
        }
      }
    });

    return { staged, unstaged, untracked };
  };

  const { staged, unstaged, untracked } = categorizeFiles();

  if (!isGitRepo) {
    return (
      <div className="git-panel">
        <div className="git-panel-header">
          <h3>Source Control</h3>
        </div>
        <div className="git-panel-empty">
          <p>Not a git repository</p>
          <p className="git-panel-hint">
            Initialize a git repository to track changes
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="git-panel">
        <div className="git-panel-header">
          <h3>Source Control</h3>
        </div>
        <div className="git-panel-loading">
          Loading git status...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="git-panel">
        <div className="git-panel-header">
          <h3>Source Control</h3>
        </div>
        <div className="git-panel-error">
          Error: {error}
        </div>
      </div>
    );
  }

  const hasChanges = staged.length > 0 || unstaged.length > 0 || untracked.length > 0;

  return (
    <div className="git-panel">
      <div className="git-panel-header">
        <h3>Source Control</h3>
        {branch && (
          <div className="git-branch">
            <span className="git-branch-icon">⎇</span>
            <span className="git-branch-name">{branch}</span>
            {ahead > 0 && <span className="git-sync-label">↑{ahead}</span>}
            {behind > 0 && <span className="git-sync-label">↓{behind}</span>}
          </div>
        )}
      </div>

      {!hasChanges && (
        <div className="git-panel-empty">
          <p>No changes</p>
          <p className="git-panel-hint">
            Your working tree is clean
          </p>
        </div>
      )}

      {/* Staged Changes */}
      {staged.length > 0 && (
        <div className="git-section">
          <div
            className="git-section-header"
            onClick={() => toggleSection('staged')}
          >
            <span className="git-section-arrow">
              {expandedSections.staged ? '▼' : '▶'}
            </span>
            <span className="git-section-title">
              Staged Changes ({staged.length})
            </span>
          </div>
          {expandedSections.staged && (
            <div className="git-file-list">
              {staged.map((file, index) => {
                const statusInfo = getStatusIcon(file.status);
                return (
                  <div
                    key={`staged-${index}`}
                    className="git-file-item"
                    onClick={() => handleFileClick(file)}
                    title={statusInfo.label}
                  >
                    <span
                      className="git-file-status"
                      style={{ color: statusInfo.color }}
                    >
                      {statusInfo.icon}
                    </span>
                    <span className="git-file-path">{file.path}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Unstaged Changes */}
      {unstaged.length > 0 && (
        <div className="git-section">
          <div
            className="git-section-header"
            onClick={() => toggleSection('changes')}
          >
            <span className="git-section-arrow">
              {expandedSections.changes ? '▼' : '▶'}
            </span>
            <span className="git-section-title">
              Changes ({unstaged.length})
            </span>
          </div>
          {expandedSections.changes && (
            <div className="git-file-list">
              {unstaged.map((file, index) => {
                const statusInfo = getStatusIcon(file.status);
                return (
                  <div
                    key={`unstaged-${index}`}
                    className="git-file-item"
                    onClick={() => handleFileClick(file)}
                    title={statusInfo.label}
                  >
                    <span
                      className="git-file-status"
                      style={{ color: statusInfo.color }}
                    >
                      {statusInfo.icon}
                    </span>
                    <span className="git-file-path">{file.path}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Untracked Files */}
      {untracked.length > 0 && (
        <div className="git-section">
          <div
            className="git-section-header"
            onClick={() => toggleSection('untracked')}
          >
            <span className="git-section-arrow">
              {expandedSections.untracked ? '▼' : '▶'}
            </span>
            <span className="git-section-title">
              Untracked Files ({untracked.length})
            </span>
          </div>
          {expandedSections.untracked && (
            <div className="git-file-list">
              {untracked.map((file, index) => {
                const statusInfo = getStatusIcon(file.status);
                return (
                  <div
                    key={`untracked-${index}`}
                    className="git-file-item"
                    onClick={() => handleFileClick(file)}
                    title={statusInfo.label}
                  >
                    <span
                      className="git-file-status"
                      style={{ color: statusInfo.color }}
                    >
                      {statusInfo.icon}
                    </span>
                    <span className="git-file-path">{file.path}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GitPanel;
