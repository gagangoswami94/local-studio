import React, { useRef, useEffect, useState } from 'react';
import useOutputStore from '../../store/outputStore';

const SOURCES = ['All', 'Build', 'Test', 'Extension', 'AI', 'System'];

const OutputPanel = () => {
  const { logs, selectedSource, setSelectedSource, clearLogs } = useOutputStore();
  const outputRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Format timestamp as HH:mm:ss
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Get log level class for color coding
  const getLevelClass = (level) => {
    switch (level) {
      case 'error':
        return 'log-error';
      case 'warn':
        return 'log-warn';
      default:
        return 'log-info';
    }
  };

  // Filter logs based on selected source
  const filteredLogs = selectedSource === 'All'
    ? logs
    : logs.filter(log => log.source === selectedSource);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (outputRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setAutoScroll(isAtBottom);
    }
  };

  return (
    <div className="panel-content output-panel">
      {/* Toolbar */}
      <div className="output-toolbar">
        <div className="output-toolbar-left">
          <label htmlFor="output-source" className="output-label">
            Show output from:
          </label>
          <select
            id="output-source"
            className="output-source-select"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
        <div className="output-toolbar-right">
          <button
            className="output-btn"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Pause Auto-Scroll' : 'Resume Auto-Scroll'}
          >
            {autoScroll ? '⏸' : '▶'}
          </button>
          <button
            className="output-btn"
            onClick={clearLogs}
            title="Clear Output"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Log Output */}
      <div
        ref={outputRef}
        className="output-logs"
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="output-empty">
            <p>No output to show</p>
            <p className="output-hint">Logs will appear here as they occur</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className={`output-log-line ${getLevelClass(log.level)}`}>
              <span className="log-timestamp">{formatTime(log.timestamp)}</span>
              <span className="log-source">[{log.source}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && filteredLogs.length > 0 && (
        <div className="output-scroll-indicator">
          <button
            className="scroll-to-bottom-btn"
            onClick={() => {
              setAutoScroll(true);
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }}
          >
            ↓ Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
};

export default OutputPanel;
