import React, { useState } from 'react';
import FileTree from './FileTree';
import WorkspaceSelector from './WorkspaceSelector';
import SearchPanel from './SearchPanel';
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
    <>
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
        {activeTab === 'search' && <SearchPanel />}
      </div>
    </>
  );
};

export default Sidebar;
