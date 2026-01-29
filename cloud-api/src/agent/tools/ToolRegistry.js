/**
 * Tool Registry
 * Singleton registry of all available tools for Agentic Mode
 */
class ToolRegistry {
  constructor() {
    if (ToolRegistry.instance) {
      return ToolRegistry.instance;
    }

    this.tools = new Map();
    this.logger = console;
    ToolRegistry.instance = this;
  }

  /**
   * Register a tool
   * @param {BaseTool} tool - Tool instance to register
   * @throws {Error} If tool with same name already registered
   */
  register(tool) {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {BaseTool|null} Tool instance or null if not found
   */
  get(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Check if a tool exists
   * @param {string} name - Tool name
   * @returns {boolean} True if tool exists
   */
  has(name) {
    return this.tools.has(name);
  }

  /**
   * List all registered tools
   * @returns {Array<string>} Array of tool names
   */
  list() {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all tool schemas for AI
   * Returns tool definitions in a format suitable for the AI
   * @returns {Array<Object>} Array of tool schemas
   */
  getSchemas() {
    return Array.from(this.tools.values()).map(tool => tool.getSchema());
  }

  /**
   * Get schema for a specific tool
   * @param {string} name - Tool name
   * @returns {Object|null} Tool schema or null if not found
   */
  getSchema(name) {
    const tool = this.get(name);
    return tool ? tool.getSchema() : null;
  }

  /**
   * Execute a tool by name
   * @param {string} name - Tool name
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   * @throws {Error} If tool not found
   */
  async execute(name, params, context = {}) {
    const tool = this.get(name);

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return await tool.safeExecute(params, context);
  }

  /**
   * Get tools by category or filter
   * @param {Function} filter - Filter function (tool => boolean)
   * @returns {Array<BaseTool>} Filtered tools
   */
  filter(filter) {
    return Array.from(this.tools.values()).filter(filter);
  }

  /**
   * Get tools that require approval
   * @returns {Array<BaseTool>} Tools requiring approval
   */
  getToolsRequiringApproval() {
    return this.filter(tool => tool.requiresApproval);
  }

  /**
   * Get tools that don't require approval
   * @returns {Array<BaseTool>} Tools not requiring approval
   */
  getToolsNotRequiringApproval() {
    return this.filter(tool => !tool.requiresApproval);
  }

  /**
   * Unregister a tool
   * @param {string} name - Tool name
   * @returns {boolean} True if tool was removed
   */
  unregister(name) {
    const removed = this.tools.delete(name);
    if (removed) {
      this.logger.debug(`Unregistered tool: ${name}`);
    }
    return removed;
  }

  /**
   * Clear all registered tools
   */
  clear() {
    this.tools.clear();
    this.logger.debug('Cleared all tools from registry');
  }

  /**
   * Get tool count
   * @returns {number} Number of registered tools
   */
  count() {
    return this.tools.size;
  }

  /**
   * Set logger
   * @param {Object} logger - Logger instance
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Get singleton instance
   * @static
   * @returns {ToolRegistry} Singleton instance
   */
  static getInstance() {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }
}

// Export singleton instance
module.exports = ToolRegistry.getInstance();
module.exports.ToolRegistry = ToolRegistry;
