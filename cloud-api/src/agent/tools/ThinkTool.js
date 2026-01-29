const BaseTool = require('./BaseTool');

/**
 * Think Tool
 * Record AI reasoning and thoughts (not directly shown to user)
 * Helps AI organize thoughts and maintain context during complex tasks
 */
class ThinkTool extends BaseTool {
  constructor() {
    super({
      name: 'think',
      description: 'Record reasoning and thoughts. Helps organize complex problem-solving. Not directly shown to user.',
      parameters: {
        type: 'object',
        required: ['thought'],
        properties: {
          thought: {
            type: 'string',
            description: 'The reasoning or thought to record'
          },
          category: {
            type: 'string',
            enum: ['analysis', 'planning', 'decision', 'observation', 'question', 'conclusion'],
            description: 'Category of the thought (default: observation)'
          },
          importance: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Importance level of this thought (default: medium)'
          }
        }
      },
      requiresApproval: false // Just logs thoughts, no actions
    });
  }

  async execute(params, context) {
    const { thought, category = 'observation', importance = 'medium' } = params;
    const timestamp = new Date().toISOString();

    // Log the thought
    this.logger.info(`[THINK:${category}:${importance}] ${thought}`);

    // Emit event if EventBus available
    const eventBus = context.eventBus;
    if (eventBus) {
      eventBus.emit('agent:thought', {
        thought,
        category,
        importance,
        timestamp
      });
    }

    // Store in context if available
    if (context.thoughts) {
      context.thoughts.push({
        thought,
        category,
        importance,
        timestamp
      });
    }

    return {
      data: {
        thought,
        category,
        importance,
        timestamp,
        recorded: true
      }
    };
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;

    // Thoughts are typically not shown to user in normal output
    // But format for debugging/logging purposes
    const icon = this._getCategoryIcon(data.category);
    return `${icon} [${data.category}] ${data.thought}`;
  }

  /**
   * Get icon for thought category
   * @private
   */
  _getCategoryIcon(category) {
    const icons = {
      analysis: '🔍',
      planning: '📋',
      decision: '✅',
      observation: '👁️',
      question: '❓',
      conclusion: '💡'
    };
    return icons[category] || '💭';
  }
}

module.exports = ThinkTool;
