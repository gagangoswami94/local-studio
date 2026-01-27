import React, { useState, useMemo } from 'react';
import useSettingsStore, { defaultSettings } from '../store/settingsStore';
import ThemeSelector from './ThemeSelector';

const SettingsPanel = () => {
  const { settings, updateSetting, resetSetting, resetAllSettings } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Settings configuration
  const settingsConfig = [
    {
      section: 'Editor',
      icon: '📝',
      settings: [
        {
          key: 'editor.fontSize',
          label: 'Font Size',
          description: 'Controls the font size in the editor (12-20)',
          type: 'number',
          min: 12,
          max: 20,
          step: 1
        },
        {
          key: 'editor.tabSize',
          label: 'Tab Size',
          description: 'The number of spaces a tab is equal to',
          type: 'select',
          options: [
            { value: 2, label: '2' },
            { value: 4, label: '4' }
          ]
        },
        {
          key: 'editor.wordWrap',
          label: 'Word Wrap',
          description: 'Controls whether lines should wrap',
          type: 'select',
          options: [
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
            { value: 'wordWrapColumn', label: 'Word Wrap Column' },
            { value: 'bounded', label: 'Bounded' }
          ]
        },
        {
          key: 'editor.minimap',
          label: 'Minimap',
          description: 'Controls whether the minimap is shown',
          type: 'checkbox'
        },
        {
          key: 'editor.lineNumbers',
          label: 'Line Numbers',
          description: 'Controls the display of line numbers',
          type: 'select',
          options: [
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
            { value: 'relative', label: 'Relative' }
          ]
        },
        {
          key: 'editor.formatOnSave',
          label: 'Format On Save',
          description: 'Format a file on save',
          type: 'checkbox'
        }
      ]
    },
    {
      section: 'Terminal',
      icon: '💻',
      settings: [
        {
          key: 'terminal.shell',
          label: 'Shell',
          description: 'The default shell to use for terminals',
          type: 'select',
          options: [
            { value: 'default', label: 'Default (System)' },
            { value: 'bash', label: 'Bash' },
            { value: 'zsh', label: 'Zsh' },
            { value: 'powershell', label: 'PowerShell' }
          ]
        },
        {
          key: 'terminal.fontSize',
          label: 'Font Size',
          description: 'Controls the font size in the terminal (12-20)',
          type: 'number',
          min: 12,
          max: 20,
          step: 1
        }
      ]
    },
    {
      section: 'Files',
      icon: '📁',
      settings: [
        {
          key: 'files.autoSave',
          label: 'Auto Save',
          description: 'Controls auto save of dirty files',
          type: 'select',
          options: [
            { value: 'off', label: 'Off' },
            { value: 'afterDelay', label: 'After Delay' }
          ]
        },
        {
          key: 'files.autoSaveDelay',
          label: 'Auto Save Delay',
          description: 'Controls the delay in ms after which a dirty file is saved automatically',
          type: 'number',
          min: 100,
          max: 10000,
          step: 100,
          disabled: settings['files.autoSave'] === 'off'
        }
      ]
    }
  ];

  // Filter settings based on search query
  const filteredSettings = useMemo(() => {
    if (!searchQuery.trim()) {
      return settingsConfig;
    }

    const query = searchQuery.toLowerCase();
    return settingsConfig
      .map(section => ({
        ...section,
        settings: section.settings.filter(setting =>
          setting.label.toLowerCase().includes(query) ||
          setting.description.toLowerCase().includes(query) ||
          setting.key.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.settings.length > 0);
  }, [searchQuery, settings]);

  // Render setting control based on type
  const renderControl = (setting) => {
    const value = settings[setting.key];
    const isModified = value !== defaultSettings[setting.key];

    switch (setting.type) {
      case 'checkbox':
        return (
          <div className="setting-control">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => updateSetting(setting.key, e.target.checked)}
              />
              <span className="setting-checkbox-mark"></span>
            </label>
            {isModified && (
              <button
                className="setting-reset"
                onClick={() => resetSetting(setting.key)}
                title="Reset to default"
              >
                ↺
              </button>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="setting-control">
            <input
              type="number"
              className="setting-input setting-number"
              value={value}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              disabled={setting.disabled}
              onChange={(e) => {
                const numValue = parseInt(e.target.value, 10);
                if (!isNaN(numValue)) {
                  updateSetting(setting.key, numValue);
                }
              }}
            />
            {isModified && (
              <button
                className="setting-reset"
                onClick={() => resetSetting(setting.key)}
                title="Reset to default"
              >
                ↺
              </button>
            )}
          </div>
        );

      case 'select':
        return (
          <div className="setting-control">
            <select
              className="setting-select"
              value={value}
              onChange={(e) => {
                const option = setting.options.find(opt => opt.value.toString() === e.target.value);
                if (option) {
                  updateSetting(setting.key, option.value);
                }
              }}
            >
              {setting.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isModified && (
              <button
                className="setting-reset"
                onClick={() => resetSetting(setting.key)}
                title="Reset to default"
              >
                ↺
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-panel">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title">
          <span className="settings-icon">⚙️</span>
          <h1>Settings</h1>
        </div>
        <button
          className="settings-reset-all"
          onClick={() => {
            if (window.confirm('Reset all settings to defaults?')) {
              resetAllSettings();
            }
          }}
          title="Reset all settings to defaults"
        >
          Reset All
        </button>
      </div>

      {/* Search */}
      <div className="settings-search">
        <input
          type="text"
          className="settings-search-input"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Theme Selector */}
      {!searchQuery && <ThemeSelector />}

      {/* Settings Sections */}
      <div className="settings-content">
        {filteredSettings.length === 0 ? (
          <div className="settings-empty">
            No settings found matching "{searchQuery}"
          </div>
        ) : (
          filteredSettings.map(section => (
            <div key={section.section} className="settings-section">
              <div className="settings-section-header">
                <span className="settings-section-icon">{section.icon}</span>
                <h2 className="settings-section-title">{section.section}</h2>
              </div>
              <div className="settings-list">
                {section.settings.map(setting => (
                  <div
                    key={setting.key}
                    className={`setting-item ${setting.disabled ? 'disabled' : ''}`}
                  >
                    <div className="setting-info">
                      <label className="setting-label" htmlFor={setting.key}>
                        {setting.label}
                      </label>
                      <div className="setting-description">
                        {setting.description}
                      </div>
                      <div className="setting-key">{setting.key}</div>
                    </div>
                    {renderControl(setting)}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
