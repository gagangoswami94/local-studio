const { isConfigured } = require('../services/anthropic');
const { generatePlan } = require('../services/planBuilder');
const { validatePlan, normalizePlan } = require('../utils/validation');

/**
 * Plan endpoint - generates implementation plans before code changes
 * POST /api/plan
 */
async function planRoutes(fastify, options) {
  fastify.post('/plan', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 5000,
            description: 'User request describing what needs to be implemented'
          },
          context: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              required: ['path', 'content'],
              properties: {
                path: { type: 'string' },
                content: { type: 'string' }
              }
            },
            description: 'Array of context files'
          },
          workspace_files: {
            type: 'array',
            maxItems: 1000,
            items: { type: 'string' },
            description: 'List of all workspace file paths for reference'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plan_id: { type: 'string' },
                complexity: { type: 'string' },
                estimated_minutes: { type: 'number' },
                steps: { type: 'array' },
                files_to_change: { type: 'array' },
                migrations: { type: 'array' },
                risks: { type: 'array' },
                dependencies: { type: 'object' },
                request_type: { type: 'string' },
                generated_at: { type: 'string' }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { message, context = [], workspace_files = [] } = request.body;

      try {
        // Check if Anthropic API is configured
        if (!isConfigured()) {
          return reply.code(503).send({
            success: false,
            error: 'Service Unavailable',
            details: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY in .env file.'
          });
        }

        // Log request
        fastify.log.info(`Plan generation: "${message.substring(0, 100)}..." with ${context.length} context files`);

        // Generate plan using Anthropic
        const plan = await generatePlan(message, context, workspace_files);

        // Normalize plan to ensure all fields are present
        const normalizedPlan = normalizePlan(plan);

        // Validate plan structure
        const validation = validatePlan(normalizedPlan);

        if (!validation.valid) {
          fastify.log.warn('Generated plan failed validation:', validation.errors);

          // Return plan anyway but include warning
          return {
            success: true,
            data: normalizedPlan,
            warnings: validation.errors,
            message: 'Plan generated but some fields may be incomplete'
          };
        }

        // Log success
        fastify.log.info(`Plan generated: ${normalizedPlan.plan_id}, complexity: ${normalizedPlan.complexity}, ${normalizedPlan.steps.length} steps, ${normalizedPlan.files_to_change.length} files`);

        return {
          success: true,
          data: normalizedPlan
        };

      } catch (error) {
        fastify.log.error('Plan generation error:', error);

        // Determine appropriate status code
        const statusCode = error.status === 429 ? 429 :
                          error.status >= 500 ? 503 :
                          500;

        return reply.code(statusCode).send({
          success: false,
          error: error.message || 'Failed to generate plan',
          details: error.retries ? `Failed after ${error.retries} retries` : undefined
        });
      }
    }
  });
}

module.exports = planRoutes;
