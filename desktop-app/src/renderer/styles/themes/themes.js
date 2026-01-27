/**
 * Theme Registry
 * Manages available themes and their metadata
 */

import darkTheme from './dark.css';
import lightTheme from './light.css';

export const themes = {
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'VS Code Dark+ inspired theme',
    monacoTheme: 'vs-dark',
    type: 'dark',
    cssFile: darkTheme
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'VS Code Light+ inspired theme',
    monacoTheme: 'vs-light',
    type: 'light',
    cssFile: lightTheme
  }
};

export const defaultTheme = 'dark';

/**
 * Get theme by ID
 * @param {string} themeId - Theme ID
 * @returns {object|null} Theme object
 */
export function getTheme(themeId) {
  return themes[themeId] || null;
}

/**
 * Get all available themes
 * @returns {array} Array of theme objects
 */
export function getAllThemes() {
  return Object.values(themes);
}

/**
 * Get current theme from settings
 * @returns {string} Current theme ID
 */
export function getCurrentTheme() {
  if (typeof window === 'undefined') return defaultTheme;

  const stored = localStorage.getItem('theme');
  return stored && themes[stored] ? stored : defaultTheme;
}

/**
 * Apply theme to document
 * @param {string} themeId - Theme ID to apply
 */
export function applyTheme(themeId) {
  const theme = getTheme(themeId);

  if (!theme) {
    console.error('Theme not found:', themeId);
    return;
  }

  // Set data-theme attribute on root element
  document.documentElement.setAttribute('data-theme', themeId);

  // Store in localStorage
  localStorage.setItem('theme', themeId);

  // Dispatch custom event for components to react to theme change
  window.dispatchEvent(new CustomEvent('themechange', { detail: { themeId, theme } }));
}

/**
 * Initialize theme system
 */
export function initTheme() {
  const currentTheme = getCurrentTheme();
  applyTheme(currentTheme);
}

export default {
  themes,
  defaultTheme,
  getTheme,
  getAllThemes,
  getCurrentTheme,
  applyTheme,
  initTheme
};
