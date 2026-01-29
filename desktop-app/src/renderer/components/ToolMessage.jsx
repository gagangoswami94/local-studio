import React, { useState } from 'react';

/**
 * Tool Message Component
 * Displays tool calls and results in chat
 */
const ToolMessage = ({ tool }) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const getStatusIcon = (status) => {
    const icons = {
      pending_approval: '⏱',
      executing: '⚙️',
      completed: '✅',
      failed: '❌'
    };
    return icons[status] || '';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending_approval: '#f59e0b', // Yellow
      executing: '#3b82f6', // Blue
      completed: '#10b981', // Green
      failed: '#ef4444' // Red
    };
    return colors[status] || '#6b7280';
  };

  const formatParams = (params) => {
    try {
      return JSON.stringify(params, null, 2);
    } catch {
      return String(params);
    }
  };

  const formatResult = (result) => {
    if (typeof result === 'string') {
      return result;
    }
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  };

  return (
    <div className="tool-message">
      {/* Tool Header */}
      <div
        className="tool-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="tool-info">
          <span className="tool-icon">{getToolIcon(tool.name)}</span>
          <span className="tool-name">{tool.name}</span>
          {tool.status && (
            <span
              className={`tool-status tool-status-${tool.status}`}
              style={{ backgroundColor: getStatusColor(tool.status) }}
            >
              <span className="status-icon">{getStatusIcon(tool.status)}</span>
              <span className="status-label">{tool.status.replace('_', ' ')}</span>
            </span>
          )}
        </div>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* Tool Details (Collapsible) */}
      {isExpanded && (
        <div className="tool-details">
          {/* Parameters */}
          {tool.params && (
            <div className="tool-section">
              <div className="section-label">Parameters:</div>
              <pre className="tool-code">{formatParams(tool.params)}</pre>
            </div>
          )}

          {/* Result */}
          {tool.result && (
            <div className="tool-section">
              <div className="section-label">
                {tool.status === 'failed' ? 'Error:' : 'Result:'}
              </div>
              <pre className={`tool-code ${tool.status === 'failed' ? 'tool-error' : ''}`}>
                {formatResult(tool.result)}
              </pre>
            </div>
          )}

          {/* Duration */}
          {tool.duration && (
            <div className="tool-meta">
              <span>Duration: {tool.duration}ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolMessage;
