const BaseTool = require('./BaseTool');

/**
 * Ask User Tool
 * Ask user for clarification or input during execution
 */
class AskUserTool extends BaseTool {
  constructor() {
    super({
      name: 'ask_user',
      description: 'Ask the user a question for clarification or input. Pauses execution until user responds.',
      parameters: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            description: 'Question to ask the user'
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Array of predefined answer options for the user to choose from'
          },
          defaultAnswer: {
            type: 'string',
            description: 'Optional: Default answer if user provides none'
          }
        }
      },
      requiresApproval: false // Special case: always interacts with user
    });
  }

  async execute(params, context) {
    const { question, options, defaultAnswer } = params;

    // Get EventBus from context if available
    const eventBus = context.eventBus;

    if (!eventBus) {
      // No EventBus available, return with placeholder
      this.logger.warn('No EventBus available for user interaction');
      return {
        data: {
          question,
          options: options || [],
          answer: defaultAnswer || 'No EventBus available - using default',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Emit question event
    eventBus.emit('user:question', {
      question,
      options: options || [],
      defaultAnswer,
      timestamp: new Date().toISOString()
    });

    // Wait for user response
    // In production, this would be a Promise that resolves when user responds
    // For now, we'll return a structure that indicates we need user input
    return new Promise((resolve) => {
      // Set up one-time listener for user response
      const responseHandler = (response) => {
        resolve({
          data: {
            question,
            options: options || [],
            answer: response.answer || defaultAnswer || '',
            timestamp: new Date().toISOString()
          }
        });
      };

      // Register listener (will be called when user responds)
      eventBus.once('user:response', responseHandler);

      // Set timeout (default 5 minutes)
      const timeout = setTimeout(() => {
        eventBus.removeListener('user:response', responseHandler);
        resolve({
          data: {
            question,
            options: options || [],
            answer: defaultAnswer || '',
            timedOut: true,
            timestamp: new Date().toISOString()
          }
        });
      }, 300000); // 5 minutes

      // Store timeout so it can be cleared
      eventBus.once('user:response', () => clearTimeout(timeout));
    });
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `Question: ${data.question}\n`;

    if (data.options && data.options.length > 0) {
      output += `Options: ${data.options.join(', ')}\n`;
    }

    output += `Answer: ${data.answer}\n`;

    if (data.timedOut) {
      output += `⚠️  User did not respond (timed out)\n`;
    }

    return output;
  }
}

module.exports = AskUserTool;
