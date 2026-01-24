import React from 'react';
import Editor from './Editor';
import EditorTabs from './EditorTabs';
import useWorkspaceStore from '../store/workspaceStore';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

const getLanguageFromPath = (path) => {
  if (!path) return 'javascript';

  const ext = path.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'css': 'css',
    'html': 'html',
    'md': 'markdown',
    'py': 'python',
    'txt': 'plaintext'
  };

  return languageMap[ext] || 'plaintext';
};

const EditorArea = () => {
  const { openFiles, activeFile, updateFileContent, setActiveFile, closeFile, saveFile } = useWorkspaceStore();

  const activeFileData = openFiles.find(f => f.path === activeFile);
  const content = activeFileData ? activeFileData.content : '// Welcome to Local Studio\n// Open a file to start editing';
  const language = activeFileData ? getLanguageFromPath(activeFileData.path) : 'javascript';

  const handleCodeChange = (newCode) => {
    if (activeFile) {
      updateFileContent(activeFile, newCode);
    }
  };

  const handleTabClick = (filePath) => {
    setActiveFile(filePath);
  };

  const handleTabClose = (filePath) => {
    const file = openFiles.find(f => f.path === filePath);

    // Warn if file has unsaved changes
    if (file && file.isDirty) {
      const fileName = file.name;
      const confirmClose = window.confirm(
        `Do you want to save the changes you made to ${fileName}?\n\nYour changes will be lost if you don't save them.`
      );

      if (!confirmClose) {
        return; // User cancelled
      }
    }

    closeFile(filePath);
  };

  const handleSaveFile = async () => {
    if (activeFile) {
      const result = await saveFile(activeFile);
      if (result.success) {
        console.log('File saved successfully');
      } else {
        console.error('Failed to save file:', result.error);
      }
    }
  };

  const handleCloseTab = () => {
    if (activeFile) {
      closeFile(activeFile);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'cmd+s': handleSaveFile,
    'ctrl+s': handleSaveFile,
    'cmd+w': handleCloseTab,
    'ctrl+w': handleCloseTab
  });

  return (
    <div className="editor-area">
      <EditorTabs
        tabs={openFiles}
        activeTab={activeFile}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />
      <div className="editor-wrapper">
        <Editor
          value={content}
          language={language}
          onChange={handleCodeChange}
          path={activeFile || 'welcome.js'}
        />
      </div>
    </div>
  );
};

export default EditorArea;
