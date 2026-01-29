const TokenBudgetManager = require('./TokenBudgetManager');
const ErrorHandler = require('./ErrorHandler');
const EventBus = require('./EventBus');
const StateManager = require('./StateManager');
const { TaskStatus, PhaseStatus } = StateManager;
const { EventTypes } = EventBus;

/**
 * Agent Orchestrator
 * Coordinates all components for Bundle and Agentic modes
 */
class AgentOrchestrator {
  /**
   * Create a new Agent Orchestrator
   * @param {Object} config - Configuration
   * @param {number} config.tokenBudget - Total token budget (default: 100000)
   * @param {number} config.retryAttempts - Max retry attempts (default: 3)
   * @param {string} config.storePath - Task storage path
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.config = {
      tokenBudget: config.tokenBudget || 100000,
      retryAttempts: config.retryAttempts || 3,
      storePath: config.storePath || './data/tasks',
      logger: config.logger || console,
      ...config
    };

    this.logger = this.config.logger;

    // Initialize components
    this._initializeComponents();

    this.logger.info('AgentOrchestrator initialized', {
      tokenBudget: this.config.tokenBudget,
      retryAttempts: this.config.retryAttempts
    });
  }

  /**
   * Initialize all components
   * @private
   */
  _initializeComponents() {
    // Token Budget Manager
    this.budgetManager = new TokenBudgetManager(this.config.tokenBudget, {
      onWarning: (info) => {
        this.logger.warn('Budget warning:', info);
        this.eventBus.emitEvent(EventTypes.BUDGET_WARNING, {
          percent: info.percentUsed,
          used: info.used,
          total: info.total,
          remaining: info.remaining
        });
      },
      onExceeded: (info) => {
        this.logger.error('Budget exceeded:', info);
        this.eventBus.emitEvent(EventTypes.BUDGET_EXCEEDED, {
          used: info.used,
          total: info.total,
          exceeded: info.exceeded
        });
      }
    });

    // Error Handler
    this.errorHandler = new ErrorHandler({
      maxRetries: this.config.retryAttempts,
      retryDelays: [1000, 2000, 5000],
      logger: this.logger,
      onRetry: (info) => {
        this.logger.info(`Retry attempt ${info.attempt}`, {
          errorType: info.errorType,
          delay: info.delay
        });
      },
      onError: (info) => {
        this.logger.error('Operation failed after retries', {
          attempts: info.attempts,
          error: info.error.message
        });
      }
    });

    // Event Bus
    this.eventBus = new EventBus({
      maxHistory: 1000,
      logger: this.logger
    });

    // State Manager
    this.stateManager = new StateManager({
      storePath: this.config.storePath,
      autoPersist: true,
      logger: this.logger
    });
  }

  /**
   * Execute Bundle Mode
   * Generates a complete code bundle in one go (analyze → plan → generate → validate)
   *
   * @param {Object} request - Request object
   * @param {string} request.message - User's request message
   * @param {Array} request.context - Context files with path and content
   * @param {Array} request.workspaceFiles - List of workspace file paths
   * @returns {Promise<Object>} Result with { success, taskId, bundle, metrics }
   */
  async executeBundleMode(request) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create task
      const task = this.stateManager.createTask(taskId, request.message, {
        context: request.context || [],
        workspaceFiles: request.workspaceFiles || []
      });

      // Emit task start event
      this.eventBus.emitEvent(EventTypes.TASK_START, {
        message: request.message,
        contextFiles: request.context?.length || 0,
        workspaceFiles: request.workspaceFiles?.length || 0
      }, taskId);

      this.logger.info(`Starting Bundle Mode execution for task ${taskId}`);

      // Phase 1: Analyze
      const analysis = await this._executePhase('analyze', taskId, async () => {
        return await this._analyzePhase(request);
      });

      // Phase 2: Plan
      const plan = await this._executePhase('plan', taskId, async () => {
        return await this._planPhase(request, analysis);
      });

      // Phase 3: Generate
      const bundle = await this._executePhase('generate', taskId, async () => {
        return await this._generatePhase(request, plan);
      });

      // Phase 4: Validate
      const validation = await this._executePhase('validate', taskId, async () => {
        return await this._validatePhase(bundle);
      });

