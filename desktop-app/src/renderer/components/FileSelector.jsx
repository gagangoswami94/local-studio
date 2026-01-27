import React, { useState, useEffect, useRef } from 'react';
import useWorkspaceStore from '../store/workspaceStore';
import useChatStore from '../store/chatStore';

const FileSelector = ({ isOpen, onClose }) => {
  const { workspacePath } = useWorkspaceStore();
  const { contextFiles, addContextFile } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [hoveredFile, setHoveredFile] = useState(null);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const inputRef = useRef(null);

  // Load workspace files when modal opens
  useEffect(() => {
    const loadFiles = async () => {
      if (isOpen && workspacePath) {
        setIsLoading(true);
        try {
          const result = await window.electronAPI.workspace.listFiles(workspacePath);
          if (result.success) {
            setWorkspaceFiles(result.data);
          }
        } catch (error) {
          console.error('Failed to load workspace files:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadFiles();

    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, workspacePath]);

  useEffect(() => {
    // Initialize with files already in context
    setSelectedFiles([...contextFiles]);
  }, [isOpen, contextFiles]);

  // Load file preview when hovering
  useEffect(() => {
    const loadPreview = async () => {
      if (hoveredFile) {
        try {
          const result = await window.electronAPI.fs.readFile(hoveredFile.path);
          if (result.success) {
            setFilePreview(result.data);
          }
        } catch (error) {
          console.error('Failed to load file preview:', error);
          setFilePreview('Failed to load preview');
        }
      } else {
        setFilePreview(null);
      }
    };

    const timeoutId = setTimeout(loadPreview, 200); // Debounce
    return () => clearTimeout(timeoutId);
  }, [hoveredFile]);

  if (!isOpen) return null;

  // Filter files by search query
  const filteredFiles = workspaceFiles.filter(file => {
    const fileName = file.name.toLowerCase();
    const filePath = (file.relativePath || file.path).toLowerCase();
    const query = searchQuery.toLowerCase();
    return fileName.includes(query) || filePath.includes(query);
  });

  const toggleFile = (filePath) => {
    if (selectedFiles.includes(filePath)) {
      setSelectedFiles(selectedFiles.filter(f => f !== filePath));
    } else {
      if (selectedFiles.length < 5) {
        setSelectedFiles([...selectedFiles, filePath]);
      }
    }
  };

  const handleAddFiles = () => {
    // Add newly selected files
    selectedFiles.forEach(filePath => {
      if (!contextFiles.includes(filePath)) {
        addContextFile(filePath);
      }
    });
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedFiles([]);
    onClose();
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      'js': '📜',
      'jsx': '⚛️',
      'ts': '📘',
      'tsx': '⚛️',
      'json': '📋',
      'css': '🎨',
      'html': '🌐',
      'md': '📝',
      'py': '🐍'
    };
    return iconMap[ext] || '📄';
  };

  const getFilePreview = (content) => {
    if (!content) return 'Loading...';
    const lines = content.split('\n').slice(0, 10);
    return lines.join('\n');
  };

  return (
    <div className="file-selector-overlay" onClick={handleClose}>
      <div className="file-selector-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="file-selector-header">
          <h3>Add Files to Context</h3>
          <div className="file-selector-limit">
            {selectedFiles.length} / 5 selected
          </div>
        </div>

        {/* Search */}
        <div className="file-selector-search">
          <input
            ref={inputRef}
            type="text"
            className="file-selector-search-input"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* File List */}
        <div className="file-selector-content">
          <div className="file-selector-list">
            {isLoading ? (
              <div className="file-selector-empty">
                Loading files...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="file-selector-empty">
                {searchQuery ? 'No files match your search' : 'No files found in workspace'}
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFiles.includes(file.path);
                const isInContext = contextFiles.includes(file.path);
                const canSelect = isSelected || selectedFiles.length < 5;

                return (
                  <div
                    key={file.path}
                    className={`file-selector-item ${isSelected ? 'selected' : ''} ${!canSelect ? 'disabled' : ''}`}
                    onClick={() => canSelect && toggleFile(file.path)}
                    onMouseEnter={() => setHoveredFile(file)}
                    onMouseLeave={() => setHoveredFile(null)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      disabled={!canSelect}
                      className="file-selector-checkbox"
                    />
                    <span className="file-selector-icon">
                      {getFileIcon(file.name)}
                    </span>
                    <div className="file-selector-file-info">
                      <div className="file-selector-file-name">
                        {file.name}
                        {isInContext && (
                          <span className="file-selector-badge">In context</span>
                        )}
                      </div>
                      <div className="file-selector-file-path">
                        {file.relativePath || file.path}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Preview Panel */}
          {hoveredFile && (
            <div className="file-selector-preview">
              <div className="file-selector-preview-header">
                <span>Preview</span>
                <span className="file-selector-preview-name">
                  {hoveredFile.name}
                </span>
              </div>
              <pre className="file-selector-preview-content">
                {getFilePreview(filePreview)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="file-selector-actions">
          <button className="file-selector-btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="file-selector-btn btn-primary"
            onClick={handleAddFiles}
            disabled={selectedFiles.length === 0}
          >
            Add {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileSelector;
