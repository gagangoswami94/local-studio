const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Task status values
 */
const TaskStatus = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  PLANNING: 'planning',
  GENERATING: 'generating',
  VALIDATING: 'validating',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

/**
 * Phase status values
 */
const PhaseStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

/**
 * State Manager for task persistence and recovery
 * Manages task state in-memory with disk backup for crash recovery
 */
class StateManager {
  /**
   * Create a new State Manager
   * @param {Object} options - Configuration options
   * @param {string} options.storePath - Directory path for persistent storage (default: data/tasks)
   * @param {boolean} options.autoPersist - Auto-persist on status changes (default: true)
   * @param {Object} options.logger - Logger instance (default: console)
   */
  constructor(options = {}) {
    this.storePath = options.storePath || path.join(__dirname, '../../data/tasks');
    this.autoPersist = options.autoPersist !== false; // default true
    this.logger = options.logger || console;

    // In-memory cache: Map<taskId, taskState>
    this.tasks = new Map();

    // Ensure storage directory exists
    this._ensureStorageDir();
  }

  /**
   * Create a new task
   * @param {string} taskId - Unique task identifier
   * @param {string} request - User request/prompt
   * @param {Object} context - Context data (files, workspace info, etc.)
   * @returns {Object} Created task state
   */
  createTask(taskId, request, context = {}) {
    const now = new Date().toISOString();

    const task = {
      id: taskId,
      status: TaskStatus.PENDING,
      request,
      context,

      // Phase tracking
      phases: {
        analyze: {
          status: PhaseStatus.PENDING,
          result: null,
          error: null,
          startedAt: null,
          completedAt: null
        },
        plan: {
          status: PhaseStatus.PENDING,
          result: null,
          error: null,
          startedAt: null,
          completedAt: null
        },
        generate: {
          status: PhaseStatus.PENDING,
          result: null,
          error: null,
          startedAt: null,
          completedAt: null
        },
        validate: {
          status: PhaseStatus.PENDING,
          result: null,
          error: null,
          startedAt: null,
          completedAt: null
        }
      },

      // Final results
      bundle: null,
      error: null,

      // Metrics
      metrics: {
        tokensUsed: 0,
        totalTime: 0,
        retries: 0
      },

      // Timestamps
      timestamps: {
        createdAt: now,
        updatedAt: now
      }
    };

    // Store in memory
    this.tasks.set(taskId, task);

    // Persist to disk
    if (this.autoPersist) {
      this.persist(taskId).catch(err => {
        this.logger.error(`Failed to persist task ${taskId}:`, err);
      });
    }

    this.logger.info(`Task ${taskId} created`);
    return task;
  }

  /**
   * Update task state
   * @param {string} taskId - Task ID to update
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated task state
   * @throws {Error} If task not found
   */
  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Apply updates (deep merge for nested objects)
    if (updates.status !== undefined) {
      task.status = updates.status;
    }

    if (updates.phases) {
      Object.keys(updates.phases).forEach(phaseName => {
        if (task.phases[phaseName]) {
          Object.assign(task.phases[phaseName], updates.phases[phaseName]);
        }
      });
    }

    if (updates.bundle !== undefined) {
      task.bundle = updates.bundle;
    }

    if (updates.error !== undefined) {
      task.error = updates.error;
    }

    if (updates.metrics) {
      Object.assign(task.metrics, updates.metrics);
    }

    // Update timestamp
    task.timestamps.updatedAt = new Date().toISOString();

    // Store updated task
    this.tasks.set(taskId, task);

    // Auto-persist on status changes
    if (this.autoPersist && updates.status !== undefined) {
      this.persist(taskId).catch(err => {
        this.logger.error(`Failed to persist task ${taskId}:`, err);
      });
    }

