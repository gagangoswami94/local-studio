const TokenBudgetManager = require('./TokenBudgetManager');
const ErrorHandler = require('./ErrorHandler');
const EventBus = require('./EventBus');
const StateManager = require('./StateManager');
const AgenticRunner = require('./AgenticRunner');
const BundleBuilder = require('./BundleBuilder');
const ReleaseGate = require('./validation/ReleaseGate');
const BundleSigner = require('../security/BundleSigner');
const { TaskStatus, PhaseStatus} = StateManager;
const { EventTypes } = EventBus;
const {
  SubAgentCoordinator,
  CodeGenSubAgent,
  TestGenSubAgent,
  MigrationSubAgent
} = require('./subagents');

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
    this._initialized = false;

    // Initialize components (synchronous parts only)
    this._initializeComponents();

    this.logger.info('AgentOrchestrator initialized', {
      tokenBudget: this.config.tokenBudget,
      retryAttempts: this.config.retryAttempts
    });
  }

  /**
   * Initialize async components (call this before first use)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    // Initialize BundleSigner (async - generates/loads keys)
    await this.bundleSigner.initialize();

    this._initialized = true;
    this.logger.info('AgentOrchestrator async initialization complete');
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

    // Bundle Builder
    this.bundleBuilder = new BundleBuilder({
      logger: this.logger
    });

    // Release Gate (validation)
    this.releaseGate = new ReleaseGate({
      logger: this.logger,
      coverageThreshold: this.config.coverageThreshold || 80
    });

    // Bundle Signer
    this.bundleSigner = new BundleSigner({
      logger: this.logger,
      keysPath: this.config.keysPath || './keys'
    });

    // Sub-Agent Coordinator
    this.subAgentCoordinator = new SubAgentCoordinator(this, {
      stopOnFailure: false,
      stopOnError: true
    });

    // Register sub-agents
    this.subAgentCoordinator.registerAgent(
      'CodeGenSubAgent',
      new CodeGenSubAgent(this, {
        tokenBudget: this.config.codeGenBudget || 50000,
        model: this.config.model || 'claude-3-5-sonnet-20241022'
      })
    );

    this.subAgentCoordinator.registerAgent(
      'TestGenSubAgent',
      new TestGenSubAgent(this, {
        tokenBudget: this.config.testGenBudget || 30000,
        model: this.config.model || 'claude-3-5-sonnet-20241022'
      })
    );

    this.subAgentCoordinator.registerAgent(
      'MigrationSubAgent',
      new MigrationSubAgent(this, {
        tokenBudget: this.config.migrationBudget || 20000,
        model: this.config.model || 'claude-3-5-sonnet-20241022'
      })
    );

    // Forward sub-agent progress events
    this.subAgentCoordinator.on('agent_progress', (data) => {
      this.eventBus.emitEvent(EventTypes.LOG, {
        agent: data.agent,
        type: data.type,
        message: `Agent progress: ${data.type}`,
        data
      });
    });

    this.subAgentCoordinator.on('step_complete', (data) => {
      this.eventBus.emitEvent(EventTypes.LOG, {
        message: `Step ${data.stepId} completed by ${data.agent}`,
        duration: data.duration
      });
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
   * @param {Object} request.appSpec - Application specification (optional)
   * @param {boolean} request.requireApproval - Require approval for high-risk plans (default: true)
   * @returns {Promise<Object>} Result with { success, taskId, bundle, metrics }
   */
  async executeBundleMode(request) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskStartTime = Date.now();
    const metrics = {
      tokensUsed: { analyze: 0, plan: 0, generate: 0, validate: 0, total: 0 },
      timeMs: { analyze: 0, plan: 0, generate: 0, validate: 0, total: 0 },
      estimatedCost: 0
    };

    try {
      // Ensure async initialization is complete
      await this.initialize();

      // Create task
      const task = this.stateManager.createTask(taskId, request.message, {
        mode: 'bundle',
        context: request.context || [],
        workspaceFiles: request.workspaceFiles || [],
        appSpec: request.appSpec || null,
        requireApproval: request.requireApproval !== false
      });

      // Emit task start event
      this.eventBus.emitEvent(EventTypes.TASK_START, {
        mode: 'bundle',
        message: request.message,
        contextFiles: request.context?.length || 0,
        workspaceFiles: request.workspaceFiles?.length || 0
      }, taskId);

      this.logger.info(`[Bundle Mode] Starting execution for task ${taskId}`);

      // ===== Phase 1: Analyze =====
      this.logger.info(`[Bundle Mode] Phase 1/4: Analyze`);
      const analyzeStart = Date.now();
      const tokensBefore = this.budgetManager.usedTokens;

      const analysis = await this._executePhase('analyze', taskId, async () => {
        return await this._analyzePhase(request);
      });

      metrics.timeMs.analyze = Date.now() - analyzeStart;
      metrics.tokensUsed.analyze = this.budgetManager.usedTokens - tokensBefore;

      this.logger.info(`[Bundle Mode] Analyze complete: ${metrics.timeMs.analyze}ms, ${metrics.tokensUsed.analyze} tokens`);

      // ===== Phase 2: Plan =====
      this.logger.info(`[Bundle Mode] Phase 2/4: Plan`);
      const planStart = Date.now();
      const tokensBeforePlan = this.budgetManager.usedTokens;

      const plan = await this._executePhase('plan', taskId, async () => {
        return await this._planPhase(request, analysis);
      });

      metrics.timeMs.plan = Date.now() - planStart;
      metrics.tokensUsed.plan = this.budgetManager.usedTokens - tokensBeforePlan;

      this.logger.info(`[Bundle Mode] Plan complete: ${metrics.timeMs.plan}ms, ${metrics.tokensUsed.plan} tokens`);

      // ===== Approval Checkpoint =====
      if (request.requireApproval !== false) {
        const riskAssessment = this._assessPlanRisks(plan);

        if (riskAssessment.requiresApproval) {
          this.logger.info(`[Bundle Mode] Plan requires approval: ${riskAssessment.level} risk`);

          // Emit approval required event
          this.eventBus.emitEvent(EventTypes.APPROVAL_REQUIRED, {
            taskId,
            plan,
            riskAssessment,
            estimatedTime: plan.estimated_minutes || 'unknown',
            filesAffected: plan.files_to_change?.length || 0,
            migrations: plan.migrations?.length || 0
          }, taskId);

          // Wait for approval (timeout: 5 minutes)
          const approval = await this._waitForApproval(taskId, {
            timeout: 300000,
            plan,
            riskAssessment
          });

          if (!approval.approved) {
            this.logger.warn(`[Bundle Mode] Plan rejected by user`);

            // Mark task as cancelled
            this.stateManager.updateTask(taskId, {
              status: TaskStatus.FAILED,
              error: {
                message: 'Plan rejected by user',
                phase: 'plan',
                recoverable: true
              }
            });

            return this._buildErrorResponse(taskId, {
              message: 'Plan rejected by user',
              phase: 'plan',
              recoverable: true,
              reason: approval.reason
            }, metrics, taskStartTime);
          }

          // Use modified plan if provided
          if (approval.modifiedPlan) {
            this.logger.info(`[Bundle Mode] Using modified plan`);
            Object.assign(plan, approval.modifiedPlan);

            this.eventBus.emitEvent(EventTypes.PLAN_MODIFIED, {
              taskId,
              modifications: approval.modifications
            }, taskId);
          }

          this.eventBus.emitEvent(EventTypes.APPROVAL_RECEIVED, {
            taskId,
            approved: true
          }, taskId);
        }
      }

      // ===== Phase 3: Generate =====
      this.logger.info(`[Bundle Mode] Phase 3/4: Generate`);
      const generateStart = Date.now();
      const tokensBeforeGenerate = this.budgetManager.usedTokens;

      const bundle = await this._executePhase('generate', taskId, async () => {
        return await this._generatePhase(request, plan);
      });

      metrics.timeMs.generate = Date.now() - generateStart;
      metrics.tokensUsed.generate = this.budgetManager.usedTokens - tokensBeforeGenerate;

      this.logger.info(`[Bundle Mode] Generate complete: ${metrics.timeMs.generate}ms, ${metrics.tokensUsed.generate} tokens`);
      this.logger.info(`[Bundle Mode] Generated: ${bundle.files.length} files, ${bundle.tests.length} tests, ${bundle.migrations.length} migrations`);

      // ===== Phase 4: Validate =====
      this.logger.info(`[Bundle Mode] Phase 4/4: Validate`);
      const validateStart = Date.now();

      const validation = await this._executePhase('validate', taskId, async () => {
        return await this._validatePhase(bundle, taskId);
      });

      metrics.timeMs.validate = Date.now() - validateStart;
      metrics.tokensUsed.validate = 0; // Validation doesn't use tokens

      this.logger.info(`[Bundle Mode] Validate complete: ${metrics.timeMs.validate}ms`);

      // ===== Check Validation Result =====
      if (!validation.passed) {
        this.logger.error(`[Bundle Mode] Validation failed with ${validation.blockers.length} blocker(s)`);

        // Mark task as failed
        this.stateManager.updateTask(taskId, {
          status: TaskStatus.FAILED,
          bundle,
          validation,
          error: {
            message: 'Bundle failed validation checks',
            phase: 'validate',
            recoverable: true,
            blockers: validation.blockers,
            warnings: validation.warnings
          }
        });

        // Emit validation failure event
        this.eventBus.emitEvent(EventTypes.TASK_ERROR, {
          error: 'Bundle validation failed',
          phase: 'validate',
          recoverable: true,
          blockers: validation.blockers.length,
          warnings: validation.warnings.length,
          summary: validation.summary
        }, taskId);

        // Calculate final metrics
        metrics.timeMs.total = Date.now() - taskStartTime;
        metrics.tokensUsed.total = this.budgetManager.usedTokens;
        metrics.estimatedCost = this._calculateCost(metrics.tokensUsed.total);

        return {
          success: false,
          taskId,
          mode: 'bundle',
          error: {
            message: 'Bundle failed validation checks',
            phase: 'validate',
            recoverable: true
          },
          bundle,
          validation,
          metrics
        };
      }

      // ===== Success! =====
      const signedBundle = validation.signedBundle;

      // Calculate final metrics
      metrics.timeMs.total = Date.now() - taskStartTime;
      metrics.tokensUsed.total = this.budgetManager.usedTokens;
      metrics.estimatedCost = this._calculateCost(metrics.tokensUsed.total);

      // Mark task as complete
      this.stateManager.updateTask(taskId, {
        status: TaskStatus.COMPLETE,
        bundle: signedBundle,
        validation,
        metrics
      });

      // Emit task complete event
      this.eventBus.emitEvent(EventTypes.TASK_COMPLETE, {
        mode: 'bundle',
        filesChanged: signedBundle.files?.length || 0,
        testsGenerated: signedBundle.tests?.length || 0,
        migrationsGenerated: signedBundle.migrations?.length || 0,
        tokensUsed: metrics.tokensUsed.total,
        timeMs: metrics.timeMs.total,
        signed: true
      }, taskId);

      this.logger.info(`[Bundle Mode] Execution completed for task ${taskId}`);
      this.logger.info(`[Bundle Mode] Total: ${metrics.timeMs.total}ms, ${metrics.tokensUsed.total} tokens, ~$${metrics.estimatedCost.toFixed(4)}`);

      return {
        success: true,
        taskId,
        mode: 'bundle',
        bundle: signedBundle,
        validation,
        metrics,
        error: null
      };

    } catch (error) {
      this.logger.error(`[Bundle Mode] Execution failed for task ${taskId}:`, error);

      // Determine which phase failed
      const task = this.stateManager.getTask(taskId);
      const failedPhase = this._determineFailedPhase(task);

      // Update task as failed
      this.stateManager.updateTask(taskId, {
        status: TaskStatus.FAILED,
        error: {
          message: error.message,
          type: error.name,
          phase: failedPhase,
          recoverable: this._isRecoverableError(error),
          stack: error.stack
        }
      });

      // Emit error event
      this.eventBus.emitEvent(EventTypes.TASK_ERROR, {
        error: error.message,
        type: error.name,
        phase: failedPhase,
        recoverable: this._isRecoverableError(error)
      }, taskId);

      // Calculate final metrics
      metrics.timeMs.total = Date.now() - taskStartTime;
      metrics.tokensUsed.total = this.budgetManager.usedTokens;
      metrics.estimatedCost = this._calculateCost(metrics.tokensUsed.total);

      return this._buildErrorResponse(taskId, {
        message: error.message,
        type: error.name,
        phase: failedPhase,
        recoverable: this._isRecoverableError(error)
      }, metrics, taskStartTime);
    }
  }

  /**
   * Execute Agentic Mode
   * Interactive agent that uses tools to complete tasks step-by-step
   *
   * @param {Object} request - Request object
   * @param {string} request.message - User's request message
   * @param {Array} request.context - Context files with path and content
   * @param {string} request.workspacePath - Path to workspace
   * @returns {Promise<Object>} Result with { success, taskId, response, iterations, metrics }
   */
  async executeAgenticMode(request) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create task
      const task = this.stateManager.createTask(taskId, request.message, {
        mode: 'agentic',
        context: request.context || [],
        workspacePath: request.workspacePath
      });

      // Emit task start event
      this.eventBus.emitEvent(EventTypes.AGENT_START, {
        message: request.message,
        contextFiles: request.context?.length || 0,
        mode: 'agentic'
      }, taskId);

      this.logger.info(`Starting Agentic Mode execution for task ${taskId}`);

      // Create agentic runner
      const runner = new AgenticRunner({
        apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
        model: this.config.model || 'claude-sonnet-4-5-20250929',
        maxIterations: this.config.maxAgenticIterations || 25,
        warningThreshold: this.config.agenticWarningThreshold || 20,
        approvalTimeout: this.config.approvalTimeout || 300000,
        logger: this.logger,
        eventBus: this.eventBus,
        tokenBudget: this.budgetManager,
        errorHandler: this.errorHandler
      });

      // Build context for runner
      const context = {
        workspacePath: request.workspacePath,
        contextFiles: request.context || [],
        taskId,
        logger: this.logger,
        eventBus: this.eventBus
      };

      // Run agentic execution
      const result = await runner.run(request.message, context);

      // Mark task as complete or failed
      if (result.success) {
        this.stateManager.updateTask(taskId, {
          status: TaskStatus.COMPLETE,
          result: {
            response: result.response,
            iterations: result.iterations
          },
          metrics: {
            tokensUsed: this.budgetManager.usedTokens,
            iterations: result.iterations,
            totalTime: Date.now() - new Date(task.timestamps.createdAt).getTime()
          }
        });

        // Emit task complete event
        this.eventBus.emitEvent(EventTypes.AGENT_COMPLETE, {
          iterations: result.iterations,
          tokensUsed: this.budgetManager.usedTokens
        }, taskId);

        this.logger.info(`Agentic Mode execution completed for task ${taskId}`);
      } else {
        this.stateManager.updateTask(taskId, {
          status: TaskStatus.FAILED,
          result: {
            response: result.response,
            iterations: result.iterations
          }
        });
      }

      return {
        success: result.success,
        taskId,
        response: result.response,
        iterations: result.iterations,
        metrics: {
          tokensUsed: this.budgetManager.usedTokens,
          budgetRemaining: this.budgetManager.getRemaining(),
          totalTime: Date.now() - new Date(task.timestamps.createdAt).getTime()
        }
      };

    } catch (error) {
      this.logger.error(`Agentic Mode execution failed for task ${taskId}:`, error);

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
      this.eventBus.emitEvent(EventTypes.AGENT_ERROR, {
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
    const startTime = Date.now();
    this.logger.info('Executing generate phase with Sub-Agent Coordinator');

    // Reserve tokens from budget for generation (default 60000)
    const generateBudget = this.config.generateBudget || 60000;
    const budgetAvailable = this.budgetManager.getRemaining();

    if (budgetAvailable < generateBudget * 0.5) {
      this.logger.warn('Low token budget for generation phase', {
        available: budgetAvailable,
        recommended: generateBudget
      });
    }

    // Prepare context for sub-agents
    const context = this._prepareGenerationContext(request, plan);

    // Execute code generation steps
    const { codeFiles, codeSteps } = await this._executeCodeGeneration(plan, context);

    // Generate tests for new code
    const tests = await this._generateTests(codeFiles, context);

    // Generate migrations if needed
    const migrations = await this._generateMigrations(plan, context);

    // Get total tokens used
    const tokensUsed = this.subAgentCoordinator.getTotalUsage().total;

    // Update budget manager
    if (tokensUsed > 0) {
      this.budgetManager.recordUsage(tokensUsed);
    }

    // Compile into bundle using BundleBuilder
    const generationTime = Date.now() - startTime;
    const bundle = this.bundleBuilder.compileBundle(
      codeFiles,
      tests,
      migrations,
      request.appSpec || null,
      plan,
      {
        tokensUsed,
        generationTime,
        codeStepsExecuted: codeSteps.length,
        testFramework: context.patterns?.testingFrameworks?.[0]?.name || 'vitest',
        database: context.patterns?.databases?.[0]?.name || null
      }
    );

    // Validate bundle
    const validation = this.bundleBuilder.validateBundle(bundle);
    if (!validation.valid) {
      this.logger.warn('Bundle validation warnings', {
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    this.logger.info('Generate phase completed', {
      files: bundle.files.length,
      tests: bundle.tests.length,
      migrations: bundle.migrations.length,
      tokensUsed,
      generationTime: `${generationTime}ms`
    });

    return bundle;
  }

  /**
   * Prepare context for generation
   * @param {Object} request - User request
   * @param {Object} plan - Implementation plan
   * @returns {Object} Generation context
   * @private
   */
  _prepareGenerationContext(request, plan) {
    return {
      patterns: plan.patterns || {},
      existingFiles: request.context || [],
      workspacePath: request.workspacePath || null,
      packageJson: request.packageJson || null,
      appSpec: request.appSpec || null,
      testPathPattern: plan.testPathPattern || null
    };
  }

  /**
   * Execute code generation steps
   * @param {Object} plan - Implementation plan
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} { codeFiles, codeSteps }
   * @private
   */
  async _executeCodeGeneration(plan, context) {
    // Filter out test and migration steps (those will be generated separately)
    const codeSteps = (plan.steps || []).filter(step =>
      step.layer !== 'test' && !step.target?.includes('migration')
    );

    if (codeSteps.length === 0) {
      this.logger.info('No code generation steps in plan');
      return { codeFiles: [], codeSteps: [] };
    }

    this.logger.info(`Executing ${codeSteps.length} code generation steps`);

    try {
      // Execute steps using Sub-Agent Coordinator
      const result = await this.subAgentCoordinator.executeSteps(codeSteps, context);

      // Transform results to file format
      const codeFiles = [];

      for (const stepResult of result.results) {
        if (stepResult.success && stepResult.result) {
          const { step, result: stepData } = stepResult;

          codeFiles.push({
            path: step.target,
            action: step.action || 'create',
            content: stepData.content || stepData.code || '',
            layer: step.layer,
            description: step.description
          });
        } else if (!stepResult.success) {
          this.logger.warn(`Code generation step ${stepResult.step.id} failed: ${stepResult.error}`);
        }
      }

      return { codeFiles, codeSteps };
    } catch (error) {
      this.logger.error('Code generation execution failed:', error);
      throw error;
    }
  }

  /**
   * Generate tests for new code
   * @param {Array} codeFiles - Generated code files
   * @param {Object} context - Generation context
   * @returns {Promise<Array>} Generated tests
   * @private
   */
  async _generateTests(codeFiles, context) {
    // Only generate tests for code files (not configs, styles, etc.)
    const codeFilesToTest = codeFiles.filter(file =>
      this._shouldGenerateTest(file.path)
    );

    if (codeFilesToTest.length === 0) {
      this.logger.info('No files require test generation');
      return [];
    }

    this.logger.info(`Generating tests for ${codeFilesToTest.length} files`);

    const tests = [];

    try {
      // Get TestGen agent
      const testGenAgent = this.subAgentCoordinator.agents.get('TestGenSubAgent');

      if (!testGenAgent) {
        this.logger.warn('TestGen agent not available, skipping test generation');
        return [];
      }

      // Generate test for each code file
      for (const file of codeFilesToTest) {
        try {
          const testStep = {
            id: `test_${file.path}`,
            action: 'create',
            target: this._getTestFilePath(file.path, context),
            description: `Generate tests for ${file.path}`,
            layer: 'test'
          };

          const testContext = {
            ...context,
            sourceCode: file.content,
            sourceFile: file.path
          };

          const result = await testGenAgent.execute(testStep, testContext);

          if (result.success) {
            tests.push({
              path: result.testFile || testStep.target,
              content: result.content || result.code || '',
              sourceFile: file.path,
              framework: result.framework || 'vitest',
              coverage: result.coverage || null
            });
          }
        } catch (error) {
          this.logger.warn(`Test generation failed for ${file.path}:`, error.message);
        }
      }

      this.logger.info(`Generated ${tests.length} test files`);
      return tests;
    } catch (error) {
      this.logger.error('Test generation failed:', error);
      return [];
    }
  }

  /**
   * Generate migrations if needed
   * @param {Object} plan - Implementation plan
   * @param {Object} context - Generation context
   * @returns {Promise<Array>} Generated migrations
   * @private
   */
  async _generateMigrations(plan, context) {
    // Check if plan includes migration steps
    const migrationSteps = (plan.steps || []).filter(step =>
      step.layer === 'database' || step.target?.includes('migration')
    );

    if (migrationSteps.length === 0) {
      this.logger.info('No migrations needed');
      return [];
    }

    this.logger.info(`Generating ${migrationSteps.length} migrations`);

    const migrations = [];

    try {
      // Get Migration agent
      const migrationAgent = this.subAgentCoordinator.agents.get('MigrationSubAgent');

      if (!migrationAgent) {
        this.logger.warn('Migration agent not available, skipping migration generation');
        return [];
      }

      // Generate each migration
      for (const step of migrationSteps) {
        try {
          const result = await migrationAgent.execute(step, context);

          if (result.success) {
            migrations.push({
              migrationId: result.migrationId,
              description: result.description,
              sql_forward: result.sql_forward,
              sql_reverse: result.sql_reverse,
              dataLossRisk: result.dataLossRisk,
              database: result.database
            });
          }
        } catch (error) {
          this.logger.warn(`Migration generation failed for ${step.id}:`, error.message);
        }
      }

      this.logger.info(`Generated ${migrations.length} migrations`);
      return migrations;
    } catch (error) {
      this.logger.error('Migration generation failed:', error);
      return [];
    }
  }

  /**
   * Check if file should have tests generated
   * @param {string} filePath - File path
   * @returns {boolean} Should generate test
   * @private
   */
  _shouldGenerateTest(filePath) {
    // Generate tests for code files, not configs or styles
    const ext = filePath.split('.').pop();
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'java'];

    if (!codeExtensions.includes(ext)) {
      return false;
    }

    // Don't test test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return false;
    }

    // Don't test config files
    const configPatterns = ['config', 'setup', '.config.', 'webpack', 'vite', 'jest'];
    if (configPatterns.some(pattern => filePath.includes(pattern))) {
      return false;
    }

    return true;
  }

  /**
   * Get test file path for source file
   * @param {string} sourceFile - Source file path
   * @param {Object} context - Generation context
   * @returns {string} Test file path
   * @private
   */
  _getTestFilePath(sourceFile, context) {
    const path = require('path');

    // Use custom pattern if provided
    if (context.testPathPattern) {
      return context.testPathPattern.replace('{file}', sourceFile);
    }

    // Default: __tests__ directory with .test extension
    const parsed = path.parse(sourceFile);
    const testFileName = `${parsed.name}.test${parsed.ext}`;

    return path.join(parsed.dir, '__tests__', testFileName);
  }

  /**
   * Validate Phase - Validate generated code
   * @param {Object} bundle - Generated bundle
   * @param {string} taskId - Task ID for event correlation
   * @returns {Promise<Object>} Validation result
   * @private
   */
  async _validatePhase(bundle, taskId = null) {
    const startTime = Date.now();
    this.logger.info('[Validate Phase] Running Release Gate validation checks');

    // Emit validation start event
    this.eventBus.emitEvent(EventTypes.CODE_VALIDATING, {
      phase: 'validate',
      status: 'started',
      totalChecks: this.releaseGate.getChecks().length
    }, taskId);

    // Run all Release Gate validation checks (with progress events)
    const gateResult = await this.releaseGate.runAll(bundle, {
      eventBus: this.eventBus,
      taskId
    });

    const duration = Date.now() - startTime;

    // Log summary
    if (gateResult.passed) {
      this.logger.info('[Validate Phase] All validation checks passed', {
        checks: gateResult.report.passedChecks,
        warnings: gateResult.warnings.length,
        duration: `${duration}ms`
      });

      // Emit validation summary
      this.eventBus.emitEvent('validation_summary', {
        passed: true,
        checks: gateResult.report.passedChecks,
        warnings: gateResult.warnings.length,
        duration
      }, taskId);

      // Sign the bundle after successful validation
      this.logger.info('[Validate Phase] Signing bundle...');
      const signedBundle = this.bundleSigner.signBundle(bundle);

      return {
        valid: true,
        passed: true,
        signedBundle,
        report: gateResult.report,
        warnings: gateResult.warnings,
        blockers: [],
        duration,
        tokensUsed: 0 // Release Gate doesn't use LLM tokens
      };
    } else {
      this.logger.error('[Validate Phase] Validation failed with blockers', {
        blockers: gateResult.blockers.length,
        warnings: gateResult.warnings.length,
        duration: `${duration}ms`
      });

      // Generate human-readable summary
      const summary = this.releaseGate.generateSummary(gateResult);

      // Generate fix suggestions
      const suggestions = this._generateFixSuggestions(gateResult.blockers);

      // Emit validation summary
      this.eventBus.emitEvent('validation_summary', {
        passed: false,
        checks: gateResult.report.passedChecks,
        blockers: gateResult.blockers.length,
        warnings: gateResult.warnings.length,
        duration,
        suggestions
      }, taskId);

      return {
        valid: false,
        passed: false,
        signedBundle: null,
        report: gateResult.report,
        blockers: gateResult.blockers,
        warnings: gateResult.warnings,
        suggestions,
        summary,
        duration,
        tokensUsed: 0
      };
    }
  }

  /**
   * Generate fix suggestions based on validation blockers
   * @param {Array} blockers - Validation blockers
   * @returns {Array} Fix suggestions
   * @private
   */
  _generateFixSuggestions(blockers) {
    const suggestions = [];

    for (const blocker of blockers) {
      let suggestion = null;

      switch (blocker.check) {
        case 'SyntaxCheck':
          suggestion = {
            check: blocker.check,
            title: 'Fix syntax errors',
            description: 'Review and fix syntax errors in the generated code',
            actions: [
              'Check the error details for file path and line number',
              'Verify brackets, parentheses, and semicolons are balanced',
              'Ensure all strings are properly quoted',
              'Consider re-running generation with more context'
            ]
          };
          break;

        case 'DependencyCheck':
          suggestion = {
            check: blocker.check,
            title: 'Add missing dependencies',
            description: 'Install or add missing packages to package.json',
            actions: [
              'Run npm install for missing packages',
              'Add dependencies to package.json',
              'Verify import paths are correct',
              'Check for typos in package names'
            ]
          };
          break;

        case 'SchemaCheck':
          suggestion = {
            check: blocker.check,
            title: 'Fix schema validation errors',
            description: 'Ensure bundle structure matches expected schema',
            actions: [
              'Check that all required fields are present',
              'Verify field types match schema',
              'Review bundle_id, bundle_type, and created_at fields',
              'Ensure files array is properly formatted'
            ]
          };
          break;

        case 'TestCoverageCheck':
          suggestion = {
            check: blocker.check,
            title: 'Increase test coverage',
            description: `Add tests for untested files to meet coverage threshold`,
            actions: [
              'Review the list of untested files in the blocker details',
              'Add test files for each untested source file',
              'Consider lowering coverage threshold if appropriate',
              'Re-run generation with test generation enabled'
            ]
          };
          break;

        case 'MigrationReversibilityCheck':
          suggestion = {
            check: blocker.check,
            title: 'Add reverse migrations',
            description: 'Ensure all migrations can be rolled back',
            actions: [
              'Add sql_reverse for each migration',
              'Verify reverse operations undo forward operations',
              'Test that DROP TABLE reverses CREATE TABLE',
              'Ensure data loss risks are documented'
            ]
          };
          break;

        default:
          suggestion = {
            check: blocker.check,
            title: `Fix ${blocker.check} issues`,
            description: blocker.message,
            actions: [
              'Review the blocker details',
              'Consult documentation for this check',
              'Consider re-running generation'
            ]
          };
      }

      suggestions.push(suggestion);
    }

    return suggestions;
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

  /**
   * Assess plan risks to determine if approval is required
   * @param {Object} plan - Implementation plan
   * @returns {Object} { requiresApproval, level, reasons }
   * @private
   */
  _assessPlanRisks(plan) {
    const risks = [];
    let level = 'low';

    // Check for database migrations
    if (plan.migrations && plan.migrations.length > 0) {
      risks.push('Database migrations present');
      level = 'medium';
    }

    // Check for high number of file changes
    const fileCount = plan.files_to_change?.length || 0;
    if (fileCount > 10) {
      risks.push(`High number of file changes (${fileCount})`);
      level = 'high';
    }

    // Check for critical files
    const criticalPatterns = ['package.json', 'tsconfig.json', 'webpack', 'vite.config', '.env'];
    const hasCriticalFiles = plan.files_to_change?.some(file =>
      criticalPatterns.some(pattern => file.includes(pattern))
    );
    if (hasCriticalFiles) {
      risks.push('Critical configuration files affected');
      level = level === 'low' ? 'medium' : 'high';
    }

    // Check for high complexity
    if (plan.complexity === 'high') {
      risks.push('High complexity task');
      level = 'high';
    }

    // Check for explicit risks in plan
    if (plan.risks && plan.risks.length > 0) {
      risks.push(...plan.risks);
      level = 'high';
    }

    // Check for dependencies changes
    if (plan.dependencies && Object.keys(plan.dependencies).length > 0) {
      risks.push('Dependencies will be modified');
      level = level === 'low' ? 'medium' : level;
    }

    return {
      requiresApproval: level === 'high' || level === 'medium',
      level,
      reasons: risks,
      details: {
        filesAffected: fileCount,
        migrations: plan.migrations?.length || 0,
        complexity: plan.complexity,
        estimatedTime: plan.estimated_minutes
      }
    };
  }

  /**
   * Wait for user approval
   * @param {string} taskId - Task ID
   * @param {Object} options - Wait options
   * @returns {Promise<Object>} { approved, modifiedPlan, modifications, reason }
   * @private
   */
  async _waitForApproval(taskId, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default

    this.logger.info(`[Approval] Waiting for user approval (timeout: ${timeout}ms)`);

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.logger.warn(`[Approval] Timeout waiting for approval`);
        resolve({
          approved: false,
          reason: 'Approval timeout exceeded'
        });
      }, timeout);

      // Set up approval handler
      const approvalHandler = (approval) => {
        clearTimeout(timeoutId);
        this.logger.info(`[Approval] Received: ${approval.approved ? 'approved' : 'rejected'}`);
        resolve(approval);
      };

      // Store handler for external approval submission
      if (!this._pendingApprovals) {
        this._pendingApprovals = new Map();
      }
      this._pendingApprovals.set(taskId, approvalHandler);
    });
  }

  /**
   * Submit approval for a pending task (called externally via API)
   * @param {string} taskId - Task ID
   * @param {Object} approval - Approval object
   * @returns {boolean} Whether approval was submitted
   */
  submitApproval(taskId, approval) {
    if (!this._pendingApprovals || !this._pendingApprovals.has(taskId)) {
      this.logger.warn(`[Approval] No pending approval for task ${taskId}`);
      return false;
    }

    const handler = this._pendingApprovals.get(taskId);
    this._pendingApprovals.delete(taskId);
    handler(approval);
    return true;
  }

  /**
   * Calculate cost from token usage
   * @param {number} tokens - Total tokens used
   * @returns {number} Estimated cost in USD
   * @private
   */
  _calculateCost(tokens) {
    // Claude 3.5 Sonnet pricing (as of 2024)
    // Input: $3 per million tokens
    // Output: $15 per million tokens
    // Assume 70% input, 30% output for estimation
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;

    return inputCost + outputCost;
  }

  /**
   * Build error response
   * @param {string} taskId - Task ID
   * @param {Object} error - Error details
   * @param {Object} metrics - Metrics collected so far
   * @param {number} taskStartTime - Task start timestamp
   * @returns {Object} Error response
   * @private
   */
  _buildErrorResponse(taskId, error, metrics, taskStartTime) {
    metrics.timeMs.total = Date.now() - taskStartTime;
    metrics.tokensUsed.total = this.budgetManager.usedTokens;
    metrics.estimatedCost = this._calculateCost(metrics.tokensUsed.total);

    return {
      success: false,
      taskId,
      mode: 'bundle',
      error,
      bundle: null,
      validation: null,
      metrics
    };
  }

  /**
   * Determine which phase failed based on task state
   * @param {Object} task - Task object
   * @returns {string} Phase name
   * @private
   */
  _determineFailedPhase(task) {
    if (!task || !task.phases) {
      return 'unknown';
    }

    const phases = ['analyze', 'plan', 'generate', 'validate'];
    for (const phase of phases) {
      if (task.phases[phase]?.status === PhaseStatus.FAILED) {
        return phase;
      }
      if (task.phases[phase]?.status === PhaseStatus.IN_PROGRESS) {
        return phase;
      }
    }

    // Check current status
    switch (task.status) {
      case TaskStatus.ANALYZING: return 'analyze';
      case TaskStatus.PLANNING: return 'plan';
      case TaskStatus.GENERATING: return 'generate';
      case TaskStatus.VALIDATING: return 'validate';
      default: return 'unknown';
    }
  }

  /**
   * Check if error is recoverable
   * @param {Error} error - Error object
   * @returns {boolean} Whether error is recoverable
   * @private
   */
  _isRecoverableError(error) {
    // Token/budget errors are not recoverable
    if (error.message && error.message.includes('budget')) {
      return false;
    }

    // Network errors might be recoverable
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // API errors (rate limit, etc.) might be recoverable
    if (error.status === 429 || error.status === 503) {
      return true;
    }

    // Validation errors are recoverable
    if (error.message && error.message.includes('validation')) {
      return true;
    }

    // Syntax errors are recoverable
    if (error instanceof SyntaxError) {
      return true;
    }

    // Default to recoverable
    return true;
  }

  /**
   * Retry validation with updated bundle or options
   * @param {string} taskId - Original task ID
   * @param {Object} options - Retry options
   * @param {Object} options.bundle - Updated bundle to validate (optional)
   * @param {number} options.coverageThreshold - New coverage threshold (optional)
   * @returns {Promise<Object>} Validation result
   */
  async retryValidation(taskId, options = {}) {
    this.logger.info(`Retrying validation for task ${taskId}`);

    // Get original task
    const task = this.stateManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Use provided bundle or get from task
    const bundle = options.bundle || task.bundle;
    if (!bundle) {
      throw new Error('No bundle available for validation retry');
    }

    // Update coverage threshold if provided
    if (options.coverageThreshold !== undefined) {
      this.releaseGate.coverageThreshold = options.coverageThreshold;

      // Update TestCoverageCheck threshold
      const testCoverageCheck = this.releaseGate.checks.find(c => c.name === 'TestCoverageCheck');
      if (testCoverageCheck) {
        testCoverageCheck.threshold = options.coverageThreshold;
      }

      this.logger.info(`Updated coverage threshold to ${options.coverageThreshold}%`);
    }

    // Emit retry event
    this.eventBus.emitEvent(EventTypes.TASK_PROGRESS, {
      phase: 'validate',
      status: 'retrying',
      attempt: (task.validationAttempts || 0) + 1
    }, taskId);

    // Run validation
    const validation = await this._validatePhase(bundle, taskId);

    // Update task state
    this.stateManager.updateTask(taskId, {
      validationAttempts: (task.validationAttempts || 0) + 1,
      lastValidation: validation
    });

    return validation;
  }

  /**
   * Regenerate bundle after validation failure
   * @param {string} taskId - Original task ID
   * @param {Object} options - Regeneration options
   * @param {Array} options.fixInstructions - Instructions for fixing issues
   * @returns {Promise<Object>} New bundle result
   */
  async regenerateBundle(taskId, options = {}) {
    this.logger.info(`Regenerating bundle for task ${taskId}`);

    // Get original task
    const task = this.stateManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Build regeneration request
    const request = {
      message: task.request || task.message,
      context: task.metadata?.context || [],
      workspaceFiles: task.metadata?.workspaceFiles || [],
      fixInstructions: options.fixInstructions || []
    };

    // Emit regeneration event
    this.eventBus.emitEvent(EventTypes.TASK_PROGRESS, {
      phase: 'regenerate',
      status: 'started',
      originalTaskId: taskId
    }, taskId);

    // Execute new bundle mode (will create new phases)
    const newTaskId = `${taskId}_regen_${Date.now()}`;

    // Link to original task
    this.stateManager.createTask(newTaskId, request.message, {
      ...task.metadata,
      originalTaskId: taskId,
      regeneration: true,
      fixInstructions: request.fixInstructions
    });

    // Run phases
    try {
      const analysis = await this._executePhase('analyze', newTaskId, async () => {
        return await this._analyzePhase(request);
      });

      const plan = await this._executePhase('plan', newTaskId, async () => {
        return await this._planPhase(request, analysis);
      });

      const bundle = await this._executePhase('generate', newTaskId, async () => {
        return await this._generatePhase(request, plan);
      });

      const validation = await this._executePhase('validate', newTaskId, async () => {
        return await this._validatePhase(bundle, newTaskId);
      });

      return {
        success: validation.passed,
        taskId: newTaskId,
        originalTaskId: taskId,
        bundle: validation.passed ? validation.signedBundle : bundle,
        validation
      };
    } catch (error) {
      this.logger.error(`Regeneration failed for task ${taskId}:`, error);

      return {
        success: false,
        taskId: newTaskId,
        originalTaskId: taskId,
        error: error.message
      };
    }
  }

  /**
   * Get Sub-Agent usage report
   * @returns {Object} Sub-agent usage statistics
   */
  getSubAgentUsage() {
    if (!this.subAgentCoordinator) {
      return { total: 0, agents: [], byAgent: {} };
    }
    return this.subAgentCoordinator.getTotalUsage();
  }

  /**
   * Get execution summary from Sub-Agent Coordinator
   * @returns {Object} Execution summary
   */
  getSubAgentSummary() {
    if (!this.subAgentCoordinator) {
      return null;
    }
    return this.subAgentCoordinator.getSummary();
  }

  /**
   * Reset Sub-Agent state
   */
  resetSubAgents() {
    if (this.subAgentCoordinator) {
      this.subAgentCoordinator.reset();
    }
  }
}

module.exports = AgentOrchestrator;
