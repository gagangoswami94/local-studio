import React, { useState, useEffect } from 'react';
import useChatStore from '../store/chatStore';
import useWorkspaceStore from '../store/workspaceStore';

// Estimate token count (rough approximation: 1 token ≈ 4 characters)
const estimateTokens = (text) => {
  return Math.ceil(text.length / 4);
};

const ChatContext = ({ onOpenFileSelector }) => {
  const { contextFiles, removeContextFile, clearContext } = useChatStore();
  const { openFiles } = useWorkspaceStore();
  const [expanded, setExpanded] = useState(false);
  const [fileTokens, setFileTokens] = useState({});

  // Load file contents for token calculation
  useEffect(() => {
    const loadFileTokens = async () => {
      const tokens = {};

      for (const filePath of contextFiles) {
        // Check if file is already open
        const openFile = openFiles.find(f => f.path === filePath);
        if (openFile && openFile.content) {
          tokens[filePath] = estimateTokens(openFile.content);
        } else {
          // Load file content for token calculation
          try {
            const result = await window.electronAPI.fs.readFile(filePath);
            if (result.success && result.data) {
              tokens[filePath] = estimateTokens(result.data);
            } else {
              tokens[filePath] = 0;
            }
          } catch (error) {
            console.error('Failed to load file for token calculation:', error);
            tokens[filePath] = 0;
          }
        }
      }

      setFileTokens(tokens);
    };

    if (contextFiles.length > 0) {
      loadFileTokens();
    } else {
      setFileTokens({});
    }
  }, [contextFiles, openFiles]);

  // Calculate total tokens
  const totalTokens = Object.values(fileTokens).reduce((sum, tokens) => sum + tokens, 0);

  const formatTokenCount = (count) => {
    if (count > 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const getFileName = (path) => {
    return path.split('/').pop();
  };

  if (contextFiles.length === 0) {
    return (
      <div className="chat-context empty">
        <div className="context-empty-message">
          <span className="context-icon">📄</span>
          <span className="context-text">No files in context</span>
          <button className="context-add-btn" onClick={onOpenFileSelector}>
            + Add Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-context">
      <div className="context-header" onClick={() => setExpanded(!expanded)}>
        <div className="context-info">
          <span className="context-icon">📄</span>
          <span className="context-label">
            Context: <strong>{contextFiles.length}</strong> file{contextFiles.length !== 1 ? 's' : ''}
          </span>
          <span className="context-tokens">
            ~{formatTokenCount(totalTokens)} tokens
          </span>
          {contextFiles.length >= 5 && (
            <span className="context-limit-warning">MAX</span>
          )}
        </div>
        <div className="context-actions">
          <button
            className="context-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFileSelector();
            }}
            disabled={contextFiles.length >= 5}
            title={contextFiles.length >= 5 ? 'Maximum 5 files' : 'Add files'}
          >
            +
          </button>
          {contextFiles.length > 0 && (
            <button
              className="context-action-btn context-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                clearContext();
              }}
              title="Clear all"
            >
              ✕
            </button>
          )}
          <button className="context-toggle-btn">
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="context-files">
          {contextFiles.map((filePath) => {
            const tokens = fileTokens[filePath] || 0;

            return (
              <div key={filePath} className="context-file-chip">
                <span className="file-chip-icon">📄</span>
                <span className="file-chip-name" title={filePath}>
                  {getFileName(filePath)}
                </span>
                <span className="file-chip-tokens">
                  {tokens > 0 ? formatTokenCount(tokens) : '...'}
                </span>
                <button
                  className="file-chip-remove"
                  onClick={() => removeContextFile(filePath)}
                  title="Remove from context"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatContext;
