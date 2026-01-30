/**
 * Sub-Agent Coordinator
 * Manages multiple sub-agents and orchestrates parallel execution
 */

const EventEmitter = require('events');

class SubAgentCoordinator extends EventEmitter {
  constructor(orchestrator, config = {}) {
    super();

    this.orchestrator = orchestrator;
    this.config = config;
    this.agents = new Map();
    this.executionHistory = [];
    this.totalTokensUsed = 0;
  }

  /**
   * Register a sub-agent
   * @param {string} name - Agent name
   * @param {BaseSubAgent} agent - Agent instance
   */
  registerAgent(name, agent) {
    this.agents.set(name, agent);

    // Forward progress events
    agent.on('progress', (data) => {
      this.emit('agent_progress', data);
    });
  }

  /**
   * Execute all steps from a plan
   * @param {Array} steps - Steps to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution results
   */
  async executeSteps(steps, context = {}) {
    const startTime = Date.now();

    this.emit('execution_start', {
      totalSteps: steps.length,
      timestamp: new Date().toISOString()
    });

    try {
      // Build execution order with batches
      const batches = this.buildExecutionOrder(steps);

      this.emit('execution_plan', {
        totalBatches: batches.length,
        batches: batches.map((batch, idx) => ({
          batch: idx + 1,
          steps: batch.length,
          parallel: batch.length > 1
        }))
      });

      // Execute batches sequentially, steps within batch in parallel
      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        this.emit('batch_start', {
          batch: i + 1,
          totalBatches: batches.length,
          stepsInBatch: batch.length
        });

        try {
          const batchResults = await this.executeBatch(batch, context);
          results.push(...batchResults);

          // Count successes/failures
          batchResults.forEach(result => {
            if (result.success) {
              successCount++;
            } else {
              failureCount++;
            }
          });

          this.emit('batch_complete', {
            batch: i + 1,
            results: batchResults.length,
            success: batchResults.filter(r => r.success).length,
            failed: batchResults.filter(r => !r.success).length
          });

          // Stop on critical failures
          if (failureCount > 0 && this.config.stopOnFailure) {
            break;
          }
        } catch (error) {
          this.emit('batch_error', {
            batch: i + 1,
            error: error.message
          });

          if (this.config.stopOnError) {
            throw error;
          }
        }
      }

      const endTime = Date.now();
      const totalUsage = this.getTotalUsage();

      this.emit('execution_complete', {
        totalSteps: steps.length,
        successCount,
        failureCount,
        duration: endTime - startTime,
        tokensUsed: totalUsage.total,
        timestamp: new Date().toISOString()
      });

      return {
        success: failureCount === 0,
        results,
        summary: {
          totalSteps: steps.length,
          successCount,
          failureCount,
          duration: endTime - startTime,
          usage: totalUsage
        }
      };
    } catch (error) {
      this.emit('execution_error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Build execution order with batches for parallel execution
   * @param {Array} steps - Steps to order
   * @returns {Array} Array of batches (each batch is array of steps)
   */
  buildExecutionOrder(steps) {
    const batches = [];
    const completed = new Set();
    const stepMap = new Map(steps.map(s => [s.id, s]));

    // Continue until all steps are scheduled
    while (completed.size < steps.length) {
      const batch = [];

      // Find steps that can be executed now (all dependencies completed)
      for (const step of steps) {
        if (completed.has(step.id)) {
          continue;
        }

        const dependencies = step.dependencies || [];
        const canExecute = dependencies.every(depId => completed.has(depId));

        if (canExecute) {
          batch.push(step);
        }
      }

      // If no steps can be executed, we have a circular dependency
      if (batch.length === 0 && completed.size < steps.length) {
        const remaining = steps.filter(s => !completed.has(s.id));
        throw new Error(`Circular dependency detected in steps: ${remaining.map(s => s.id).join(', ')}`);
      }

      // Add batch and mark steps as scheduled
      if (batch.length > 0) {
        batches.push(batch);
        batch.forEach(step => completed.add(step.id));
      }
    }

    return batches;
  }

  /**
   * Execute a batch of steps in parallel
   * @param {Array} batch - Batch of steps to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} Batch results
   */
  async executeBatch(batch, context) {
    // Execute all steps in parallel using Promise.all
    const promises = batch.map(step => this.executeStep(step, context));

    try {
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      // If Promise.all fails, we still want results from successful steps
      // Use Promise.allSettled instead
      const results = await Promise.allSettled(promises);

      return results.map((result, idx) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            step: batch[idx],
            success: false,
            error: result.reason.message || 'Unknown error',
            timestamp: new Date().toISOString()
          };
        }
      });
    }
  }

  /**
   * Execute a single step
   * @param {Object} step - Step to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Step result
   */
  async executeStep(step, context) {
    const startTime = Date.now();

    this.emit('step_start', {
      stepId: step.id,
      action: step.action,
      target: step.target,
      timestamp: new Date().toISOString()
    });

    try {
      // Select appropriate agent for this step
      const agent = this.selectAgent(step);

      if (!agent) {
        throw new Error(`No suitable agent found for step ${step.id} (${step.action})`);
      }

      // Execute step with agent
      const result = await agent.execute(step, context);

      const endTime = Date.now();

      this.emit('step_complete', {
        stepId: step.id,
        agent: agent.name,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      });

      // Record in history
      this.executionHistory.push({
        step,
        agent: agent.name,
        result,
        duration: endTime - startTime,
        success: true,
        timestamp: new Date().toISOString()
      });

      return {
        step,
        agent: agent.name,
        success: true,
        result,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const endTime = Date.now();

      this.emit('step_error', {
        stepId: step.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Record in history
      this.executionHistory.push({
        step,
        error: error.message,
        duration: endTime - startTime,
        success: false,
        timestamp: new Date().toISOString()
      });

      return {
        step,
        success: false,
        error: error.message,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Select appropriate agent for a step
   * @param {Object} step - Step to execute
   * @returns {BaseSubAgent} Selected agent
   */
  selectAgent(step) {
    // Selection logic based on step properties
    const layer = step.layer;
    const action = step.action;
    const target = step.target || '';

    // Test files
    if (layer === 'test' || target.includes('test') || target.includes('spec')) {
      return this.agents.get('TestGenSubAgent');
    }

    // Migration files
    if (target.includes('migration') || target.includes('migrate')) {
      return this.agents.get('MigrationSubAgent');
    }

    // Database layer
    if (layer === 'database') {
      return this.agents.get('MigrationSubAgent') || this.agents.get('CodeGenSubAgent');
    }

    // Default to code generation agent
    return this.agents.get('CodeGenSubAgent');
  }

  /**
   * Get total token usage across all agents
   * @returns {Object} Combined usage statistics
   */
  getTotalUsage() {
    const usage = {
      agents: [],
      total: 0,
      byAgent: {}
    };

    for (const [name, agent] of this.agents) {
      const report = agent.getUsageReport();
      usage.agents.push(report);
      usage.total += report.tokensUsed;
      usage.byAgent[name] = report.tokensUsed;
    }

    return usage;
  }

  /**
   * Reset all agents
   */
  reset() {
    for (const agent of this.agents.values()) {
      agent.resetUsage();
    }
    this.executionHistory = [];
    this.totalTokensUsed = 0;
  }

  /**
   * Get execution summary
   * @returns {Object} Execution summary
   */
  getSummary() {
    const successful = this.executionHistory.filter(h => h.success).length;
    const failed = this.executionHistory.filter(h => !h.success).length;
    const totalDuration = this.executionHistory.reduce((sum, h) => sum + (h.duration || 0), 0);

    return {
      totalSteps: this.executionHistory.length,
      successful,
      failed,
      totalDuration,
      averageDuration: this.executionHistory.length > 0 ? totalDuration / this.executionHistory.length : 0,
      usage: this.getTotalUsage()
    };
  }
}

module.exports = SubAgentCoordinator;
