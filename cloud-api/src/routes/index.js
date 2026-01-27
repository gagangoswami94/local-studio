const chatRoutes = require('./chat');
const generateRoutes = require('./generate');
const planRoutes = require('./plan');
const askRoutes = require('./ask');

/**
 * Route registry - registers all API routes
 */
async function routes(fastify, options) {
  // Register all route modules
  fastify.register(chatRoutes);
  fastify.register(generateRoutes);
  fastify.register(planRoutes);
  fastify.register(askRoutes);

  // API info endpoint
  fastify.get('/', async (request, reply) => {
    return {
      name: 'Local Studio Cloud API',
      version: '1.0.0',
      endpoints: {
        chat: 'POST /api/chat - Multi-mode chat (ask/plan/act)',
        ask: 'POST /api/chat/ask - Code explanations and debugging',
        generate: 'POST /api/generate - Full app generation',
        plan: 'POST /api/plan - Implementation planning'
      }
    };
  });
}

module.exports = routes;
