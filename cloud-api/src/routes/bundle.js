const AgentOrchestrator = require('../agent/AgentOrchestrator');
const EventBus = require('../agent/EventBus');
const logger = require('../utils/logger');
const { broadcastToTask, closeTaskConnections } = require('../websocket');

/**
 * Bundle Routes
 * Handles bundle generation, validation, and lifecycle management
 *
 * Endpoints:
 * - POST /bundle/generate - Generate signed code bundle
 * - GET /bundle/:bundleId - Download bundle by ID
 * - GET /bundle/status/:taskId - Get task status
 * - POST /bundle/approval/:taskId - Submit plan approval
 * - POST /bundle/retry-validation/:taskId - Retry validation
 * - POST /bundle/regenerate/:taskId - Regenerate with fixes
 */

// Store for active tasks (in production, use Redis or database)
const activeTasks = new Map();
const completedTasks = new Map();
const bundleStorage = new Map();

// Task retention: 1 hour for active, 24 hours for completed
const ACTIVE_TASK_TTL = 60 * 60 * 1000;
const COMPLETED_TASK_TTL = 24 * 60 * 60 * 1000;

/**
 * Cleanup old tasks periodically
 */
setInterval(() => {
  const now = Date.now();

  // Cleanup active tasks
  for (const [taskId, task] of activeTasks.entries()) {
    if (now - task.startTime > ACTIVE_TASK_TTL) {
      logger.info(`Cleaning up stale active task: ${taskId}`);
      activeTasks.delete(taskId);
    }
  }

  // Cleanup completed tasks
  for (const [taskId, task] of completedTasks.entries()) {
    if (now - task.completedTime > COMPLETED_TASK_TTL) {
      logger.info(`Cleaning up old completed task: ${taskId}`);
      completedTasks.delete(taskId);
    }
  }

  // Cleanup old bundles
  for (const [bundleId, bundle] of bundleStorage.entries()) {
    if (now - new Date(bundle.created_at).getTime() > COMPLETED_TASK_TTL) {
      logger.info(`Cleaning up old bundle: ${bundleId}`);
      bundleStorage.delete(bundleId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

async function bundleRoutes(fastify, options) {

  /**
   * POST /bundle/generate
   * Generate a signed code bundle with validation
   */
  fastify.post('/bundle/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
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
          workspaceFiles: {
            type: 'array',
            items: { type: 'string' }
          },
          appSpec: {
            type: 'object',
            properties: {
              stack: { type: 'string' },
              database: { type: 'string' },
              features: { type: 'array', items: { type: 'string' } }
            }
          },
          requireApproval: { type: 'boolean' }
        }
      }
    },
    handler: async (request, reply) => {
      const { message, context = [], workspaceFiles = [], appSpec = {}, requireApproval = true } = request.body;

      try {
        // Create event bus for this task
        const eventBus = new EventBus();
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.info(`Starting bundle generation: ${taskId}`);

        // Store task
        activeTasks.set(taskId, {
          taskId,
          status: 'running',
          startTime: Date.now(),
          eventBus,
          request: { message, context, workspaceFiles, appSpec, requireApproval }
        });

        // Return immediately with taskId (execution continues in background)
        reply.send({
          success: true,
          taskId,
          message: 'Bundle generation started. Connect to WebSocket for progress updates.'
        });

        // Execute bundle generation asynchronously
        executeBundleGeneration(taskId, { message, context, workspaceFiles, appSpec, requireApproval }, eventBus)
          .catch(error => {
            logger.error(`Bundle generation failed for ${taskId}:`, error);
            const task = activeTasks.get(taskId);
            if (task) {
              task.status = 'failed';
              task.error = error.message;
              task.result = { success: false, error: error.message };
              // Move to completed
              completedTasks.set(taskId, { ...task, completedTime: Date.now() });
              activeTasks.delete(taskId);
            }
          });

      } catch (error) {
        logger.error('Bundle generation request failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }
  });

  /**
   * GET /bundle/:bundleId
   * Download a bundle by ID
   */
  fastify.get('/bundle/:bundleId', {
    handler: async (request, reply) => {
      const { bundleId } = request.params;

      const bundle = bundleStorage.get(bundleId);

      if (!bundle) {
        return reply.code(404).send({
          success: false,
          error: `Bundle not found: ${bundleId}`
        });
      }

      return {
        success: true,
        bundle
      };
    }
  });

  /**
   * GET /bundle/status/:taskId
   * Get status of bundle generation task
   */
  fastify.get('/bundle/status/:taskId', {
    handler: async (request, reply) => {
      const { taskId } = request.params;

      // Check active tasks
      const activeTask = activeTasks.get(taskId);
      if (activeTask) {
        return {
          success: true,
          taskId,
          status: activeTask.status,
          startTime: activeTask.startTime,
          phase: activeTask.phase || 'unknown'
        };
      }

      // Check completed tasks
      const completedTask = completedTasks.get(taskId);
      if (completedTask) {
        return {
          success: true,
          taskId,
          status: completedTask.status,
          startTime: completedTask.startTime,
          completedTime: completedTask.completedTime,
          result: completedTask.result
        };
      }

      return reply.code(404).send({
        success: false,
        error: `Task not found: ${taskId}`
      });
    }
  });

  /**
   * POST /bundle/approval/:taskId
   * Submit approval for high-risk plan
   */
  fastify.post('/bundle/approval/:taskId', {
    schema: {
      body: {
        type: 'object',
        required: ['approved'],
        properties: {
          approved: { type: 'boolean' },
          reason: { type: 'string' },
          modifiedPlan: { type: 'object' }
        }
      }
    },
    handler: async (request, reply) => {
      const { taskId } = request.params;
      const { approved, reason, modifiedPlan } = request.body;

      const task = activeTasks.get(taskId);

      if (!task) {
        return reply.code(404).send({
          success: false,
          error: `Task not found: ${taskId}`
        });
      }

      if (task.status !== 'awaiting_approval') {
        return reply.code(400).send({
          success: false,
          error: `Task is not awaiting approval. Current status: ${task.status}`
        });
      }

      logger.info(`Approval ${approved ? 'granted' : 'rejected'} for task ${taskId}`);

      // Submit approval to orchestrator
      if (task.orchestrator) {
        task.orchestrator.submitApproval(taskId, { approved, reason, modifiedPlan });
      }

      return {
        success: true,
        message: approved ? 'Approval granted' : 'Plan rejected'
      };
    }
  });

  /**
   * POST /bundle/retry-validation/:taskId
   * Retry validation with different parameters
   */
  fastify.post('/bundle/retry-validation/:taskId', {
    schema: {
      body: {
        type: 'object',
        properties: {
          coverageThreshold: { type: 'number', minimum: 0, maximum: 100 },
          skipChecks: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { taskId } = request.params;
      const { coverageThreshold, skipChecks = [] } = request.body;

      const task = completedTasks.get(taskId) || activeTasks.get(taskId);

      if (!task) {
        return reply.code(404).send({
          success: false,
          error: `Task not found: ${taskId}`
        });
      }

      if (!task.orchestrator) {
        return reply.code(400).send({
          success: false,
          error: 'Task orchestrator not available for retry'
        });
      }

      try {
        logger.info(`Retrying validation for task ${taskId}`);

        const result = await task.orchestrator.retryValidation(taskId, {
          coverageThreshold,
          skipChecks
        });

        // Update task with new validation result
        task.result = { ...task.result, validation: result };

        return {
          success: true,
          validation: result
        };
      } catch (error) {
        logger.error(`Validation retry failed for ${taskId}:`, error);
        return reply.code(500).send({
          success: false,
          error: error.message
        });
      }
    }
  });

  /**
   * POST /bundle/regenerate/:taskId
   * Regenerate bundle with fix instructions
   */
  fastify.post('/bundle/regenerate/:taskId', {
    schema: {
      body: {
        type: 'object',
        properties: {
          fixInstructions: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { taskId } = request.params;
      const { fixInstructions = [] } = request.body;

      const task = completedTasks.get(taskId) || activeTasks.get(taskId);

      if (!task) {
        return reply.code(404).send({
          success: false,
          error: `Task not found: ${taskId}`
        });
      }

      if (!task.orchestrator) {
        return reply.code(400).send({
          success: false,
          error: 'Task orchestrator not available for regeneration'
        });
      }

      try {
        logger.info(`Regenerating bundle for task ${taskId} with ${fixInstructions.length} fix instruction(s)`);

        // Create new task ID for regeneration
        const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const eventBus = new EventBus();

        activeTasks.set(newTaskId, {
          taskId: newTaskId,
          status: 'running',
          startTime: Date.now(),
          eventBus,
          parentTaskId: taskId
        });

        // Return immediately
        reply.send({
          success: true,
          taskId: newTaskId,
          message: 'Bundle regeneration started'
        });

        // Execute regeneration asynchronously
        task.orchestrator.regenerateBundle(taskId, { fixInstructions })
          .then(result => {
            const activeTask = activeTasks.get(newTaskId);
            if (activeTask) {
              activeTask.status = 'completed';
              activeTask.result = result;

              // Store bundle if successful
              if (result.success && result.bundle) {
                bundleStorage.set(result.bundle.bundle_id, result.bundle);
              }

              // Move to completed
              completedTasks.set(newTaskId, { ...activeTask, completedTime: Date.now() });
              activeTasks.delete(newTaskId);
            }
          })
          .catch(error => {
            logger.error(`Bundle regeneration failed for ${newTaskId}:`, error);
            const activeTask = activeTasks.get(newTaskId);
            if (activeTask) {
              activeTask.status = 'failed';
              activeTask.error = error.message;
              completedTasks.set(newTaskId, { ...activeTask, completedTime: Date.now() });
              activeTasks.delete(newTaskId);
            }
          });

      } catch (error) {
        logger.error(`Bundle regeneration request failed for ${taskId}:`, error);
        return reply.code(500).send({
          success: false,
          error: error.message
        });
      }
    }
  });
}

/**
 * Execute bundle generation asynchronously
 */
async function executeBundleGeneration(taskId, request, eventBus) {
  const task = activeTasks.get(taskId);
  if (!task) return;

  try {
    // Create orchestrator
    const orchestrator = new AgentOrchestrator({ eventBus });
    task.orchestrator = orchestrator;

    // Subscribe to ALL events and broadcast to WebSocket clients
    const eventTypes = [
      'task_start',
      'phase_start',
      'phase_progress',
      'phase_complete',
      'code_analyzing',
      'code_planning',
      'code_generating',
      'code_validating',
      'validation_check_start',
      'validation_check_complete',
      'validation_summary',
      'approval_required',
      'approval_received',
      'plan_modified',
      'task_complete',
      'task_error'
    ];

    eventTypes.forEach(type => {
      eventBus.on(type, (data) => {
        // Broadcast to WebSocket clients
        broadcastToTask(taskId, type, data);

        // Update task state based on events
        if (type === 'phase_start') {
          task.phase = data.phase;
        } else if (type === 'approval_required') {
          task.status = 'awaiting_approval';
        } else if (type === 'approval_received') {
          task.status = 'running';
        }
      });
    });

    // Execute bundle mode
    const result = await orchestrator.executeBundleMode(request);

    logger.info(`Bundle generation completed for ${taskId}:`, {
      success: result.success,
      bundleId: result.bundle?.bundle_id
    });

    // Store bundle if successful
    if (result.success && result.bundle) {
      bundleStorage.set(result.bundle.bundle_id, result.bundle);
    }

    // Update task
    task.status = result.success ? 'completed' : 'failed';
    task.result = result;

    // Move to completed tasks
    completedTasks.set(taskId, { ...task, completedTime: Date.now() });
    activeTasks.delete(taskId);

    // Close WebSocket connections for this task
    closeTaskConnections(taskId, result.success ? 'Task completed' : 'Task failed');

  } catch (error) {
    logger.error(`Bundle generation execution failed for ${taskId}:`, error);
    task.status = 'failed';
    task.error = error.message;
    task.result = { success: false, error: error.message };
    completedTasks.set(taskId, { ...task, completedTime: Date.now() });
    activeTasks.delete(taskId);

    // Broadcast error and close connections
    broadcastToTask(taskId, 'task_error', { error: error.message });
    closeTaskConnections(taskId, 'Task failed');
  }
}

module.exports = bundleRoutes;
