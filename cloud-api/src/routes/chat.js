const { chatCompletion, isConfigured } = require('../services/anthropic');
const {
  buildSystemPrompt,
  buildAskPrompt,
  buildPlanPrompt,
  buildActPrompt,
  buildConversationHistory
} = require('../services/promptBuilder');

/**
 * Chat endpoint - handles AI chat interactions
 * POST /api/chat
 */
async function chatRoutes(fastify, options) {
  fastify.post('/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['message', 'mode'],
        properties: {
          message: { type: 'string' },
          mode: { type: 'string', enum: ['ask', 'plan', 'act'] },
          context: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' }
              }
            }
          },
          conversationHistory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string' }
              }
            }
          },
          plan: {
            type: 'object',
            description: 'Approved plan for ACT mode'
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { message, mode, context = [], conversationHistory = [], plan = null } = request.body;

      try {
        // Check if Anthropic API is configured
        if (!isConfigured()) {
          return {
            success: false,
            error: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY in .env file.',
            fallback: true,
            data: {
              mode,
              response: `[${mode.toUpperCase()} Mode - Mock Response] ${message}`,
              timestamp: new Date().toISOString()
            }
          };
        }

        // Build prompt based on mode
        let userPrompt;
        switch (mode) {
          case 'ask':
            userPrompt = buildAskPrompt(message, context);
            break;
          case 'plan':
            userPrompt = buildPlanPrompt(message, context);
            break;
          case 'act':
            userPrompt = buildActPrompt(message, context, plan);
            break;
          default:
            throw new Error(`Invalid mode: ${mode}`);
        }

        // Build conversation messages
        const messages = buildConversationHistory(conversationHistory, userPrompt);

        // Get system prompt
        const systemPrompt = buildSystemPrompt();

        // Call Anthropic API
        fastify.log.info(`Chat request: mode=${mode}, message="${message.substring(0, 50)}..."`);

        const result = await chatCompletion(messages, {
          system: systemPrompt,
          temperature: mode === 'act' ? 0.3 : 0.7, // Lower temp for code generation
          maxTokens: mode === 'act' ? 8192 : 4096 // More tokens for code generation
        });

        if (!result.success) {
          throw result;
        }

        // Parse response for plan/act modes
        let responseData;
        if (mode === 'plan' || mode === 'act') {
          try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              responseData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('No JSON found in response');
            }
          } catch (parseError) {
            fastify.log.error('Failed to parse JSON response:', parseError);
            // Return raw response if parsing fails
            responseData = {
              error: 'Failed to parse structured response',
              rawResponse: result.content
            };
          }
        } else {
          // ASK mode - return raw markdown
          responseData = result.content;
        }

        return {
          success: true,
          data: {
            mode,
            response: responseData,
            usage: result.usage,
            model: result.model,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        fastify.log.error('Chat error:', error);

        // Return user-friendly error
        return {
          success: false,
          error: error.error || error.message || 'Failed to process chat request',
          data: {
            mode,
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  });
}

module.exports = chatRoutes;
