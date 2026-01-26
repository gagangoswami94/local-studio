import React, { useState, useEffect, useRef } from 'react';
import useCommandStore from '../store/commandStore';

const CommandPalette = () => {
  const { isPaletteOpen, closePalette, searchCommands, executeCommand } = useCommandStore();
  const [query, setQuery] = useState('');
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const commandListRef = useRef(null);

  // Filter commands when query changes
  useEffect(() => {
    const results = searchCommands(query);
    setFilteredCommands(results);
    setSelectedIndex(0); // Reset selection when results change
  }, [query, searchCommands]);

  // Focus input when palette opens
  useEffect(() => {
    if (isPaletteOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isPaletteOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (commandListRef.current && filteredCommands.length > 0) {
      const selectedElement = commandListRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev =>
        prev < filteredCommands.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && filteredCommands.length > 0) {
      e.preventDefault();
      handleCommandSelect(filteredCommands[selectedIndex]);
    }
  };

  // Handle command selection
  const handleCommandSelect = (command) => {
    if (command) {
      executeCommand(command.id);
      closePalette();
      setQuery('');
    }
  };

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closePalette();
    }
  };

  if (!isPaletteOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={handleOverlayClick}>
      <div className="command-palette">
        {/* Search Input */}
        <div className="command-palette-input-wrapper">
          <span className="command-palette-icon">›</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {/* Command List */}
        <div className="command-palette-list" ref={commandListRef}>
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">
              {query ? 'No commands found' : 'Start typing to search...'}
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleCommandSelect(command)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-palette-item-main">
                  {command.category && (
                    <span className="command-palette-category">{command.category}:</span>
                  )}
                  <span className="command-palette-label">{command.label}</span>
                </div>
                {command.keybinding && (
                  <div className="command-palette-keybinding">
                    {command.keybinding}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
