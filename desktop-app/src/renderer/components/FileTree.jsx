import React, { useState } from 'react';
import useGitStore from '../store/gitStore';
import useWorkspaceStore from '../store/workspaceStore';

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

const getGitStatusColor = (status) => {
  if (!status) return null;

  switch (status) {
    case 'M': return '#FFA500'; // Modified - Orange
    case 'A': return '#4CAF50'; // Added - Green
    case 'D': return '#F44336'; // Deleted - Red
    case '?': return '#2196F3'; // Untracked - Blue
    case 'R': return '#9C27B0'; // Renamed - Purple
    case 'C': return '#FF5722'; // Conflicted - Deep Orange
    default: return null;
  }
};

const FileTreeItem = ({ item, level = 0, onFileSelect, selectedFile, workspacePath }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isDirectory = item.type === 'directory';
  const isSelected = selectedFile === item.path;
  const { getFileStatusType, isGitRepo } = useGitStore();

  // Get relative path for git status
  const getRelativePath = (fullPath) => {
    if (!workspacePath || !fullPath) return null;
    if (fullPath.startsWith(workspacePath)) {
      return fullPath.substring(workspacePath.length + 1);
    }
    return null;
  };

  const relativePath = getRelativePath(item.path);
  const gitStatus = isGitRepo && relativePath ? getFileStatusType(relativePath) : null;
  const statusColor = getGitStatusColor(gitStatus);

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
        <span className="file-name" style={{ color: statusColor || 'inherit' }}>
          {item.name}
        </span>
        {gitStatus && (
          <span
            className="file-git-status"
            style={{ color: statusColor }}
            title={`Git status: ${gitStatus}`}
          >
            {gitStatus}
          </span>
        )}
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
              workspacePath={workspacePath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ files, onFileSelect, selectedFile }) => {
  const { workspacePath } = useWorkspaceStore();

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
          workspacePath={workspacePath}
        />
      ))}
    </div>
  );
};

export default FileTree;