    return task;
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID to retrieve
   * @returns {Object|null} Task state or null if not found
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Persist task to disk
   * @param {string} taskId - Task ID to persist
   * @returns {Promise<void>}
   * @throws {Error} If task not found
   */
  async persist(taskId) {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const filePath = path.join(this.storePath, `${taskId}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(task, null, 2), 'utf8');
      this.logger.debug(`Task ${taskId} persisted to disk`);
    } catch (error) {
      this.logger.error(`Failed to persist task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Recover task from disk
   * @param {string} taskId - Task ID to recover
   * @returns {Promise<Object>} Recovered task state
   * @throws {Error} If task file not found or invalid
   */
  async recover(taskId) {
    const filePath = path.join(this.storePath, `${taskId}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf8');
      const task = JSON.parse(data);

      // Load into memory cache
      this.tasks.set(taskId, task);

      this.logger.info(`Task ${taskId} recovered from disk`);
      return task;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Task ${taskId} not found on disk`);
      }
      this.logger.error(`Failed to recover task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * List recent tasks
   * @param {number} limit - Maximum number of tasks to return (default: 50)
   * @returns {Promise<Array<Object>>} Array of task states, sorted by updatedAt (newest first)
   */
  async listTasks(limit = 50) {
    // Get all tasks from disk
    try {
      const files = await fs.readdir(this.storePath);
      const taskFiles = files.filter(f => f.endsWith('.json'));

      const tasks = await Promise.all(
        taskFiles.map(async (file) => {
          try {
            const filePath = path.join(this.storePath, file);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
          } catch (error) {
            this.logger.warn(`Failed to read task file ${file}:`, error);
            return null;
          }
        })
      );

      // Filter out nulls and sort by updatedAt
      const validTasks = tasks
        .filter(t => t !== null)
        .sort((a, b) => {
          const aTime = new Date(a.timestamps.updatedAt).getTime();
          const bTime = new Date(b.timestamps.updatedAt).getTime();
          return bTime - aTime; // Newest first
        });

      // Return limited results
      return validTasks.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to list tasks:', error);
      return [];
    }
  }

  /**
   * Clean up old tasks
   * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
   * @returns {Promise<number>} Number of tasks removed
   */
  async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let removed = 0;

    try {
      const files = await fs.readdir(this.storePath);
      const taskFiles = files.filter(f => f.endsWith('.json'));

      for (const file of taskFiles) {
        try {
          const filePath = path.join(this.storePath, file);
          const data = await fs.readFile(filePath, 'utf8');
          const task = JSON.parse(data);

          const updatedAt = new Date(task.timestamps.updatedAt).getTime();
          const age = now - updatedAt;

          if (age > maxAge) {
            // Remove from disk
            await fs.unlink(filePath);

            // Remove from memory cache
            this.tasks.delete(task.id);

            removed++;
            this.logger.debug(`Removed old task ${task.id} (age: ${Math.floor(age / 86400000)} days)`);
          }
        } catch (error) {
          this.logger.warn(`Failed to process task file ${file}:`, error);
        }
      }

      this.logger.info(`Cleanup complete: removed ${removed} old tasks`);
      return removed;
    } catch (error) {
      this.logger.error('Failed to cleanup tasks:', error);
      return 0;
    }
  }

  /**
   * Delete a specific task
   * @param {string} taskId - Task ID to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteTask(taskId) {
    try {
      const filePath = path.join(this.storePath, `${taskId}.json`);

      // Remove from disk
      await fs.unlink(filePath);

      // Remove from memory
      this.tasks.delete(taskId);

      this.logger.info(`Task ${taskId} deleted`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`Task ${taskId} not found for deletion`);
        return false;
      }
      this.logger.error(`Failed to delete task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get task statistics
   * @returns {Object} Statistics about tasks
   */
  getStats() {
    const tasks = Array.from(this.tasks.values());

    return {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
        analyzing: tasks.filter(t => t.status === TaskStatus.ANALYZING).length,
        planning: tasks.filter(t => t.status === TaskStatus.PLANNING).length,
        generating: tasks.filter(t => t.status === TaskStatus.GENERATING).length,
        validating: tasks.filter(t => t.status === TaskStatus.VALIDATING).length,
        complete: tasks.filter(t => t.status === TaskStatus.COMPLETE).length,
        failed: tasks.filter(t => t.status === TaskStatus.FAILED).length
      },
      avgTokensUsed: tasks.length > 0
        ? tasks.reduce((sum, t) => sum + t.metrics.tokensUsed, 0) / tasks.length
        : 0,
      avgTime: tasks.length > 0
        ? tasks.reduce((sum, t) => sum + t.metrics.totalTime, 0) / tasks.length
        : 0
    };
  }

  /**
   * Ensure storage directory exists (synchronous for constructor)
   * @private
   */
  _ensureStorageDir() {
    try {
      fsSync.mkdirSync(this.storePath, { recursive: true });
      this.logger.debug(`Storage directory ready: ${this.storePath}`);
    } catch (error) {
      this.logger.error(`Failed to create storage directory:`, error);
    }
  }

  /**
   * Get task status constants
   * @static
   */
  static get TaskStatus() {
    return TaskStatus;
  }

  /**
   * Get phase status constants
   * @static
   */
  static get PhaseStatus() {
    return PhaseStatus;
  }
}

module.exports = StateManager;
module.exports.TaskStatus = TaskStatus;
module.exports.PhaseStatus = PhaseStatus;
