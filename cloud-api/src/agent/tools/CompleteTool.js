const BaseTool = require('./BaseTool');

/**
 * Complete Tool
 * Mark task as complete and provide summary
 * Signals end of agentic execution loop
 */
class CompleteTool extends BaseTool {
  constructor() {
    super({
      name: 'task_complete',
      description: 'Mark the task as complete and provide a summary of what was accomplished. Signals the end of execution.',
      parameters: {
        type: 'object',
        required: ['summary'],
        properties: {
          summary: {
            type: 'string',
            description: 'Summary of what was accomplished'
          },
          files_changed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: List of files that were created or modified'
          },
          tests_passed: {
            type: 'boolean',
            description: 'Optional: Whether tests passed (if tests were run)'
          },
          next_steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Suggested next steps for the user'
          },
          warnings: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Any warnings or issues to be aware of'
          }
        }
      },
      requiresApproval: false // Just marks completion, no actions
    });
  }

  async execute(params, context) {
    const {
      summary,
      files_changed = [],
      tests_passed,
      next_steps = [],
      warnings = []
    } = params;

    const timestamp = new Date().toISOString();

    // Emit completion event if EventBus available
    const eventBus = context.eventBus;
    if (eventBus) {
      eventBus.emit('task:complete', {
        summary,
        files_changed,
        tests_passed,
        next_steps,
        warnings,
        timestamp
      });
    }

    // Update context status
    if (context.status) {
      context.status = 'completed';
    }

    // Log completion
    this.logger.info(`Task completed: ${summary}`);

    return {
      data: {
        summary,
        files_changed,
        tests_passed,
        next_steps,
        warnings,
        timestamp,
        completed: true
      }
    };
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `\n${'='.repeat(60)}\n`;
    output += `✅ TASK COMPLETE\n`;
    output += `${'='.repeat(60)}\n`;

    output += `\nSummary:\n${data.summary}\n`;

    if (data.files_changed && data.files_changed.length > 0) {
      output += `\nFiles Changed (${data.files_changed.length}):\n`;
      data.files_changed.forEach(file => {
        output += `  📄 ${file}\n`;
      });
    }

    if (data.tests_passed !== undefined) {
      output += `\nTests: ${data.tests_passed ? '✅ Passed' : '❌ Failed'}\n`;
    }

    if (data.warnings && data.warnings.length > 0) {
      output += `\n⚠️  Warnings:\n`;
      data.warnings.forEach((warning, index) => {
        output += `${index + 1}. ${warning}\n`;
      });
    }

    if (data.next_steps && data.next_steps.length > 0) {
      output += `\n📝 Suggested Next Steps:\n`;
      data.next_steps.forEach((step, index) => {
        output += `${index + 1}. ${step}\n`;
      });
    }

    output += `\n${'='.repeat(60)}\n`;
    output += `Completed at: ${new Date(data.timestamp).toLocaleString()}\n`;
    output += `${'='.repeat(60)}\n`;

    return output;
  }
}

module.exports = CompleteTool;
