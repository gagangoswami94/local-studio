/**
 * Base Tool Class
 * All tools must extend this class and implement the required methods
 */
class BaseTool {
  /**
   * Create a new tool
   * @param {Object} config - Tool configuration
   * @param {string} config.name - Unique tool identifier
   * @param {string} config.description - What the tool does (shown to AI)
   * @param {Object} config.parameters - JSON schema of input parameters
   * @param {boolean} config.requiresApproval - Does user need to approve? (default: false)
   * @param {Object} config.logger - Logger instance (default: console)
   */
  constructor(config = {}) {
    if (!config.name) {
      throw new Error('Tool must have a name');
    }

    if (!config.description) {
      throw new Error('Tool must have a description');
    }

    if (!config.parameters) {
      throw new Error('Tool must have parameters schema');
    }

    this.name = config.name;
    this.description = config.description;
    this.parameters = config.parameters;
    this.requiresApproval = config.requiresApproval || false;
    this.logger = config.logger || console;
  }

  /**
   * Execute the tool
   * Must be implemented by subclasses
   *
   * @param {Object} params - Tool parameters matching the schema
   * @param {Object} context - Execution context (workspace path, task ID, etc.)
   * @returns {Promise<Object>} Result with { success, data?, error? }
   */
  async execute(params, context = {}) {
    throw new Error(`Tool ${this.name} must implement execute() method`);
  }

  /**
   * Validate parameters against schema
   * @param {Object} params - Parameters to validate
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateParameters(params) {
    const errors = [];

    // Check required parameters
    if (this.parameters.required) {
      for (const requiredParam of this.parameters.required) {
        if (!(requiredParam in params)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Check parameter types (basic validation)
    if (this.parameters.properties) {
      for (const [paramName, paramValue] of Object.entries(params)) {
        const schema = this.parameters.properties[paramName];

        if (!schema) {
          errors.push(`Unknown parameter: ${paramName}`);
          continue;
        }

        // Type checking
        if (schema.type) {
          const actualType = Array.isArray(paramValue) ? 'array' : typeof paramValue;
          if (actualType !== schema.type) {
            errors.push(`Parameter ${paramName} must be type ${schema.type}, got ${actualType}`);
          }
        }

        // Enum checking
        if (schema.enum && !schema.enum.includes(paramValue)) {
          errors.push(`Parameter ${paramName} must be one of: ${schema.enum.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute tool with validation and error handling
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Result
   */
  async safeExecute(params, context = {}) {
    const startTime = Date.now();

    try {
      // Validate parameters
      const validation = this.validateParameters(params);
      if (!validation.valid) {
        this.logger.error(`Tool ${this.name} validation failed:`, validation.errors);
        return {
          success: false,
          error: `Parameter validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Log execution
      this.logger.info(`Executing tool: ${this.name}`, { params, context });

      // Execute tool
      const result = await this.execute(params, context);

      // Log success
      const duration = Date.now() - startTime;
      this.logger.info(`Tool ${this.name} completed in ${duration}ms`);

      return {
        success: true,
        ...result
      };

    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      this.logger.error(`Tool ${this.name} failed after ${duration}ms:`, error);

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        type: error.name
      };
    }
  }

  /**
   * Get tool schema for AI
   * Returns the tool definition in a format suitable for the AI
   * @returns {Object} Tool schema
   */
  getSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      requiresApproval: this.requiresApproval
    };
  }

  /**
   * Format result for display
   * Can be overridden by subclasses for custom formatting
   * @param {Object} result - Execution result
   * @returns {string} Formatted result
   */
  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    return JSON.stringify(result.data, null, 2);
  }
}

module.exports = BaseTool;