      // Mark task as complete
      this.stateManager.updateTask(taskId, {
        status: TaskStatus.COMPLETE,
        bundle,
        metrics: {
          tokensUsed: this.budgetManager.usedTokens,
          totalTime: Date.now() - new Date(task.timestamps.createdAt).getTime(),
          retries: 0 // TODO: track actual retries
        }
      });

      // Emit task complete event
      this.eventBus.emitEvent(EventTypes.TASK_COMPLETE, {
        filesChanged: bundle.files?.length || 0,
        tokensUsed: this.budgetManager.usedTokens,
        validation
      }, taskId);

      this.logger.info(`Bundle Mode execution completed for task ${taskId}`);

      return {
        success: true,
        taskId,
        bundle,
        metrics: {
          tokensUsed: this.budgetManager.usedTokens,
          budgetRemaining: this.budgetManager.getRemaining(),
          totalTime: Date.now() - new Date(task.timestamps.createdAt).getTime()
        }
      };

    } catch (error) {
      this.logger.error(`Bundle Mode execution failed for task ${taskId}:`, error);

      // Update task as failed
      this.stateManager.updateTask(taskId, {
        status: TaskStatus.FAILED,
        error: {
          message: error.message,
          type: error.name,
          stack: error.stack
        }
      });

      // Emit error event
      this.eventBus.emitEvent(EventTypes.TASK_ERROR, {
        error: error.message,
        type: error.name
      }, taskId);

      return {
        success: false,
        taskId,
        error: error.message,
        metrics: {
          tokensUsed: this.budgetManager.usedTokens,
          budgetRemaining: this.budgetManager.getRemaining()
        }
      };
    }
  }

  /**
   * Execute a phase with error handling and state management
   * @param {string} phaseName - Name of the phase (analyze, plan, generate, validate)
   * @param {string} taskId - Task ID
   * @param {Function} phaseFunction - Async function to execute
   * @returns {Promise<any>} Phase result
   * @private
   */
  async _executePhase(phaseName, taskId, phaseFunction) {
    // Update task state to show phase is starting
    this.stateManager.updateTask(taskId, {
      status: this._getTaskStatusForPhase(phaseName),
      phases: {
        [phaseName]: {
          status: PhaseStatus.IN_PROGRESS,
          startedAt: new Date().toISOString()
        }
      }
    });

    // Emit phase start event
    this.eventBus.emitEvent(this._getEventTypeForPhase(phaseName), {
      phase: phaseName,
      status: 'started'
    }, taskId);

    try {
      // Execute with error handling and retry
      const result = await this.errorHandler.withRetry(
        phaseFunction,
        {
          // Recovery strategies
          reduceContext: async (attempt) => {
            this.logger.info(`Reducing context for retry attempt ${attempt}`);
            // TODO: Implement context reduction
          },
          addFeedback: async (errorMessage) => {
            this.logger.info(`Adding feedback: ${errorMessage}`);
            // TODO: Add error feedback to next attempt
          },
          tryAlternative: async (attempt) => {
            this.logger.info(`Trying alternative approach for attempt ${attempt}`);
            // TODO: Try alternative strategy
          },
          increaseTimeout: async () => {
            this.logger.info('Increasing timeout for next attempt');
            // TODO: Increase timeout
          }
        }
      );

      // Update task state to show phase completed
      this.stateManager.updateTask(taskId, {
        phases: {
          [phaseName]: {
            status: PhaseStatus.COMPLETE,
            result,
            completedAt: new Date().toISOString()
          }
        }
      });

      // Emit phase complete event
      this.eventBus.emitEvent(this._getEventTypeForPhase(phaseName), {
        phase: phaseName,
        status: 'completed'
      }, taskId);

      return result;

    } catch (error) {
      // Update task state to show phase failed
      this.stateManager.updateTask(taskId, {
        phases: {
          [phaseName]: {
            status: PhaseStatus.FAILED,
            error: {
              message: error.message,
              type: error.name
            },
            completedAt: new Date().toISOString()
          }
        }
      });

      // Emit phase error event
      this.eventBus.emitEvent(EventTypes.ERROR, {
        phase: phaseName,
        error: error.message
      }, taskId);

      throw error;
    }
  }

  /**
   * Get task status for a phase
   * @param {string} phaseName - Phase name
   * @returns {string} Task status
   * @private
   */
  _getTaskStatusForPhase(phaseName) {
    const statusMap = {
      analyze: TaskStatus.ANALYZING,
      plan: TaskStatus.PLANNING,
      generate: TaskStatus.GENERATING,
      validate: TaskStatus.VALIDATING
    };
    return statusMap[phaseName] || TaskStatus.PENDING;
  }

  /**
   * Get event type for a phase
   * @param {string} phaseName - Phase name
   * @returns {string} Event type
   * @private
   */
  _getEventTypeForPhase(phaseName) {
    const eventMap = {
      analyze: EventTypes.CODE_ANALYZING,
      plan: EventTypes.CODE_PLANNING,
      generate: EventTypes.CODE_GENERATING,
      validate: EventTypes.CODE_VALIDATING
    };
    return eventMap[phaseName] || EventTypes.LOG;
  }

  /**
   * Analyze Phase - Understand the request and codebase
   * @param {Object} request - User request
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async _analyzePhase(request) {
    this.logger.info('Executing analyze phase (placeholder)');

    // TODO: Implement real analysis logic in Day 9
    // For now, return mock data

    return {
      understanding: `Analyzed request: "${request.message}"`,
      requirements: [
        'Understand codebase structure',
        'Identify relevant files',
        'Determine implementation approach'
      ],
      affectedFiles: request.context?.map(c => c.path) || [],
      estimatedComplexity: 'medium',
      tokensUsed: 500
    };
  }

  /**
   * Plan Phase - Create implementation plan
   * @param {Object} request - User request
   * @param {Object} analysis - Analysis result
   * @returns {Promise<Object>} Plan result
   * @private
   */
  async _planPhase(request, analysis) {
    this.logger.info('Executing plan phase (placeholder)');

    // TODO: Implement real planning logic in Day 9
    // For now, return mock data

    return {
      plan_id: `plan_${Date.now()}`,
      title: `Implementation plan for: ${request.message}`,
      complexity: analysis.estimatedComplexity,
      steps: [
        {
          id: 1,
          description: 'Analyze codebase structure',
          type: 'analyze',
          files: analysis.affectedFiles
        },
        {
          id: 2,
          description: 'Generate code changes',
          type: 'generate',
          files: analysis.affectedFiles
        }
      ],
      files_to_change: analysis.affectedFiles,
      estimated_minutes: 15,
      risks: [],
      dependencies: null,
      migrations: null,
      tokensUsed: 1000
    };
  }

  /**
   * Generate Phase - Generate code changes
   * @param {Object} request - User request
   * @param {Object} plan - Plan result
   * @returns {Promise<Object>} Generated bundle
   * @private
   */
  async _generatePhase(request, plan) {
    this.logger.info('Executing generate phase (placeholder)');

    // TODO: Implement real code generation in Day 10
    // For now, return mock data

    return {
      title: plan.title,
      files: plan.files_to_change.map((filePath, idx) => ({
        path: filePath,
        action: 'modify',
        diff: `// Mock diff for ${filePath}\n+ Added new functionality\n- Removed old code`,
        content: `// Mock generated content for ${filePath}`
      })),
      filesCreated: 0,
      filesModified: plan.files_to_change.length,
      filesDeleted: 0,
      summary: `Generated code changes for: ${request.message}`,
      tokensUsed: 3000
    };
  }

  /**
   * Validate Phase - Validate generated code
   * @param {Object} bundle - Generated bundle
   * @returns {Promise<Object>} Validation result
   * @private
   */
  async _validatePhase(bundle) {
    this.logger.info('Executing validate phase (placeholder)');

    // TODO: Implement real validation in Day 10
    // For now, return mock data

    return {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      tokensUsed: 500
    };
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Object|null} Task or null
   */
  getTask(taskId) {
    return this.stateManager.getTask(taskId);
  }

  /**
   * Get budget report
   * @returns {Object} Budget report
   */
  getBudgetReport() {
    return this.budgetManager.getReport();
  }

  /**
   * Get event history
   * @param {string} since - ISO timestamp (optional)
   * @returns {Array} Event history
   */
  getEventHistory(since = null) {
    return this.eventBus.getHistory(since);
  }

  /**
   * Subscribe to events via WebSocket
   * @param {string} clientId - Client ID
   * @param {WebSocket} websocket - WebSocket connection
   */
  subscribeToEvents(clientId, websocket) {
    this.eventBus.subscribe(clientId, websocket);
  }
}

module.exports = AgentOrchestrator;
