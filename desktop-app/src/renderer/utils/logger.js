import useOutputStore from '../store/outputStore';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Logger utility for application-wide logging
 * Logs to output panel and optionally to console in dev mode
 */
class Logger {
  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {string} source - Source of the log (Build, Test, Extension, AI, System)
   */
  info(message, source = 'System') {
    this.log(message, 'info', source);
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {string} source - Source of the log
   */
  warn(message, source = 'System') {
    this.log(message, 'warn', source);
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {string} source - Source of the log
   */
  error(message, source = 'System') {
    this.log(message, 'error', source);
  }

  /**
   * Generic log method
   * @param {string} message - The message to log
   * @param {string} level - Log level (info, warn, error)
   * @param {string} source - Source of the log
   */
  log(message, level = 'info', source = 'System') {
    // Add to output store
    const { addLog } = useOutputStore.getState();
    addLog(message, level, source);

    // Also log to console in dev mode
    if (isDev) {
      const prefix = `[${source}]`;
      switch (level) {
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        default:
          console.log(prefix, message);
      }
    }
  }

  /**
   * Clear all logs
   */
  clear() {
    const { clearLogs } = useOutputStore.getState();
    clearLogs();
    if (isDev) {
      console.clear();
    }
  }
}

// Export singleton instance
export default new Logger();
