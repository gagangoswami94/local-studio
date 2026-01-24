import React, { useState } from 'react';

const getFileIcon = (name, isDirectory) => {
  if (isDirectory) return '📁';

  const ext = name.split('.').pop().toLowerCase();
  const iconMap = {
    'js': '📄',
    'jsx': '📄',
    'ts': '📄',
    'tsx': '📄',
    'json': '📝',
    'md': '📋',
    'css': '🎨',
    'html': '🌐',
    'py': '🐍',
    'txt': '📃'
  };

  return iconMap[ext] || '📄';
};

const FileTreeItem = ({ item, level = 0, onFileSelect, selectedFile }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isDirectory = item.type === 'directory';
  const isSelected = selectedFile === item.path;

  const handleClick = () => {
    if (isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect(item);
    }
  };

  const handleFolderToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="file-tree-item">
      <div
        className={`file-tree-label ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory && (
          <span
            className="folder-arrow"
            onClick={handleFolderToggle}
            style={{
              display: 'inline-block',
              width: '16px',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease'
            }}
          >
            ▶
          </span>
        )}
        {!isDirectory && <span style={{ width: '16px', display: 'inline-block' }}></span>}
        <span className="file-icon">{getFileIcon(item.name, isDirectory)}</span>
        <span className="file-name">{item.name}</span>
      </div>
      {isDirectory && isExpanded && item.children && (
        <div className="file-tree-children">
          {item.children.map((child, index) => (
            <FileTreeItem
              key={child.path || index}
              item={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ files, onFileSelect, selectedFile }) => {
  if (!files || files.length === 0) {
    return (
      <div style={{ padding: '16px', fontSize: '12px', opacity: 0.5 }}>
        No files to display
      </div>
    );
  }

  return (
    <div className="file-tree">
      {files.map((item, index) => (
        <FileTreeItem
          key={item.path || index}
          item={item}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
};

export default FileTree;
