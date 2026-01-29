/**
 * Error Handler with intelligent retry logic
 * Handles classification and recovery strategies for different error types
 */

/**
 * Error type classifications
 */
const ErrorTypes = {
  RATE_LIMIT: 'rate_limit',           // 429 errors → wait and retry
  TOKEN_LIMIT: 'token_limit',         // Context too long → reduce context and retry
  GENERATION: 'generation',           // AI produced invalid output → add feedback and retry
  VALIDATION: 'validation',           // Output failed checks → try alternative approach
  NETWORK: 'network',                 // Connection issues → exponential backoff
  TIMEOUT: 'timeout',                 // Request timeout → increase timeout once
  TOOL_ERROR: 'tool_error',          // Tool execution failed (agentic mode)
  AUTH: 'auth',                      // API key issues → don't retry
  UNRECOVERABLE: 'unrecoverable'     // Fatal errors → don't retry
};

/**
 * Error Handler class
 */
class ErrorHandler {
  /**
   * Create a new Error Handler
   * @param {Object} options - Configuration options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {Array<number>} options.retryDelays - Delays in ms for each retry (default: [1000, 2000, 5000])
   * @param {Function} options.onRetry - Callback on each retry attempt
   * @param {Function} options.onError - Callback on final error
   * @param {Object} options.logger - Logger instance (default: console)
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelays = options.retryDelays || [1000, 2000, 5000];
    this.onRetry = options.onRetry || null;
    this.onError = options.onError || null;
    this.logger = options.logger || console;
    this.timeoutIncreased = false; // Track if we've increased timeout already
  }

  /**
   * Wrap an operation with retry logic
   * @param {Function} operation - Async operation to execute
   * @param {Object} context - Context object with recovery methods
   * @param {Function} context.reduceContext - Reduce context size for token limit errors
   * @param {Function} context.addFeedback - Add feedback for generation errors
   * @param {Function} context.tryAlternative - Try alternative approach for validation errors
   * @param {Function} context.increaseTimeout - Increase timeout for timeout errors
   * @returns {Promise<any>} Operation result
   * @throws {Error} Final error after max retries
   */
  async withRetry(operation, context = {}) {
    let lastError = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        // Execute the operation
        const result = await operation();

        // Success! Reset timeout flag for next operation
        this.timeoutIncreased = false;

        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        // Classify the error
        const errorType = this._classifyError(error);

        // Log the error
        this.logger.error(`Operation failed (attempt ${attempt}/${this.maxRetries + 1}):`, {
          type: errorType,
          message: error.message,
          status: error.status,
          code: error.code
        });

        // Check if error is recoverable
        if (!this._isRecoverable(errorType)) {
          this.logger.error('Error is not recoverable, failing immediately');
          throw error;
        }

        // Check if we've exhausted retries
        if (attempt > this.maxRetries) {
          this.logger.error('Max retries exceeded');
          break;
        }

        // Apply recovery strategy
        const recovered = await this._applyRecoveryStrategy(errorType, error, context, attempt);

        if (!recovered) {
          this.logger.warn('Recovery strategy failed, retrying anyway...');
        }

        // Calculate delay for this attempt
        const delay = this._getRetryDelay(errorType, error, attempt);

        this.logger.info(`Retrying in ${delay}ms...`);

        // Trigger retry callback
        if (this.onRetry) {
          this.onRetry({
            attempt,
            errorType,
            error,
            delay
          });
        }

        // Wait before retrying
        await this._sleep(delay);
      }
    }

    // All retries exhausted
    if (this.onError) {
      this.onError({
        error: lastError,
        attempts: attempt
      });
    }

    throw lastError;
  }

  /**
   * Classify error into error type
   * @param {Error} error - Error to classify
   * @returns {string} Error type from ErrorTypes
   * @private
   */
  _classifyError(error) {
    // Rate limit errors (429)
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return ErrorTypes.RATE_LIMIT;
    }

    // Token limit errors
    if (
      error.status === 400 &&
      (error.message?.includes('context_length_exceeded') ||
       error.message?.includes('too long') ||
       error.message?.includes('token limit'))
    ) {
      return ErrorTypes.TOKEN_LIMIT;
    }

    // Auth errors (401, 403)
    if (error.status === 401 || error.status === 403 || error.code === 'authentication_error') {
      return ErrorTypes.AUTH;
    }

    // Network errors
    if (
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'EAI_AGAIN' ||
      error.message?.includes('network') ||
      error.message?.includes('ECONNRESET')
    ) {
      return ErrorTypes.NETWORK;
    }

    // Timeout errors
    if (
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout') ||
      error.message?.includes('timed out')
    ) {
      return ErrorTypes.TIMEOUT;
    }

    // Generation errors (AI output parsing failures)
    if (
      error.message?.includes('JSON') ||
      error.message?.includes('parse') ||
      error.message?.includes('invalid format') ||
      error.name === 'SyntaxError'
    ) {
      return ErrorTypes.GENERATION;
    }

    // Validation errors
    if (
      error.message?.includes('validation') ||
      error.message?.includes('invalid') ||
      error.name === 'ValidationError'
    ) {
      return ErrorTypes.VALIDATION;
    }

    // Tool errors (for agentic mode)
    if (
      error.message?.includes('tool') ||
      error.message?.includes('execution failed') ||
      error.name === 'ToolError'
    ) {
      return ErrorTypes.TOOL_ERROR;
    }

    // Server errors (500+) are usually recoverable
    if (error.status >= 500) {
      return ErrorTypes.NETWORK;
    }

    // Default to unrecoverable
    return ErrorTypes.UNRECOVERABLE;
  }

  /**
   * Check if error type is recoverable
   * @param {string} errorType - Error type
   * @returns {boolean} True if recoverable
   * @private
   */
  _isRecoverable(errorType) {
    const unrecoverableTypes = [
      ErrorTypes.AUTH,
      ErrorTypes.UNRECOVERABLE
    ];

    return !unrecoverableTypes.includes(errorType);
  }

  /**
   * Apply recovery strategy based on error type
   * @param {string} errorType - Error type
   * @param {Error} error - Original error
   * @param {Object} context - Context with recovery methods
   * @param {number} attempt - Current attempt number
   * @returns {Promise<boolean>} True if recovery applied
   * @private
   */
  async _applyRecoveryStrategy(errorType, error, context, attempt) {
    switch (errorType) {
      case ErrorTypes.RATE_LIMIT:
        // Rate limit: just wait (delay handled in _getRetryDelay)
        this.logger.info('Rate limit hit, waiting before retry...');
        return true;

      case ErrorTypes.TOKEN_LIMIT:
        // Token limit: reduce context if available
        if (context.reduceContext && typeof context.reduceContext === 'function') {
          this.logger.info('Token limit exceeded, reducing context...');
          await context.reduceContext(attempt);
          return true;
        }
        this.logger.warn('Token limit exceeded but no reduceContext method available');
        return false;

      case ErrorTypes.GENERATION:
        // Generation error: add feedback about what went wrong
        if (context.addFeedback && typeof context.addFeedback === 'function') {
          this.logger.info('Generation error, adding feedback...');
          await context.addFeedback(error.message);
          return true;
        }
        this.logger.warn('Generation error but no addFeedback method available');
        return false;

      case ErrorTypes.VALIDATION:
        // Validation error: try alternative approach
        if (context.tryAlternative && typeof context.tryAlternative === 'function') {
          this.logger.info('Validation failed, trying alternative approach...');
          await context.tryAlternative(attempt);
          return true;
        }
        this.logger.warn('Validation error but no tryAlternative method available');
        return false;

      case ErrorTypes.TIMEOUT:
        // Timeout: increase timeout once
        if (!this.timeoutIncreased && context.increaseTimeout && typeof context.increaseTimeout === 'function') {
          this.logger.info('Timeout occurred, increasing timeout...');
          await context.increaseTimeout();
          this.timeoutIncreased = true;
          return true;
        }
        this.logger.warn('Timeout occurred but timeout already increased or no increaseTimeout method available');
        return false;

      case ErrorTypes.NETWORK:
      case ErrorTypes.TOOL_ERROR:
        // Network/Tool errors: just retry with exponential backoff
        this.logger.info(`${errorType} error, will retry with backoff...`);
        return true;

      default:
        return false;
    }
  }

  /**
   * Get retry delay based on error type and attempt
   * @param {string} errorType - Error type
   * @param {Error} error - Original error
   * @param {number} attempt - Current attempt number (1-indexed)
   * @returns {number} Delay in milliseconds
   * @private
   */
  _getRetryDelay(errorType, error, attempt) {
    // Rate limit: check for retry-after header
    if (errorType === ErrorTypes.RATE_LIMIT && error.retryAfter) {
      // retryAfter is in seconds, convert to ms
      return error.retryAfter * 1000;
    }

    // Use configured delays or exponential backoff
    const index = attempt - 1;
    if (index < this.retryDelays.length) {
      return this.retryDelays[index];
    }

    // Exponential backoff after configured delays
    const lastDelay = this.retryDelays[this.retryDelays.length - 1];
    return lastDelay * Math.pow(2, index - this.retryDelays.length + 1);
  }

  /**
   * Sleep helper
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error type constants
   * @static
   */
  static get ErrorTypes() {
    return ErrorTypes;
  }
}

module.exports = ErrorHandler;
module.exports.ErrorTypes = ErrorTypes;
