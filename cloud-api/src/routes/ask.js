const { chatCompletion, isConfigured } = require('../services/anthropic');
const { buildSystemPrompt, buildAskPrompt } = require('../services/promptBuilder');
const { analyzeResponse } = require('../services/codeAnalyzer');

/**
 * ASK endpoint - handles code explanations, debugging help, and questions
 * POST /api/chat/ask
 */
async function askRoutes(fastify, options) {
  fastify.post('/chat/ask', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 10000,
            description: 'User question or request for explanation'
          },
          context: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              required: ['path', 'content'],
              properties: {
                path: {
                  type: 'string',
                  description: 'File path'
                },
                content: {
                  type: 'string',
                  description: 'File content'
                }
              }
            },
            description: 'Array of files to provide as context'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            response: { type: 'string' },
            analysis: {
              type: 'object',
              properties: {
                fileReferences: { type: 'array' },
                codeBlocks: { type: 'array' },
                hasCode: { type: 'boolean' },
                hasFileReferences: { type: 'boolean' }
              }
            },
            usage: { type: 'object' },
            model: { type: 'string' },
            timestamp: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { message, context = [] } = request.body;

      // Validate input
      if (!message || message.trim().length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          details: 'Message cannot be empty'
        });
      }

      // Check if context files are too large
      const totalContextSize = context.reduce((sum, file) => sum + file.content.length, 0);
      if (totalContextSize > 500000) { // 500KB limit
        return reply.code(400).send({
          error: 'Bad Request',
          details: 'Context files too large. Maximum 500KB total.'
        });
      }

      try {
        // Check if Anthropic API is configured
        if (!isConfigured()) {
          return reply.code(503).send({
            error: 'Service Unavailable',
            details: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY in .env file.'
          });
        }

        // Log request
        fastify.log.info(`ASK request: "${message.substring(0, 100)}..." with ${context.length} context files`);

        // Build prompt
        const userPrompt = buildAskPrompt(message, context);
        const systemPrompt = buildSystemPrompt();

        // Enhanced system prompt for ASK mode
        const askSystemPrompt = systemPrompt + `\n\n# ASK Mode Guidelines

When referencing specific locations in code:
- Use format: [filename:line] or \`filename:line\`
- Example: "The bug is in [src/App.jsx:42]"
- Example: "Check the function at \`services/api.js:156\`"

For code explanations:
- Include working code examples
- Use appropriate language tags in code blocks
- Explain the "why" not just the "what"

For debugging help:
- Identify the root cause
- Suggest specific fixes with file:line references
- Provide corrected code when helpful

For error explanations:
- Explain what the error means
- Show common causes
- Provide solution with examples`;

        // Call Anthropic API
        const result = await chatCompletion(
          [{ role: 'user', content: userPrompt }],
          {
            system: askSystemPrompt,
            temperature: 0.7,
            maxTokens: 4096
          }
        );

        if (!result.success) {
          throw result;
        }

        // Analyze response for file references and code blocks
        const analysis = analyzeResponse(result.content);

        // Log interaction
        fastify.log.info(`ASK response: ${result.usage.totalTokens} tokens, ${analysis.codeBlocks.length} code blocks, ${analysis.fileReferences.length} file refs`);

        return {
          response: result.content,
          analysis: {
            fileReferences: analysis.fileReferences,
            codeBlocks: analysis.codeBlocks.map(cb => ({
              language: cb.language,
              lineCount: cb.code.split('\n').length
            })),
            hasCode: analysis.hasCode,
            hasFileReferences: analysis.hasFileReferences
          },
          usage: result.usage,
          model: result.model,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        fastify.log.error('ASK endpoint error:', error);

        // Determine appropriate status code
        const statusCode = error.status === 429 ? 429 :
                          error.status >= 500 ? 503 :
                          500;

        return reply.code(statusCode).send({
          error: error.error || error.message || 'Failed to process request',
          details: error.retries ? `Failed after ${error.retries} retries` : undefined
        });
      }
    }
  });
}

module.exports = askRoutes;
