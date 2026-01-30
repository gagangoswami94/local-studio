const chatRoutes = require('./chat');
const generateRoutes = require('./generate');
const planRoutes = require('./plan');
const askRoutes = require('./ask');
const bundleRoutes = require('./bundle');

/**
 * Route registry - registers all API routes
 */
async function routes(fastify, options) {
  // Register all route modules
  fastify.register(chatRoutes);
  fastify.register(generateRoutes);
  fastify.register(planRoutes);
  fastify.register(askRoutes);
  fastify.register(bundleRoutes);

  // API info endpoint
  fastify.get('/', async (request, reply) => {
    return {
      name: 'Local Studio Cloud API',
      version: '1.0.0',
      endpoints: {
        chat: 'POST /api/chat - Multi-mode chat (ask/plan/act)',
        ask: 'POST /api/chat/ask - Code explanations and debugging',
        generate: 'POST /api/generate - Full app generation',
        plan: 'POST /api/plan - Implementation planning',
        bundle: {
          generate: 'POST /api/bundle/generate - Generate signed code bundle',
          download: 'GET /api/bundle/:bundleId - Download bundle by ID',
          status: 'GET /api/bundle/status/:taskId - Get task status',
          approval: 'POST /api/bundle/approval/:taskId - Submit plan approval',
          retryValidation: 'POST /api/bundle/retry-validation/:taskId - Retry validation',
          regenerate: 'POST /api/bundle/regenerate/:taskId - Regenerate with fixes'
        }
      }
    };
  });
}

module.exports = routes;
