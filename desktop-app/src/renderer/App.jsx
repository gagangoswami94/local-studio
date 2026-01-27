import React, { useState, useEffect } from 'react';
import './styles/app.css';
import './styles/themes/dark.css';
import './styles/themes/light.css';
import { initTheme } from './styles/themes/themes';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import RightPanel from './components/RightPanel';
import BottomPanel from './components/BottomPanel';
import StatusBar from './components/StatusBar';
import ResizeHandle from './components/ResizeHandle';
import CommandPalette from './components/CommandPalette';
import QuickOpen from './components/QuickOpen';
import usePanelStore from './store/panelStore';
import useWorkspaceStore from './store/workspaceStore';
import useCommandStore from './store/commandStore';
import useSettingsStore from './store/settingsStore';
import useSnapshotStore from './store/snapshotStore';
import useChatStore from './store/chatStore';

const App = () => {
  const {
    bottomPanelOpen,
    bottomPanelHeight,
    setBottomPanelHeight,
    toggleBottomPanel,
    openBottomPanel,
    setActiveBottomTab
  } = usePanelStore();

  const {
    saveFile,
    saveAllFiles,
    activeFile,
    openWorkspace,
    openSpecialTab,
    workspacePath
  } = useWorkspaceStore();

  const { registerCommands, togglePalette } = useCommandStore();
  const { createSnapshot } = useSnapshotStore();
  const { addCurrentFileToContext } = useChatStore();

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenRecentOnly, setQuickOpenRecentOnly] = useState(false);

  // Initialize theme system
  useEffect(() => {
    initTheme();
  }, []);

  // Register default commands
  useEffect(() => {
    const handleOpenFolder = async () => {
      const result = await window.electronAPI.workspace.showOpenDialog();

      if (result.success && result.data) {
        await openWorkspace(result.data);
      }
    };

    const handleSave = async () => {
      if (activeFile) {
        await saveFile(activeFile);
      }
    };

    const handleSaveAll = async () => {
      await saveAllFiles();
    };

    const handleToggleTerminal = () => {
      toggleBottomPanel();
    };

    const handleToggleSidebar = () => {
      setSidebarVisible(prev => !prev);
    };

    const handleSearchInFiles = () => {
      // Switch to search tab in sidebar
      if (!sidebarVisible) {
        setSidebarVisible(true);
      }
      // The sidebar component will need to expose this functionality
      // For now, we'll just ensure sidebar is visible
    };

    const handleNewTerminal = () => {
      openBottomPanel('terminal');
    };

    const handleOpenSettings = () => {
      openSpecialTab('settings:', 'Settings');
    };

    const handleCreateSnapshot = async () => {
      if (!workspacePath) {
        alert('No workspace is open');
        return;
      }

      const description = prompt('Enter a description for this snapshot (optional):');
      if (description === null) {
        // User cancelled
        return;
      }

      const success = await createSnapshot(workspacePath, description);

      if (success) {
        alert('Snapshot created successfully!');
      } else {
        alert('Failed to create snapshot. Check console for errors.');
      }
    };

    registerCommands([
      {
        id: 'file.openFolder',
        label: 'Open Folder',
        category: 'File',
        keybinding: 'Cmd+O',
        action: handleOpenFolder
      },
      {
        id: 'file.save',
        label: 'Save',
        category: 'File',
        keybinding: 'Cmd+S',
        action: handleSave
      },
      {
        id: 'file.saveAll',
        label: 'Save All',
        category: 'File',
        keybinding: 'Cmd+K S',
        action: handleSaveAll
      },
      {
        id: 'view.toggleTerminal',
        label: 'Toggle Terminal',
        category: 'View',
        keybinding: 'Cmd+J',
        action: handleToggleTerminal
      },
      {
        id: 'view.toggleSidebar',
        label: 'Toggle Sidebar',
        category: 'View',
        keybinding: 'Cmd+B',
        action: handleToggleSidebar
      },
      {
        id: 'search.findInFiles',
        label: 'Find in Files',
        category: 'Search',
        keybinding: 'Cmd+Shift+F',
        action: handleSearchInFiles
      },
      {
        id: 'terminal.new',
        label: 'Create New Terminal',
        category: 'Terminal',
        keybinding: 'Ctrl+Shift+`',
        action: handleNewTerminal
      },
      {
        id: 'preferences.openSettings',
        label: 'Open Settings',
        category: 'Preferences',
        keybinding: 'Cmd+,',
        action: handleOpenSettings
      },
      {
        id: 'workspace.createSnapshot',
        label: 'Create Snapshot',
        category: 'Workspace',
        keybinding: '',
        action: handleCreateSnapshot
      }
    ]);
  }, [registerCommands, activeFile, saveFile, saveAllFiles, toggleBottomPanel, openBottomPanel, openWorkspace, sidebarVisible, openSpecialTab, workspacePath, createSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Cmd+Shift+P - Toggle command palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        togglePalette();
      }
      // Cmd+P - Quick open (all files)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setQuickOpenRecentOnly(false);
        setIsQuickOpenOpen(true);
      }
      // Cmd+E - Quick open (recent files only)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setQuickOpenRecentOnly(true);
        setIsQuickOpenOpen(true);
      }
      // Cmd+O - Open folder
      else if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        const result = await window.electronAPI.workspace.showOpenDialog();
        if (result.success && result.data) {
          await openWorkspace(result.data);
        }
      }
      // Cmd+S - Save file
      else if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (activeFile) {
          await saveFile(activeFile);
        }
      }
      // Cmd+J (Mac) or Ctrl+J (Windows/Linux) - Toggle bottom panel
      else if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        toggleBottomPanel();
      }
      // Cmd+B - Toggle sidebar
      else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarVisible(prev => !prev);
      }
      // Cmd+Shift+F - Search in files
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        if (!sidebarVisible) {
          setSidebarVisible(true);
        }
        // TODO: Switch to search tab in sidebar
      }
      // Cmd+, - Open Settings
      else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSpecialTab('settings:', 'Settings');
      }
      // Cmd+Shift+A - Add current file to chat context
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        if (activeFile) {
          addCurrentFileToContext(activeFile);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBottomPanel, togglePalette, activeFile, saveFile, openWorkspace, sidebarVisible, openSpecialTab, addCurrentFileToContext]);

  const handleSidebarResize = (delta) => {
    setSidebarWidth((prev) => Math.max(150, Math.min(500, prev + delta)));
  };

  const handleRightPanelResize = (delta) => {
    setRightPanelWidth((prev) => Math.max(200, Math.min(600, prev - delta)));
  };

  const handleBottomPanelResize = (delta) => {
    const newHeight = Math.max(100, Math.min(600, bottomPanelHeight - delta));
    setBottomPanelHeight(newHeight);
  };

  return (
    <div className="app-container">
      <MenuBar />
      <div className="main-content">
        {sidebarVisible && (
          <>
            <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
              <Sidebar />
            </div>
            <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
          </>
        )}
        <EditorArea />
        <ResizeHandle direction="horizontal" onResize={handleRightPanelResize} />
        <div className="right-panel" style={{ width: `${rightPanelWidth}px` }}>
          <RightPanel />
        </div>
      </div>
      <div
        className={`bottom-panel-wrapper ${bottomPanelOpen ? 'open' : 'closed'}`}
        style={{
          height: bottomPanelOpen ? `${bottomPanelHeight}px` : '0px'
        }}
      >
        {bottomPanelOpen && (
          <>
            <ResizeHandle direction="vertical" onResize={handleBottomPanelResize} />
            <div className="bottom-panel">
              <BottomPanel />
            </div>
          </>
        )}
      </div>
      <StatusBar />
      <CommandPalette />
      <QuickOpen
        isOpen={isQuickOpenOpen}
        onClose={() => setIsQuickOpenOpen(false)}
        recentOnly={quickOpenRecentOnly}
      />
    </div>
  );
};

export default App;
