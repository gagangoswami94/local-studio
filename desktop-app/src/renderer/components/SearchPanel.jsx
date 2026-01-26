import React, { useState, useEffect, useRef } from 'react';
import { searchFiles } from '../utils/ipc';
import useWorkspaceStore from '../store/workspaceStore';

const SearchPanel = () => {
  const { workspacePath, openFile } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFiles, setExpandedFiles] = useState({});

  const searchTimeoutRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !workspacePath) {
      setResults([]);
      setTotalMatches(0);
      return;
    }

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch();
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, includePattern, excludePattern, matchCase, matchWholeWord, useRegex, workspacePath]);

  const performSearch = async () => {
    if (!query.trim() || !workspacePath) return;

    setIsSearching(true);
    setError(null);

    try {
      const result = await searchFiles(workspacePath, query, {
        matchCase,
        matchWholeWord,
        useRegex,
        includePattern: includePattern.trim(),
        excludePattern: excludePattern.trim(),
        contextLines: 1
      });

      if (result.success) {
        setResults(result.results || []);
        setTotalMatches(result.totalMatches || 0);

        // Auto-expand all files
        const expanded = {};
        (result.results || []).forEach(fileResult => {
          expanded[fileResult.file] = true;
        });
        setExpandedFiles(expanded);
      } else {
        setError(result.error || 'Search failed');
        setResults([]);
        setTotalMatches(0);
      }
    } catch (err) {
      setError(err.message);
      setResults([]);
      setTotalMatches(0);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFileExpanded = (file) => {
    setExpandedFiles(prev => ({
      ...prev,
      [file]: !prev[file]
    }));
  };

  const handleMatchClick = async (fileResult, match) => {
    // Open the file
    const fileName = fileResult.file.split('/').pop();
    await openFile(fileResult.filePath, fileName);

    // TODO: Highlight the match line in Monaco editor
    console.log(`Navigate to ${fileResult.file}:${match.line}`);
  };

  const highlightMatch = (lineText, matchPositions) => {
    if (!matchPositions || matchPositions.length === 0) {
      return <span>{lineText}</span>;
    }

    const parts = [];
    let lastEnd = 0;

    matchPositions.forEach((pos, index) => {
      // Add text before match
      if (pos.start > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>
            {lineText.substring(lastEnd, pos.start)}
          </span>
        );
      }

      // Add highlighted match
      parts.push(
        <span key={`match-${index}`} className="search-match-highlight">
          {lineText.substring(pos.start, pos.end)}
        </span>
      );

      lastEnd = pos.end;
    });

    // Add remaining text
    if (lastEnd < lineText.length) {
      parts.push(
        <span key="text-end">{lineText.substring(lastEnd)}</span>
      );
    }

    return <span>{parts}</span>;
  };

  return (
    <div className="search-panel">
      {/* Search Input Section */}
      <div className="search-input-section">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {isSearching && <span className="search-spinner">⏳</span>}
        </div>

        {/* Search Options */}
        <div className="search-options">
          <label className="search-option">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
            />
            <span>Match Case</span>
          </label>
          <label className="search-option">
            <input
              type="checkbox"
              checked={matchWholeWord}
              onChange={(e) => setMatchWholeWord(e.target.checked)}
            />
            <span>Match Whole Word</span>
          </label>
          <label className="search-option">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
            />
            <span>Use Regular Expression</span>
          </label>
        </div>

        {/* Include/Exclude Patterns */}
        <div className="search-patterns">
          <input
            type="text"
            className="pattern-input"
            placeholder="files to include (e.g., *.js, src/**)"
            value={includePattern}
            onChange={(e) => setIncludePattern(e.target.value)}
          />
          <input
            type="text"
            className="pattern-input"
            placeholder="files to exclude (e.g., test/**, *.test.js)"
            value={excludePattern}
            onChange={(e) => setExcludePattern(e.target.value)}
          />
        </div>
      </div>

      {/* Results Summary */}
      {query && (
        <div className="search-summary">
          {isSearching ? (
            <span>Searching...</span>
          ) : error ? (
            <span className="search-error">{error}</span>
          ) : totalMatches > 0 ? (
            <span>
              {totalMatches} {totalMatches === 1 ? 'result' : 'results'} in {results.length} {results.length === 1 ? 'file' : 'files'}
            </span>
          ) : query.trim() ? (
            <span>No results found</span>
          ) : null}
        </div>
      )}

      {/* Search Results */}
      <div className="search-results">
        {results.length === 0 && !isSearching && query && !error && (
          <div className="search-empty">
            <p>No results found</p>
            <p className="search-hint">Try different keywords or check your search options</p>
          </div>
        )}

        {results.map((fileResult) => (
          <div key={fileResult.file} className="search-file-group">
            {/* File Header */}
            <div
              className="search-file-header"
              onClick={() => toggleFileExpanded(fileResult.file)}
            >
              <span className="folder-arrow" style={{
                transform: expandedFiles[fileResult.file] ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease'
              }}>
                ▶
              </span>
              <span className="search-file-icon">📄</span>
              <span className="search-file-name">{fileResult.file}</span>
              <span className="search-match-count">
                {fileResult.matches.length}
              </span>
            </div>

            {/* File Matches */}
            {expandedFiles[fileResult.file] && (
              <div className="search-file-matches">
                {fileResult.matches.map((match, index) => (
                  <div
                    key={index}
                    className="search-match-item"
                    onClick={() => handleMatchClick(fileResult, match)}
                    title="Click to open"
                  >
                    <span className="search-match-line-number">
                      {match.line}
                    </span>
                    <span className="search-match-text">
                      {highlightMatch(match.lineText, match.matchPositions)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPanel;
