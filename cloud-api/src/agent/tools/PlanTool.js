const BaseTool = require('./BaseTool');

/**
 * Plan Tool
 * Create execution plan for complex tasks
 * User reviews and approves/modifies plan before execution
 */
class PlanTool extends BaseTool {
  constructor() {
    super({
      name: 'create_plan',
      description: 'Create an execution plan for a complex task. User will review and approve the plan before execution begins.',
      parameters: {
        type: 'object',
        required: ['title', 'steps'],
        properties: {
          title: {
            type: 'string',
            description: 'Title of the plan'
          },
          description: {
            type: 'string',
            description: 'Optional: Brief description of what this plan achieves'
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              required: ['action', 'description'],
              properties: {
                action: {
                  type: 'string',
                  description: 'Action to perform (e.g., "Create file", "Run tests")'
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of this step'
                },
                tool: {
                  type: 'string',
                  description: 'Tool that will be used for this step (optional)'
                },
                estimated_time: {
                  type: 'string',
                  description: 'Estimated time for this step (optional)'
                },
                dependencies: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Step numbers this step depends on (optional)'
                }
              }
            },
            description: 'Array of steps in the plan'
          },
          risks: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Potential risks or considerations'
          }
        }
      },
      requiresApproval: true // User must approve plan
    });
  }

  async execute(params, context) {
    const { title, description, steps, risks = [] } = params;
    const timestamp = new Date().toISOString();

    // Validate steps
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Plan must have at least one step');
    }

    // Validate each step
    steps.forEach((step, index) => {
      if (!step.action || !step.description) {
        throw new Error(`Step ${index + 1} must have both 'action' and 'description'`);
      }
    });

    // Emit event if EventBus available
    const eventBus = context.eventBus;
    if (eventBus) {
      eventBus.emit('agent:plan:created', {
        title,
        description,
        steps,
        risks,
        timestamp
      });
    }

    // Store plan in context (always store, even if context.plan is initially null/undefined)
    context.plan = {
      title,
      description,
      steps,
      risks,
      timestamp,
      approved: false // Will be set to true after user approval
    };

    return {
      data: {
        title,
        description,
        stepCount: steps.length,
        steps,
        risks,
        timestamp,
        status: 'pending_approval'
      }
    };
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `\n${'='.repeat(60)}\n`;
    output += `📋 EXECUTION PLAN: ${data.title}\n`;
    output += `${'='.repeat(60)}\n`;

    if (data.description) {
      output += `\n${data.description}\n`;
    }

    output += `\nSteps (${data.stepCount}):\n`;
    data.steps.forEach((step, index) => {
      const stepNum = (index + 1).toString().padStart(2, ' ');
      output += `\n${stepNum}. ${step.action}\n`;
      output += `    ${step.description}\n`;

      if (step.tool) {
        output += `    Tool: ${step.tool}\n`;
      }

      if (step.estimated_time) {
        output += `    Est. Time: ${step.estimated_time}\n`;
      }

      if (step.dependencies && step.dependencies.length > 0) {
        output += `    Depends on: Step ${step.dependencies.join(', ')}\n`;
      }
    });

    if (data.risks && data.risks.length > 0) {
      output += `\n⚠️  Risks & Considerations:\n`;
      data.risks.forEach((risk, index) => {
        output += `${index + 1}. ${risk}\n`;
      });
    }

    output += `\n${'='.repeat(60)}\n`;
    output += `Status: ${data.status}\n`;
    output += `⏳ Awaiting user approval...\n`;
    output += `${'='.repeat(60)}\n`;

    return output;
  }
}

module.exports = PlanTool;
