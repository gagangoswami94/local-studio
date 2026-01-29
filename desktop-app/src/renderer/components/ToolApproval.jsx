import React, { useState, useEffect } from 'react';

/**
 * Tool Approval Component
 * Modal for approving tool execution with parameter editing
 */
const ToolApproval = ({ tool, onApprove, onReject, timeout = 300000 }) => {
  const [editedParams, setEditedParams] = useState(JSON.stringify(tool.params, null, 2));
  const [paramsError, setParamsError] = useState(null);
  const [approveAll, setApproveAll] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeout);

  // Countdown timer
  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, timeout - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        onReject('Approval timed out');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeout, onReject]);

  const handleParamsChange = (e) => {
    const value = e.target.value;
    setEditedParams(value);

    // Validate JSON
    try {
      JSON.parse(value);
      setParamsError(null);
    } catch (err) {
      setParamsError('Invalid JSON: ' + err.message);
    }
  };

  const handleApprove = () => {
    try {
      const params = JSON.parse(editedParams);
      onApprove(params, approveAll);
    } catch (err) {
      setParamsError('Invalid JSON: ' + err.message);
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getToolIcon = (toolName) => {
    const icons = {
      view_file: '📄',
      view_directory: '📁',
      grep_search: '🔍',
      write_file: '✏️',
      edit_file: '✂️',
      create_file: '📝',
      delete_file: '🗑️',
      run_command: '⚙️',
      run_tests: '🧪',
      install_package: '📦',
      ask_user: '❓',
      think: '💭',
      create_plan: '📋',
      task_complete: '✅'
    };
    return icons[toolName] || '🔧';
  };

  const getToolDescription = (toolName) => {
    const descriptions = {
      write_file: 'Write or overwrite file contents',
      edit_file: 'Edit specific parts of a file',
      create_file: 'Create a new file',
      delete_file: 'Delete a file',
      run_command: 'Execute a shell command',
      run_tests: 'Run test suite',
      install_package: 'Install npm package',
      create_plan: 'Create execution plan'
    };
    return descriptions[toolName] || 'Execute tool operation';
  };

  return (
    <div className="tool-approval-overlay">
      <div className="tool-approval-modal">
        {/* Header */}
        <div className="tool-approval-header">
          <div className="tool-approval-title">
            <span className="tool-icon">{getToolIcon(tool.name)}</span>
            <span className="tool-name">{tool.name}</span>
            <span className="requires-approval-badge">Requires Approval</span>
          </div>
          <div className="tool-approval-timer">
            <span className="timer-icon">⏱</span>
            <span className="timer-value">{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Description */}
        <div className="tool-approval-description">
          {getToolDescription(tool.name)}
        </div>

        {/* Parameters */}
        <div className="tool-approval-section">
          <div className="section-label">Parameters:</div>
          <textarea
            className={`params-editor ${paramsError ? 'params-error' : ''}`}
            value={editedParams}
            onChange={handleParamsChange}
            rows={10}
            spellCheck={false}
          />
          {paramsError && (
            <div className="params-error-message">{paramsError}</div>
          )}
        </div>

        {/* Options */}
        <div className="tool-approval-options">
          <label className="approve-all-checkbox">
            <input
              type="checkbox"
              checked={approveAll}
              onChange={(e) => setApproveAll(e.target.checked)}
            />
            <span>Approve all future tools (this session)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="tool-approval-actions">
          <button
            className="btn btn-danger"
            onClick={() => onReject('User rejected')}
          >
            Reject
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleApprove}
            disabled={paramsError !== null}
          >
            Modify & Approve
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onApprove(tool.params, approveAll)}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToolApproval;
