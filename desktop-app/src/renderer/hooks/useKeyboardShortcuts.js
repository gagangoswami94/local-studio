import { useEffect } from 'react';

/**
 * Custom hook for keyboard shortcuts
 * @param {Object} shortcuts - Object with shortcut definitions
 */
const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Check each shortcut
      for (const [key, handler] of Object.entries(shortcuts)) {
        const parts = key.split('+');
        const requiresCmd = parts.includes('cmd') || parts.includes('ctrl');
        const requiresShift = parts.includes('shift');
        const requiresAlt = parts.includes('alt');
        const mainKey = parts[parts.length - 1].toLowerCase();

        if (
          (!requiresCmd || cmdOrCtrl) &&
          (!requiresShift || event.shiftKey) &&
          (!requiresAlt || event.altKey) &&
          event.key.toLowerCase() === mainKey
        ) {
          event.preventDefault();
          handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};

export default useKeyboardShortcuts;
