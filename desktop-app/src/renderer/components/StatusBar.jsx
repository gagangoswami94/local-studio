import React from 'react';
import useWorkspaceStore from '../store/workspaceStore';
import useSettingsStore from '../store/settingsStore';

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
  const { settings, updateSetting } = useSettingsStore();

  const activeFileData = openFiles.find(f => f.path === activeFile);
  const hasUnsavedChanges = openFiles.some(f => f.isDirty);
  const language = activeFile ? getLanguageDisplayName(activeFile) : 'Plain Text';

  const currentTheme = settings['workbench.colorTheme'];
  const isDarkTheme = currentTheme === 'dark';

  const toggleTheme = () => {
    const newTheme = isDarkTheme ? 'light' : 'dark';
    updateSetting('workbench.colorTheme', newTheme);
  };

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
        <div
          className="status-item status-theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
          style={{ cursor: 'pointer' }}
        >
          {isDarkTheme ? '☀️' : '🌙'}
        </div>

        <div className="status-separator">|</div>

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
