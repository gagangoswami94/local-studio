/**
 * Base Check
 * Abstract base class for validation checks
 */
class BaseCheck {
  /**
   * Create a new validation check
   * @param {Object} config - Configuration
   * @param {string} config.name - Check name
   * @param {string} config.level - 'blocker' or 'warning'
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.name = config.name || 'BaseCheck';
    this.level = config.level || 'blocker';
    this.logger = config.logger || console;
  }

  /**
   * Run the validation check
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} { passed, message, details }
   */
  async run(bundle) {
    throw new Error('run() must be implemented by subclass');
  }

  /**
   * Create success result
   * @param {string} message - Success message
   * @param {Object} details - Additional details
   * @returns {Object} Result object
   */
  success(message, details = {}) {
    return {
      passed: true,
      message,
      details
    };
  }

  /**
   * Create failure result
   * @param {string} message - Failure message
   * @param {Object} details - Additional details
   * @returns {Object} Result object
   */
  failure(message, details = {}) {
    return {
      passed: false,
      message,
      details
    };
  }

  /**
   * Log check start
   */
  logStart() {
    this.logger.info(`[${this.name}] Starting validation check...`);
  }

  /**
   * Log check result
   * @param {Object} result - Check result
   */
  logResult(result) {
    const status = result.passed ? '✓' : '✗';
    const level = result.passed ? 'info' : (this.level === 'blocker' ? 'error' : 'warn');

    this.logger[level](`[${this.name}] ${status} ${result.message}`, result.details);
  }
}

module.exports = BaseCheck;
