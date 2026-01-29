const Anthropic = require('@anthropic-ai/sdk');
const { toolRegistry } = require('./tools');

/**
 * Agentic Runner
 * Manages the agentic execution loop with tool usage
 */
class AgenticRunner {
  constructor(config) {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
    });

    this.model = config.model || 'claude-sonnet-4-5-20250929';
    this.maxIterations = config.maxIterations || 25;
    this.warningThreshold = config.warningThreshold || 20;
    this.approvalTimeout = config.approvalTimeout || 300000; // 5 minutes

    this.logger = config.logger || console;
    this.eventBus = config.eventBus;
    this.tokenBudget = config.tokenBudget;
    this.errorHandler = config.errorHandler;
  }

  /**
   * Create system prompt for agentic mode
   * @private
   */
  _createSystemPrompt() {
    const tools = toolRegistry.list();
    const toolDescriptions = tools.map(tool => {
      const approval = tool.requiresApproval ? ' (requires approval)' : '';
      return `- ${tool.name}: ${tool.description}${approval}`;
    }).join('\n');

    return `You are an AI assistant helping users complete software development tasks.

Available Tools:
${toolDescriptions}

Instructions:
1. Use the available tools to complete the user's task efficiently
2. Start by using "think" to plan your approach
3. Use "ask_user" if you need clarification or additional information
4. Use "create_plan" for complex tasks that require multiple steps
5. Execute tools systematically to complete the task
6. Use "task_complete" when you've finished the task

Guidelines:
- Be proactive but ask for clarification when requirements are unclear
- Explain your reasoning when making decisions
- Use file operations carefully - always read before modifying
- Test your changes when possible
- Provide clear summaries of what you've accomplished

Remember: Some tools require user approval before execution. The system will handle approval requests automatically.`;
  }

  /**
   * Wait for tool approval
   * @private
   */
  async _waitForApproval(toolName, toolParams) {
    if (!this.eventBus) {
      throw new Error('EventBus required for approval flow');
    }

    // Emit approval request
    this.eventBus.emit('tool:approval_required', {
      toolName,
      params: toolParams,
      timestamp: new Date().toISOString()
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventBus.removeListener('tool:approval_response', responseHandler);
        reject(new Error('Approval request timed out'));
      }, this.approvalTimeout);

      const responseHandler = (response) => {
        clearTimeout(timeout);

        if (response.approved) {
          resolve({
            approved: true,
            modifiedParams: response.modifiedParams || toolParams
          });
        } else {
          resolve({
            approved: false,
            reason: response.reason || 'User denied approval'
          });
        }
      };

      this.eventBus.once('tool:approval_response', responseHandler);
    });
  }

  /**
   * Execute a tool
   * @private
   */
  async _executeTool(toolUse, context) {
    const { name: toolName, input: toolParams } = toolUse;

    try {
      const tool = toolRegistry.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Check if tool requires approval
      if (tool.requiresApproval) {
        const approval = await this._waitForApproval(toolName, toolParams);

        if (!approval.approved) {
          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Tool execution denied: ${approval.reason}`,
            is_error: true
          };
        }

        // Use modified params if provided
        const finalParams = approval.modifiedParams || toolParams;
        const result = await toolRegistry.execute(toolName, finalParams, context);

        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        };
      }

      // Execute tool without approval
      const result = await toolRegistry.execute(toolName, toolParams, context);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      };

    } catch (error) {
      this.logger.error('Tool execution error:', error);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: `Error: ${error.message}`,
        is_error: true
      };
    }
  }

  /**
   * Run agentic execution loop
   */
  async run(userRequest, context) {
    const messages = [];
    let iteration = 0;
    let isComplete = false;
    let finalResponse = null;

    // Build system prompt
    const systemPrompt = this._createSystemPrompt();

    // Add initial user message
    messages.push({
      role: 'user',
      content: userRequest
    });

    // Emit start event
    if (this.eventBus) {
      this.eventBus.emit('agentic:started', {
        request: userRequest,
        maxIterations: this.maxIterations,
        timestamp: new Date().toISOString()
      });
    }

    // Main loop
    while (!isComplete && iteration < this.maxIterations) {
      iteration++;

      // Warn at threshold
      if (iteration === this.warningThreshold && this.eventBus) {
        this.eventBus.emit('agentic:warning', {
          message: `Approaching iteration limit (${iteration}/${this.maxIterations})`,
          iteration,
          maxIterations: this.maxIterations
        });
      }

      // Check token budget
      if (this.tokenBudget && !this.tokenBudget.canAfford('agentic', 4000)) {
        throw new Error('Insufficient token budget');
      }

      // Reserve tokens
      let reservationId;
      if (this.tokenBudget) {
        reservationId = this.tokenBudget.reserve('agentic', 4000);
      }

      try {
        // Call Claude API
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: toolRegistry.getSchemas()
        });

        // Consume actual tokens
        if (this.tokenBudget && reservationId) {
          const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
          this.tokenBudget.consume('agentic', tokensUsed, reservationId);
        }

        // Emit iteration event
        if (this.eventBus) {
          this.eventBus.emit('agentic:iteration', {
            iteration,
            stopReason: response.stop_reason,
            tokensUsed: response.usage.input_tokens + response.usage.output_tokens
          });
        }

        // Add assistant message to history
        messages.push({
          role: 'assistant',
          content: response.content
        });

        // Check if AI wants to use tools
        const toolUses = response.content.filter(block => block.type === 'tool_use');

        if (toolUses.length > 0) {
          // Execute all tool uses
          const toolResults = [];

          for (const toolUse of toolUses) {
            // Emit tool execution event
            if (this.eventBus) {
              this.eventBus.emit('tool:executing', {
                toolName: toolUse.name,
                params: toolUse.input,
                iteration
              });
            }

            const result = await this._executeTool(toolUse, {
              ...context,
              eventBus: this.eventBus,
              logger: this.logger
            });

            toolResults.push(result);

            // Emit tool result event
            if (this.eventBus) {
              this.eventBus.emit('tool:executed', {
                toolName: toolUse.name,
                success: !result.is_error,
                result: result.content
              });
            }
          }

          // Add tool results to messages
          messages.push({
            role: 'user',
            content: toolResults
          });

        } else {
          // No tool use - task is complete
          isComplete = true;

          // Extract text content
          const textBlocks = response.content.filter(block => block.type === 'text');
          finalResponse = textBlocks.map(block => block.text).join('\n');
        }

        // Check for completion signal
        const completionTool = toolUses.find(t => t.name === 'task_complete');
        if (completionTool) {
          isComplete = true;
          finalResponse = completionTool.input.summary || 'Task completed';
        }

      } catch (error) {
        // Handle error with error handler if available
        if (this.errorHandler) {
          const handled = await this.errorHandler.handle(error, context);
          if (!handled) {
            throw error;
          }
          // Continue to next iteration after handling
        } else {
          throw error;
        }
      }
    }

    // Check if we hit iteration limit
    if (iteration >= this.maxIterations && !isComplete) {
      if (this.eventBus) {
        this.eventBus.emit('agentic:limit_reached', {
          iteration,
          maxIterations: this.maxIterations
        });
      }

      finalResponse = 'Maximum iterations reached. Task may be incomplete.';
    }

    // Emit completion event
    if (this.eventBus) {
      this.eventBus.emit('agentic:completed', {
        iterations: iteration,
        success: isComplete,
        response: finalResponse
      });
    }

    return {
      success: isComplete,
      response: finalResponse,
      iterations: iteration,
      messages
    };
  }
}

module.exports = AgenticRunner;
