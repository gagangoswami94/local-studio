import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import useWorkspaceStore from '../store/workspaceStore';

const QuickOpen = ({ isOpen, onClose, recentOnly = false }) => {
  const { allFiles, recentFiles, openFile } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Get files to search (all or recent only)
  const getSearchableFiles = () => {
    if (recentOnly) {
      // For recent files, filter allFiles to only include those in recentFiles
      return allFiles.filter(file => recentFiles.includes(file.path));
    }
    return allFiles;
  };

  // Filter and sort files
  useEffect(() => {
    const searchableFiles = getSearchableFiles();

    if (!query.trim()) {
      // No query - show recent files first, then all files
      if (recentOnly) {
        setFilteredFiles(searchableFiles.slice(0, 50));
      } else {
        const recentFilesData = allFiles
          .filter(file => recentFiles.includes(file.path))
          .sort((a, b) => recentFiles.indexOf(a.path) - recentFiles.indexOf(b.path));

        const otherFiles = allFiles
          .filter(file => !recentFiles.includes(file.path))
          .sort((a, b) => b.lastModified - a.lastModified);

        setFilteredFiles([...recentFilesData, ...otherFiles].slice(0, 50));
      }
      setSelectedIndex(0);
      return;
    }

    // Fuzzy search
    const fuse = new Fuse(searchableFiles, {
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'relativePath', weight: 0.3 }
      ],
      threshold: 0.4,
      includeScore: true
    });

    const results = fuse.search(query);
    const sortedResults = results.map(result => result.item);

    // Limit to 50 results
    setFilteredFiles(sortedResults.slice(0, 50));
    setSelectedIndex(0);
  }, [query, allFiles, recentFiles, recentOnly]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredFiles.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, filteredFiles]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev =>
        prev < filteredFiles.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && filteredFiles.length > 0) {
      e.preventDefault();
      handleFileSelect(filteredFiles[selectedIndex]);
    }
  };

  // Handle file selection
  const handleFileSelect = async (file) => {
    if (file) {
      await openFile(file.path, file.name);
      onClose();
      setQuery('');
    }
  };

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format last modified time
  const formatLastModified = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Get file icon based on extension
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      js: '📜',
      jsx: '⚛️',
      ts: '📘',
      tsx: '⚛️',
      json: '📋',
      md: '📝',
      css: '🎨',
      html: '🌐',
      py: '🐍',
      java: '☕',
      cpp: '⚙️',
      c: '⚙️',
      go: '🐹',
      rs: '🦀',
      php: '🐘',
      rb: '💎',
      sh: '🐚',
      yml: '⚙️',
      yaml: '⚙️',
      xml: '📄',
      sql: '🗄️',
      default: '📄'
    };
    return iconMap[ext] || iconMap.default;
  };

  if (!isOpen) return null;

  return (
    <div className="quick-open-overlay" onClick={handleOverlayClick}>
      <div className="quick-open">
        {/* Search Input */}
        <div className="quick-open-header">
          <span className="quick-open-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="quick-open-input"
            placeholder={recentOnly ? "Search recent files..." : "Search files by name..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          {filteredFiles.length > 0 && (
            <span className="quick-open-count">
              {filteredFiles.length} {filteredFiles.length === 50 ? '(limited)' : ''}
            </span>
          )}
        </div>

        {/* File List */}
        <div className="quick-open-list" ref={listRef}>
          {filteredFiles.length === 0 ? (
            <div className="quick-open-empty">
              {recentOnly
                ? (query ? 'No matching recent files' : 'No recent files')
                : (query ? 'No matching files found' : 'No files in workspace')}
            </div>
          ) : (
            filteredFiles.map((file, index) => (
              <div
                key={file.path}
                className={`quick-open-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleFileSelect(file)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="quick-open-item-main">
                  <span className="quick-open-file-icon">
                    {getFileIcon(file.name)}
                  </span>
                  <div className="quick-open-file-info">
                    <span className="quick-open-file-name">{file.name}</span>
                    <span className="quick-open-file-path">{file.relativePath}</span>
                  </div>
                </div>
                <span className="quick-open-file-time">
                  {formatLastModified(file.lastModified)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="quick-open-footer">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
};

export default QuickOpen;
