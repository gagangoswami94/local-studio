import React from 'react';

/**
 * Agentic Progress Component
 * Shows current execution progress with iteration counter and token usage
 */
const AgenticProgress = ({
  currentIteration,
  maxIterations,
  currentTool,
  tokensUsed,
  tokenBudget,
  onStop
}) => {
  const progress = (currentIteration / maxIterations) * 100;
  const tokenProgress = tokenBudget ? (tokensUsed / tokenBudget) * 100 : 0;
  const isNearLimit = currentIteration >= (maxIterations * 0.8);
  const isTokenWarning = tokenProgress >= 80;

  const getStatusColor = () => {
    if (isNearLimit) return '#f59e0b'; // Orange
    return '#3b82f6'; // Blue
  };

  const getToolIcon = (toolName) => {
    if (!toolName) return '⚙️';

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

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="agentic-progress">
      {/* Header */}
      <div className="progress-header">
        <div className="progress-title">
          <span className="spinner">⚙️</span>
          <span>Agentic Mode Running</span>
        </div>
        <button className="btn-stop" onClick={onStop} title="Stop execution">
          <span>⏹</span>
          <span>Stop</span>
        </button>
      </div>

      {/* Iteration Progress */}
      <div className="progress-section">
        <div className="progress-label">
          <span>Iteration</span>
          <span className={`progress-counter ${isNearLimit ? 'near-limit' : ''}`}>
            Step {currentIteration} of {maxIterations}
          </span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${progress}%`,
              backgroundColor: getStatusColor()
            }}
          />
        </div>
        {isNearLimit && (
          <div className="progress-warning">
            ⚠️ Approaching iteration limit
          </div>
        )}
      </div>

      {/* Current Tool */}
      {currentTool && (
        <div className="progress-section current-tool">
          <div className="progress-label">Current Tool:</div>
          <div className="tool-display">
            <span className="tool-icon">{getToolIcon(currentTool.name)}</span>
            <span className="tool-name">{currentTool.name}</span>
            {currentTool.status && (
              <span className={`tool-status tool-status-${currentTool.status}`}>
                {currentTool.status === 'executing' && <span className="spinner-small">⚙️</span>}
                {currentTool.status === 'completed' && '✓'}
                {currentTool.status === 'failed' && '✗'}
                {currentTool.status === 'pending_approval' && '⏱'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Token Usage */}
      {tokenBudget && (
        <div className="progress-section">
          <div className="progress-label">
            <span>Token Usage</span>
            <span className={`progress-counter ${isTokenWarning ? 'token-warning' : ''}`}>
              {formatNumber(tokensUsed)} / {formatNumber(tokenBudget)}
            </span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill token-bar"
              style={{
                width: `${Math.min(tokenProgress, 100)}%`,
                backgroundColor: isTokenWarning ? '#ef4444' : '#10b981'
              }}
            />
          </div>
          {isTokenWarning && (
            <div className="progress-warning">
              ⚠️ High token usage
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgenticProgress;
