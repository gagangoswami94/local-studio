const WebSocket = require('ws');
const logger = require('./utils/logger');
const url = require('url');

/**
 * WebSocket Server for Real-Time Progress Updates
 * Clients connect with taskId query parameter to receive progress events
 */

// Store active connections by taskId
const connections = new Map();

/**
 * Setup WebSocket server
 */
function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({
    noServer: true,
    path: '/events'
  });

  // Handle upgrade requests
  server.server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/events') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws, request) => {
    const params = url.parse(request.url, true).query;
    const taskId = params.taskId;

    if (!taskId) {
      logger.warn('WebSocket connection without taskId');
      ws.close(1008, 'taskId parameter required');
      return;
    }

    logger.info(`WebSocket connected for task: ${taskId}`);

    // Store connection
    if (!connections.has(taskId)) {
      connections.set(taskId, new Set());
    }
    connections.get(taskId).add(ws);

    // Handle disconnection
    ws.on('close', () => {
      logger.info(`WebSocket disconnected for task: ${taskId}`);
      const taskConnections = connections.get(taskId);
      if (taskConnections) {
        taskConnections.delete(ws);
        if (taskConnections.size === 0) {
          connections.delete(taskId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for task ${taskId}:`, { error: error.message });
    });

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      taskId,
      timestamp: new Date().toISOString()
    }));
  });

  logger.info('WebSocket server initialized');

  return wss;
}

/**
 * Broadcast event to all connections for a task
 */
function broadcastToTask(taskId, type, data) {
  const taskConnections = connections.get(taskId);

  if (!taskConnections || taskConnections.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type,
    taskId,
    data,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  let failedCount = 0;

  taskConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        sentCount++;
      } catch (error) {
        logger.error(`Failed to send message to WebSocket:`, { error: error.message });
        failedCount++;
      }
    } else {
      failedCount++;
    }
  });

  if (sentCount > 0) {
    logger.debug(`Broadcast ${type} to ${sentCount} client(s) for task ${taskId}`);
  }

  // Clean up dead connections
  if (failedCount > 0) {
    taskConnections.forEach((ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        taskConnections.delete(ws);
      }
    });

    if (taskConnections.size === 0) {
      connections.delete(taskId);
    }
  }
}

/**
 * Get connection count for a task
 */
function getConnectionCount(taskId) {
  const taskConnections = connections.get(taskId);
  return taskConnections ? taskConnections.size : 0;
}

/**
 * Close all connections for a task
 */
function closeTaskConnections(taskId, reason = 'Task completed') {
  const taskConnections = connections.get(taskId);

  if (!taskConnections) {
    return;
  }

  logger.info(`Closing ${taskConnections.size} connection(s) for task ${taskId}`);

  taskConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, reason);
    }
  });

  connections.delete(taskId);
}

module.exports = {
  setupWebSocketServer,
  broadcastToTask,
  getConnectionCount,
  closeTaskConnections
};
