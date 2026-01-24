import React, { useState } from 'react';
import FileTree from './FileTree';

const Sidebar = ({ files, onFileSelect, selectedFile }) => {
  const [activeTab, setActiveTab] = useState('explorer');

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

      {/* Toolbar */}
      {activeTab === 'explorer' && (
        <div className="sidebar-toolbar">
          <button className="toolbar-btn" disabled title="New File">
            📄
          </button>
          <button className="toolbar-btn" disabled title="New Folder">
            📁
          </button>
        </div>
      )}

      {/* Content */}
      <div className="sidebar-content">
        {activeTab === 'explorer' && (
          <FileTree
            files={files}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
          />
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
