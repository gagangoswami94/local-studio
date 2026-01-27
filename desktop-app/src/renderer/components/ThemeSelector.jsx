import React, { useState, useEffect } from 'react';
import { getAllThemes, getCurrentTheme, applyTheme } from '../styles/themes/themes';

const ThemeSelector = () => {
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());
  const [themes] = useState(getAllThemes());

  useEffect(() => {
    // Listen for theme changes from other sources
    const handleThemeChange = (event) => {
      setCurrentTheme(event.detail.themeId);
    };

    window.addEventListener('themechange', handleThemeChange);

    return () => {
      window.removeEventListener('themechange', handleThemeChange);
    };
  }, []);

  const handleThemeChange = (themeId) => {
    applyTheme(themeId);
    setCurrentTheme(themeId);
  };

  return (
    <div className="theme-selector">
      <div className="theme-selector-header">
        <h3>Theme</h3>
        <p className="theme-selector-description">
          Select your preferred color theme
        </p>
      </div>

      <div className="theme-selector-list">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
            onClick={() => handleThemeChange(theme.id)}
          >
            <div className="theme-option-content">
              <div className="theme-option-header">
                <span className="theme-option-name">{theme.name}</span>
                {currentTheme === theme.id && (
                  <span className="theme-option-badge">Active</span>
                )}
              </div>
              <p className="theme-option-description">{theme.description}</p>
            </div>

            {/* Theme Preview */}
            <div className="theme-preview" data-theme={theme.id}>
              <div className="theme-preview-bar">
                <div className="theme-preview-dot"></div>
                <div className="theme-preview-dot"></div>
                <div className="theme-preview-dot"></div>
              </div>
              <div className="theme-preview-content">
                <div className="theme-preview-sidebar"></div>
                <div className="theme-preview-editor"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThemeSelector;
