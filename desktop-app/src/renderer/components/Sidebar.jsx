import React, { useState } from 'react';
import FileTree from './FileTree';
import WorkspaceSelector from './WorkspaceSelector';
import useWorkspaceStore from '../store/workspaceStore';

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const { files, activeFile, openFile } = useWorkspaceStore();

  const handleFileSelect = async (file) => {
    if (file.type === 'file') {
      await openFile(file.path, file.name);
    }
  };

  return (
    <div className="sidebar">
      {/* Tab Bar */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          Explorer
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
      </div>

      {/* Content */}
      <div className="sidebar-content">
        {activeTab === 'explorer' && (
          <>
            <WorkspaceSelector />
            <FileTree
              files={files}
              onFileSelect={handleFileSelect}
              selectedFile={activeFile}
            />
          </>
        )}
        {activeTab === 'search' && (
          <div style={{ padding: '16px', fontSize: '12px', opacity: 0.5 }}>
            Search functionality coming soon...
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
