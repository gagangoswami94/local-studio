require('dotenv').config();
const fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');

// Import routes
const routes = require('./routes');

/**
 * Create and configure Fastify server
 */
async function createServer() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  });

  // Register CORS
  await server.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true
  });

  // Register JWT
  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'local-studio-secret-key-change-in-production'
  });

  // Health check endpoint
  server.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  // Register API routes
  await server.register(routes, { prefix: '/api' });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    server.log.error(error);

    // Send appropriate error response
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    reply.status(statusCode).send({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  return server;
}

/**
 * Start the server
 */
async function start() {
  try {
    const server = await createServer();
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`🚀 Cloud API server running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  start();
}

module.exports = { createServer, start };
