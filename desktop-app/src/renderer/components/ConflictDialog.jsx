import React, { useState } from 'react';
import DiffViewer from './DiffViewer';
import './ConflictDialog.css';

/**
 * ConflictDialog Component
 * Shows file conflicts and allows user to choose resolution
 *
 * Props:
 * - conflict: Object - Conflict details
 * - onResolve: Function - Called with resolution: 'ai' | 'local' | 'merge' | 'cancel'
 */
const ConflictDialog = ({ conflict, onResolve }) => {
  const [selectedResolution, setSelectedResolution] = useState('ai');

  if (!conflict) {
    return null;
  }

  const handleResolve = () => {
    onResolve(selectedResolution);
  };

  const handleCancel = () => {
    onResolve('cancel');
  };

  return (
    <div className="conflict-dialog-overlay">
      <div className="conflict-dialog">
        {/* Header */}
        <div className="conflict-dialog-header">
          <h2>⚠️ Conflict Detected</h2>
          <p className="conflict-file-path">{conflict.file}</p>
        </div>

        {/* Message */}
        <div className="conflict-message">
          <p>{conflict.message}</p>
          <p className="conflict-hint">
            This file has been modified since the plan was created.
            Choose how to resolve this conflict:
          </p>
        </div>

        {/* Resolution Options */}
        <div className="conflict-options">
          <label className={`conflict-option ${selectedResolution === 'ai' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="resolution"
              value="ai"
              checked={selectedResolution === 'ai'}
              onChange={(e) => setSelectedResolution(e.target.value)}
            />
            <div className="option-content">
              <div className="option-title">
                <strong>Use AI Version</strong>
                <span className="option-badge recommended">Recommended</span>
              </div>
              <div className="option-description">
                Replace the file with the AI-generated version. Your local changes will be lost.
              </div>
            </div>
          </label>

          <label className={`conflict-option ${selectedResolution === 'local' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="resolution"
              value="local"
              checked={selectedResolution === 'local'}
              onChange={(e) => setSelectedResolution(e.target.value)}
            />
            <div className="option-content">
              <div className="option-title">
                <strong>Keep My Version</strong>
              </div>
              <div className="option-description">
                Keep your local changes. The AI-generated changes for this file will be skipped.
              </div>
            </div>
          </label>

          <label className={`conflict-option ${selectedResolution === 'merge' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="resolution"
              value="merge"
              checked={selectedResolution === 'merge'}
              onChange={(e) => setSelectedResolution(e.target.value)}
            />
            <div className="option-content">
              <div className="option-title">
                <strong>Manual Merge</strong>
                <span className="option-badge advanced">Advanced</span>
              </div>
              <div className="option-description">
                Open a merge editor to manually combine both versions. Requires manual editing.
              </div>
            </div>
          </label>
        </div>

        {/* Diff Preview */}
        <div className="conflict-diff-preview">
          <div className="conflict-diff-header">
            <h3>Changes Preview</h3>
            <div className="diff-legend">
              <span className="legend-item">
                <span className="legend-color local"></span>
                Your Version
              </span>
              <span className="legend-item">
                <span className="legend-color ai"></span>
                AI Version
              </span>
            </div>
          </div>

          <div className="conflict-diff-viewer">
            <DiffViewer
              original={conflict.currentContent || ''}
              modified={conflict.newContent || ''}
              language={getLanguageFromPath(conflict.file)}
              path={conflict.file}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="conflict-dialog-actions">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel Application
          </button>
          <button className="btn-primary" onClick={handleResolve}>
            {selectedResolution === 'ai' && 'Use AI Version'}
            {selectedResolution === 'local' && 'Keep My Version'}
            {selectedResolution === 'merge' && 'Open Merge Editor'}
          </button>
        </div>
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
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell'
  };

  return languageMap[ext] || 'plaintext';
};

export default ConflictDialog;
