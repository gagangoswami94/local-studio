/**
 * Base Sub-Agent
 * Abstract base class for all specialized sub-agents
 */

const Anthropic = require('@anthropic-ai/sdk');
const EventEmitter = require('events');

class BaseSubAgent extends EventEmitter {
  constructor(orchestrator, config = {}) {
    super();

    this.orchestrator = orchestrator;
    this.name = config.name || 'BaseSubAgent';
    this.tokenBudget = config.tokenBudget || 10000;
    this.tokensUsed = 0;
    this.config = config;

    // Initialize Anthropic client if API key available
    this.anthropic = null;
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    // Model configuration
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = config.maxTokens || 4096;
  }

  /**
   * Execute a task - must be overridden by subclass
   * @param {Object} task - Task to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(task, context = {}) {
    throw new Error(`execute() must be implemented by ${this.name}`);
  }

  /**
   * Call AI with budget tracking
   * @param {Array} messages - Message array for AI
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} AI response
   */
  async callAI(messages, options = {}) {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    // Check token budget
    const estimatedInput = this.estimateTokens(JSON.stringify(messages));
    if (this.tokensUsed + estimatedInput > this.tokenBudget) {
      throw new Error(`Token budget exceeded for ${this.name}: ${this.tokensUsed}/${this.tokenBudget}`);
    }

    // Emit progress
    this.emitProgress({
      type: 'ai_call_start',
      agent: this.name,
      estimatedTokens: estimatedInput
    });

    try {
      const response = await this.anthropic.messages.create({
        model: options.model || this.model,
        max_tokens: options.max_tokens || this.maxTokens,
        messages,
        ...options
      });

      // Track token usage
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      this.tokensUsed += inputTokens + outputTokens;

      // Emit progress
      this.emitProgress({
        type: 'ai_call_complete',
        agent: this.name,
        inputTokens,
        outputTokens,
        totalUsed: this.tokensUsed,
        budget: this.tokenBudget
      });

      return {
        content: response.content[0].text,
        usage: response.usage,
        model: response.model,
        stopReason: response.stop_reason
      };
    } catch (error) {
      this.emitProgress({
        type: 'ai_call_error',
        agent: this.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Emit progress event
   * @param {Object} data - Progress data
   */
  emitProgress(data) {
    this.emit('progress', {
      agent: this.name,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Estimate tokens for content
   * @param {string} content - Content to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(content) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Get usage report
   * @returns {Object} Usage statistics
   */
  getUsageReport() {
    return {
      agent: this.name,
      tokensUsed: this.tokensUsed,
      tokenBudget: this.tokenBudget,
      percentageUsed: (this.tokensUsed / this.tokenBudget) * 100,
      remaining: this.tokenBudget - this.tokensUsed,
      withinBudget: this.tokensUsed <= this.tokenBudget
    };
  }

  /**
   * Reset token usage counter
   */
  resetUsage() {
    this.tokensUsed = 0;
  }

  /**
   * Check if budget allows operation
   * @param {number} estimatedTokens - Estimated tokens for operation
   * @returns {boolean} True if within budget
   */
  canAfford(estimatedTokens) {
    return (this.tokensUsed + estimatedTokens) <= this.tokenBudget;
  }

  /**
   * Format messages for AI call
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {Array} additionalMessages - Additional messages
   * @returns {Array} Formatted messages
   */
  formatMessages(systemPrompt, userPrompt, additionalMessages = []) {
    const messages = [];

    if (additionalMessages.length > 0) {
      messages.push(...additionalMessages);
    }

    messages.push({
      role: 'user',
      content: userPrompt
    });

    return messages;
  }

  /**
   * Extract code blocks from AI response
   * @param {string} content - AI response content
   * @returns {Array} Array of code blocks
   */
  extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return blocks;
  }

  /**
   * Validate task before execution
   * @param {Object} task - Task to validate
   * @returns {Object} Validation result
   */
  validateTask(task) {
    const errors = [];

    if (!task) {
      errors.push('Task is required');
    }

    if (task && !task.id) {
      errors.push('Task ID is required');
    }

    if (task && !task.action) {
      errors.push('Task action is required');
    }

    if (task && !task.target) {
      errors.push('Task target is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Log message with agent context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    if (this.orchestrator && this.orchestrator.logger) {
      this.orchestrator.logger[level](message, {
        agent: this.name,
        ...meta
      });
    } else {
      console.log(`[${level.toUpperCase()}] [${this.name}] ${message}`, meta);
    }
  }
}

module.exports = BaseSubAgent;
