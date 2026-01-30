import React, { useState, useEffect, useMemo } from 'react';
import DiffViewer from './DiffViewer';
import './DiffReviewModal.css';

/**
 * DiffReviewModal Component
 * Full-screen modal for reviewing bundle changes before applying
 *
 * Props:
 * - bundle: Object - Bundle with files, tests, migrations
 * - onApply: Function - Called when user applies selected files (fileIndices: number[])
 * - onApplyAll: Function - Called when user applies all files
 * - onCancel: Function - Called when user cancels
 * - isOpen: boolean - Whether modal is visible
 */
const DiffReviewModal = ({ bundle, onApply, onApplyAll, onCancel, isOpen }) => {
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [groupBy, setGroupBy] = useState('action'); // 'action' | 'none'
  const [showMigrations, setShowMigrations] = useState(false);
  const [selectedMigration, setSelectedMigration] = useState(null);
  const [migrationTab, setMigrationTab] = useState('forward'); // 'forward' | 'reverse'

  // Extract all files from bundle
  const allFiles = useMemo(() => {
    if (!bundle) return [];

    const files = [];

    // Add regular files
    if (bundle.files && Array.isArray(bundle.files)) {
      bundle.files.forEach((file, index) => {
        files.push({
          index,
          type: 'file',
          path: file.path,
          action: file.action || 'create',
          content: file.content || '',
          oldContent: '',
          description: file.description || '',
          layer: file.layer || 'application'
        });
      });
    }

    // Add test files
    if (bundle.tests && Array.isArray(bundle.tests)) {
      bundle.tests.forEach((test, index) => {
        files.push({
          index: bundle.files?.length + index || index,
          type: 'test',
          path: test.path,
          action: 'create',
          content: test.content || '',
          oldContent: '',
          description: `Test for ${test.sourceFile || test.path}`,
          layer: 'test'
        });
      });
    }

    return files;
  }, [bundle]);

  // Group files by action
  const groupedFiles = useMemo(() => {
    if (groupBy === 'none') {
      return { all: allFiles };
    }

    const groups = {
      create: [],
      update: [],
      delete: []
    };

    allFiles.forEach(file => {
      const action = file.action || 'create';
      if (groups[action]) {
        groups[action].push(file);
      }
    });

    return groups;
  }, [allFiles, groupBy]);

  // Current file
  const currentFile = allFiles[currentFileIndex];

  // Calculate stats for current file
  const currentFileStats = useMemo(() => {
    if (!currentFile) return { additions: 0, deletions: 0 };

    const lines = (currentFile.content || '').split('\n');
    const oldLines = (currentFile.oldContent || '').split('\n');

    return {
      additions: lines.length,
      deletions: oldLines.length
    };
  }, [currentFile]);

  // Migrations
  const migrations = useMemo(() => {
    return bundle?.migrations || [];
  }, [bundle]);

  // Select all files by default
  useEffect(() => {
    if (allFiles.length > 0) {
      setSelectedFiles(new Set(allFiles.map((_, i) => i)));
    }
  }, [allFiles]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateToPrevious();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateToNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentFileIndex, allFiles.length]);

  // Navigation functions
  const navigateToNext = () => {
    if (currentFileIndex < allFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setShowMigrations(false);
    }
  };

  const navigateToPrevious = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
      setShowMigrations(false);
    }
  };

  const navigateToFile = (index) => {
    setCurrentFileIndex(index);
    setShowMigrations(false);
  };

  // File selection
  const toggleFileSelection = (index) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFiles(newSelected);
  };

  const selectAll = () => {
    setSelectedFiles(new Set(allFiles.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  // Apply functions
  const handleApplySelected = () => {
    const selectedIndices = Array.from(selectedFiles);
    onApply(selectedIndices);
  };

  const handleApplyAll = () => {
    onApplyAll();
  };

  // Show migrations
  const handleShowMigrations = () => {
    setShowMigrations(true);
    if (migrations.length > 0 && !selectedMigration) {
      setSelectedMigration(0);
    }
  };

  if (!isOpen || !bundle) {
    return null;
  }

  return (
    <div className="diff-review-modal-overlay">
      <div className="diff-review-modal">
        {/* Header */}
        <div className="diff-review-header">
          <h2>Review Changes</h2>
          <div className="diff-review-stats">
            <span>{allFiles.length} file(s)</span>
            {migrations.length > 0 && (
              <>
                <span className="separator">•</span>
                <span>{migrations.length} migration(s)</span>
              </>
            )}
            <span className="separator">•</span>
            <span>{selectedFiles.size} selected</span>
          </div>
          <button className="btn-close" onClick={onCancel} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className="diff-review-content">
          {/* Left Sidebar - File List */}
          <div className="diff-review-sidebar">
            <div className="sidebar-header">
              <h3>Files</h3>
              <div className="sidebar-controls">
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="group-by-select"
                >
                  <option value="action">Group by Action</option>
                  <option value="none">No Grouping</option>
                </select>
              </div>
            </div>

            <div className="sidebar-actions">
              <button className="btn-link" onClick={selectAll}>Select All</button>
              <span className="separator">•</span>
              <button className="btn-link" onClick={deselectAll}>Deselect All</button>
            </div>

            <div className="file-list">
              {groupBy === 'action' ? (
                <>
                  {groupedFiles.create?.length > 0 && (
                    <div className="file-group">
                      <div className="file-group-header">
                        <span className="file-group-icon">+</span>
                        Created ({groupedFiles.create.length})
                      </div>
                      {groupedFiles.create.map((file) => (
                        <FileItem
                          key={file.index}
                          file={file}
                          isSelected={selectedFiles.has(file.index)}
                          isCurrent={currentFileIndex === file.index}
                          onToggle={() => toggleFileSelection(file.index)}
                          onClick={() => navigateToFile(file.index)}
                        />
                      ))}
                    </div>
                  )}

                  {groupedFiles.update?.length > 0 && (
                    <div className="file-group">
                      <div className="file-group-header">
                        <span className="file-group-icon">~</span>
                        Modified ({groupedFiles.update.length})
                      </div>
                      {groupedFiles.update.map((file) => (
                        <FileItem
                          key={file.index}
                          file={file}
                          isSelected={selectedFiles.has(file.index)}
                          isCurrent={currentFileIndex === file.index}
                          onToggle={() => toggleFileSelection(file.index)}
                          onClick={() => navigateToFile(file.index)}
                        />
                      ))}
                    </div>
                  )}

                  {groupedFiles.delete?.length > 0 && (
                    <div className="file-group">
                      <div className="file-group-header">
                        <span className="file-group-icon">-</span>
                        Deleted ({groupedFiles.delete.length})
                      </div>
                      {groupedFiles.delete.map((file) => (
                        <FileItem
                          key={file.index}
                          file={file}
                          isSelected={selectedFiles.has(file.index)}
                          isCurrent={currentFileIndex === file.index}
                          onToggle={() => toggleFileSelection(file.index)}
                          onClick={() => navigateToFile(file.index)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                allFiles.map((file) => (
                  <FileItem
                    key={file.index}
                    file={file}
                    isSelected={selectedFiles.has(file.index)}
                    isCurrent={currentFileIndex === file.index}
                    onToggle={() => toggleFileSelection(file.index)}
                    onClick={() => navigateToFile(file.index)}
                  />
                ))
              )}

              {/* Migrations button */}
              {migrations.length > 0 && (
                <div className="file-group">
                  <button
                    className={`migrations-button ${showMigrations ? 'active' : ''}`}
                    onClick={handleShowMigrations}
                  >
                    <span className="migrations-icon">⚡</span>
                    View Migrations ({migrations.length})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Area - Diff Viewer or Migrations */}
          <div className="diff-review-main">
            {!showMigrations && currentFile ? (
              <>
                {/* File header */}
                <div className="diff-file-header">
                  <div className="diff-file-path">
                    <span className={`file-action-badge ${currentFile.action}`}>
                      {currentFile.action === 'create' ? '+' : currentFile.action === 'update' ? '~' : '-'}
                    </span>
                    <span className="filepath">{currentFile.path}</span>
                    {currentFile.type === 'test' && (
                      <span className="file-type-badge">test</span>
                    )}
                  </div>
                  <div className="diff-file-stats">
                    <span className="stat-additions">+{currentFileStats.additions}</span>
                    <span className="stat-deletions">-{currentFileStats.deletions}</span>
                  </div>
                </div>

                {/* Description */}
                {currentFile.description && (
                  <div className="diff-file-description">
                    {currentFile.description}
                  </div>
                )}

                {/* Diff viewer */}
                <div className="diff-viewer-container">
                  <DiffViewer
                    original={currentFile.oldContent || ''}
                    modified={currentFile.content || ''}
                    language={getLanguageFromPath(currentFile.path)}
                    path={currentFile.path}
                  />
                </div>
              </>
            ) : showMigrations && migrations.length > 0 ? (
              <MigrationsViewer
                migrations={migrations}
                selectedMigration={selectedMigration}
                onSelectMigration={setSelectedMigration}
                tab={migrationTab}
                onTabChange={setMigrationTab}
              />
            ) : (
              <div className="diff-empty-state">
                <p>No file selected</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Navigation and Actions */}
        <div className="diff-review-footer">
          <div className="footer-navigation">
            <button
              className="btn-nav"
              onClick={navigateToPrevious}
              disabled={currentFileIndex === 0 && !showMigrations}
            >
              ← Previous
            </button>
            <span className="nav-indicator">
              {showMigrations ? 'Migrations' : `${currentFileIndex + 1} of ${allFiles.length}`}
            </span>
            <button
              className="btn-nav"
              onClick={navigateToNext}
              disabled={currentFileIndex === allFiles.length - 1 && !showMigrations}
            >
              Next →
            </button>
          </div>

          <div className="footer-actions">
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleApplySelected}
              disabled={selectedFiles.size === 0}
            >
              Apply Selected ({selectedFiles.size})
            </button>
            <button className="btn-primary" onClick={handleApplyAll}>
              Apply All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * FileItem Component
 * Individual file item in the sidebar
 */
const FileItem = ({ file, isSelected, isCurrent, onToggle, onClick }) => {
  const stats = useMemo(() => {
    const lines = (file.content || '').split('\n').length;
    const oldLines = (file.oldContent || '').split('\n').length;
    return { additions: lines, deletions: oldLines };
  }, [file]);

  return (
    <div
      className={`file-item ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="file-item-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle()}
        />
      </div>
      <div className="file-item-content">
        <div className="file-item-path">
          <span className={`file-action-icon ${file.action}`}>
            {file.action === 'create' ? '+' : file.action === 'update' ? '~' : '-'}
          </span>
          {file.path}
        </div>
        <div className="file-item-stats">
          <span className="stat-additions">+{stats.additions}</span>
          <span className="stat-deletions">-{stats.deletions}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * MigrationsViewer Component
 * Displays database migrations with forward/reverse SQL
 */
const MigrationsViewer = ({ migrations, selectedMigration, onSelectMigration, tab, onTabChange }) => {
  const migration = migrations[selectedMigration];

  if (!migration) {
    return (
      <div className="migrations-empty">
        <p>No migration selected</p>
      </div>
    );
  }

  const hasDataLossRisk = migration.dataLossRisk && migration.dataLossRisk !== 'none';

  return (
    <div className="migrations-viewer">
      {/* Header */}
      <div className="migrations-header">
        <h3>Database Migrations</h3>
        {hasDataLossRisk && (
          <div className="data-loss-warning">
            ⚠️ Data Loss Risk: {migration.dataLossRisk}
          </div>
        )}
      </div>

      {/* Migration selector */}
      {migrations.length > 1 && (
        <div className="migrations-selector">
          <select
            value={selectedMigration}
            onChange={(e) => onSelectMigration(parseInt(e.target.value))}
          >
            {migrations.map((m, i) => (
              <option key={i} value={i}>
                {m.description || m.id || `Migration ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div className="migration-description">
        <strong>Description:</strong> {migration.description || 'No description'}
      </div>

      {/* Tabs */}
      <div className="migrations-tabs">
        <button
          className={`migration-tab ${tab === 'forward' ? 'active' : ''}`}
          onClick={() => onTabChange('forward')}
        >
          Forward (Apply)
        </button>
        <button
          className={`migration-tab ${tab === 'reverse' ? 'active' : ''}`}
          onClick={() => onTabChange('reverse')}
        >
          Reverse (Rollback)
        </button>
      </div>

      {/* SQL content */}
      <div className="migration-sql">
        <pre>
          <code>
            {tab === 'forward' ? migration.sql_forward : migration.sql_reverse}
          </code>
        </pre>
      </div>

      {/* Metadata */}
      <div className="migration-metadata">
        <div className="metadata-item">
          <strong>ID:</strong> {migration.id || migration.migrationId || 'N/A'}
        </div>
        <div className="metadata-item">
          <strong>Database:</strong> {migration.database || 'sqlite'}
        </div>
        {hasDataLossRisk && (
          <div className="metadata-item risk">
            <strong>⚠️ Risk:</strong> {migration.dataLossRisk}
            <p className="risk-description">
              This migration may result in data loss. Make sure to backup your database before applying.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Helper function to determine language from file path
 */
const getLanguageFromPath = (path) => {
  const ext = path.split('.').pop().toLowerCase();

  const languageMap = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell'
  };

  return languageMap[ext] || 'plaintext';
};

export default DiffReviewModal;
