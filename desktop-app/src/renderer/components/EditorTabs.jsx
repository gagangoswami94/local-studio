import React, { useRef, useEffect } from 'react';

const getFileIcon = (fileName) => {
  if (!fileName) return '📄';

  const ext = fileName.split('.').pop().toLowerCase();
  const iconMap = {
    'js': '📄',
    'jsx': '⚛️',
    'ts': '📘',
    'tsx': '⚛️',
    'json': '📝',
    'md': '📋',
    'css': '🎨',
    'html': '🌐',
    'py': '🐍',
    'txt': '📃'
  };

  return iconMap[ext] || '📄';
};

const EditorTabs = ({ tabs, activeTab, onTabClick, onTabClose }) => {
  const tabsContainerRef = useRef(null);

  useEffect(() => {
    // Scroll active tab into view
    if (tabsContainerRef.current && activeTab) {
      const activeElement = tabsContainerRef.current.querySelector('.editor-tab.active');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const handleTabClick = (tab, event) => {
    // Middle click to close
    if (event.button === 1) {
      event.preventDefault();
      onTabClose(tab.path);
    } else {
      onTabClick(tab.path);
    }
  };

  const handleCloseClick = (tab, event) => {
    event.stopPropagation();
    onTabClose(tab.path);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs-container">
      <div className="editor-tabs" ref={tabsContainerRef}>
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={`editor-tab ${tab.path === activeTab ? 'active' : ''} ${tab.isDirty ? 'modified' : ''} ${tab.isDiff ? 'diff-view' : ''}`}
            onClick={(e) => handleTabClick(tab, e)}
            onMouseDown={(e) => handleTabClick(tab, e)}
            title={tab.isDiff ? `${tab.path} (Diff View)` : tab.path}
          >
            <span className="tab-icon">{getFileIcon(tab.name)}</span>
            <span className="tab-name">
              {tab.name}
              {tab.isDiff && <span className="tab-diff-badge">diff</span>}
            </span>
            {tab.isDirty && <span className="tab-modified">•</span>}
            <button
              className="tab-close"
              onClick={(e) => handleCloseClick(tab, e)}
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditorTabs;
