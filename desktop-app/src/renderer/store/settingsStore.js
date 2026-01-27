import { create } from 'zustand';

const STORAGE_KEY = 'local-studio-settings';

// Default settings
const defaultSettings = {
  // Editor settings
  'editor.fontSize': 14,
  'editor.tabSize': 2,
  'editor.wordWrap': 'on',
  'editor.minimap': true,
  'editor.lineNumbers': 'on',
  'editor.formatOnSave': false,

  // Appearance settings
  'workbench.colorTheme': 'dark',

  // Terminal settings
  'terminal.shell': 'default', // default, bash, zsh, powershell
  'terminal.fontSize': 14,

  // Files settings
  'files.autoSave': 'off', // off, afterDelay
  'files.autoSaveDelay': 1000,

  // API settings
  'api.url': 'http://localhost:3001/api',
  'api.key': '', // Optional API key for future auth
  'api.timeout': 30000, // Request timeout in ms
  'api.retries': 2 // Number of retries on network errors
};

// Load settings from localStorage
const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure new settings are present
      return { ...defaultSettings, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load settings:', err);
  }
  return defaultSettings;
};

// Save settings to localStorage
const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
};

const useSettingsStore = create((set, get) => ({
  settings: loadSettings(),

  /**
   * Get a setting value
   * @param {string} key - Setting key (e.g., 'editor.fontSize')
   * @returns {any} Setting value
   */
  getSetting: (key) => {
    const { settings } = get();
    return settings[key] ?? defaultSettings[key];
  },

  /**
   * Update a setting
   * @param {string} key - Setting key
   * @param {any} value - New value
   */
  updateSetting: (key, value) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        [key]: value
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  /**
   * Update multiple settings at once
   * @param {Object} updates - Object with key-value pairs
   */
  updateSettings: (updates) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        ...updates
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  /**
   * Reset a setting to default
   * @param {string} key - Setting key
   */
  resetSetting: (key) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        [key]: defaultSettings[key]
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  /**
   * Reset all settings to defaults
   */
  resetAllSettings: () => {
    saveSettings(defaultSettings);
    set({ settings: { ...defaultSettings } });
  },

  /**
   * Get all settings
   * @returns {Object} All settings
   */
  getAllSettings: () => {
    return get().settings;
  },

  /**
   * Get default value for a setting
   * @param {string} key - Setting key
   * @returns {any} Default value
   */
  getDefaultSetting: (key) => {
    return defaultSettings[key];
  }
}));

export default useSettingsStore;
export { defaultSettings };
