import React from 'react';
import useWorkspaceStore from '../store/workspaceStore';

const getLanguageDisplayName = (path) => {
  if (!path) return 'Plain Text';

  const ext = path.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'JavaScript',
    'jsx': 'JavaScript React',
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'json': 'JSON',
    'css': 'CSS',
    'html': 'HTML',
    'md': 'Markdown',
    'py': 'Python',
    'txt': 'Plain Text'
  };

  return languageMap[ext] || 'Plain Text';
};

const StatusBar = ({ cursorPosition }) => {
  const { activeFile, openFiles, isSaving, saveError } = useWorkspaceStore();

  const activeFileData = openFiles.find(f => f.path === activeFile);
  const hasUnsavedChanges = openFiles.some(f => f.isDirty);
  const language = activeFile ? getLanguageDisplayName(activeFile) : 'Plain Text';

  return (
    <div className="status-bar">
      {/* Left side */}
      <div className="status-bar-left">
        {activeFile && (
          <>
            <div className="status-item" title={activeFile}>
              {activeFile.split('/').pop()}
            </div>
            <div className="status-separator">|</div>
          </>
        )}

        <div className="status-item">{language}</div>

        {cursorPosition && (
          <>
            <div className="status-separator">|</div>
            <div className="status-item">
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </div>
          </>
        )}

        <div className="status-separator">|</div>
        <div className="status-item">UTF-8</div>
      </div>

      {/* Right side */}
      <div className="status-bar-right">
        {saveError && (
          <div className="status-item status-error" title={saveError}>
            ⚠️ Save Error
          </div>
        )}

        {isSaving && (
          <div className="status-item status-saving">
            💾 Saving...
          </div>
        )}

        {hasUnsavedChanges && !isSaving && !saveError && (
          <div className="status-item status-modified">
            • Modified
          </div>
        )}

        {!hasUnsavedChanges && !isSaving && !saveError && (
          <div className="status-item status-saved">
            ✓ Saved
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
