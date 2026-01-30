/**
 * Release Gate
 * Orchestrates all validation checks before releasing a bundle
 */
const SyntaxCheck = require('./SyntaxCheck');
const DependencyCheck = require('./DependencyCheck');
const SchemaCheck = require('./SchemaCheck');
const TestCoverageCheck = require('./TestCoverageCheck');
const SecurityCheck = require('./SecurityCheck');
const MigrationReversibilityCheck = require('./MigrationReversibilityCheck');

class ReleaseGate {
  /**
   * Create a new Release Gate
   * @param {Object} config - Configuration
   * @param {Object} config.logger - Logger instance
   * @param {Array} config.checks - Custom checks to run (optional)
   * @param {number} config.coverageThreshold - Test coverage threshold (default: 80)
   */
  constructor(config = {}) {
    this.logger = config.logger || console;
    this.coverageThreshold = config.coverageThreshold || 80;

    // Initialize all checks
    this.checks = config.checks || this._getDefaultChecks();
  }

  /**
   * Get default validation checks
   * @returns {Array} Array of check instances
   * @private
   */
  _getDefaultChecks() {
    return [
      new SyntaxCheck({ logger: this.logger }),
      new DependencyCheck({ logger: this.logger }),
      new SchemaCheck({ logger: this.logger }),
      new TestCoverageCheck({ logger: this.logger, threshold: this.coverageThreshold }),
      new SecurityCheck({ logger: this.logger }),
      new MigrationReversibilityCheck({ logger: this.logger })
    ];
  }

  /**
   * Run all validation checks
   * @param {Object} bundle - Bundle to validate
   * @param {Object} options - Options
   * @param {Object} options.eventBus - Event bus for progress events
   * @param {string} options.taskId - Task ID for event correlation
   * @returns {Promise<Object>} { passed, blockers, warnings, report }
   */
  async runAll(bundle, options = {}) {
    this.logger.info('[ReleaseGate] Starting validation checks...');

    const { eventBus, taskId } = options;
    const startTime = Date.now();
    const results = [];
    const blockers = [];
    const warnings = [];

    // Run all checks
    for (const check of this.checks) {
      try {
        // Emit check start event
        if (eventBus) {
          eventBus.emitEvent('validation_check_start', {
            check: check.name,
            level: check.level
          }, taskId);
        }

        const checkStartTime = Date.now();
        const result = await check.run(bundle);
        const checkDuration = Date.now() - checkStartTime;

        results.push({
          check: check.name,
          level: check.level,
          passed: result.passed,
          message: result.message,
          details: result.details,
          duration: checkDuration
        });

        // Emit check complete event
        if (eventBus) {
          eventBus.emitEvent('validation_check_complete', {
            check: check.name,
            level: check.level,
            passed: result.passed,
            message: result.message,
            duration: checkDuration
          }, taskId);
        }

        // Categorize failures
        if (!result.passed) {
          if (check.level === 'blocker') {
            blockers.push({
              check: check.name,
              message: result.message,
              details: result.details
            });
          } else {
            warnings.push({
              check: check.name,
              message: result.message,
              details: result.details
            });
          }
        }
      } catch (error) {
        this.logger.error(`[ReleaseGate] Check ${check.name} failed with error:`, error);

        // Emit check error event
        if (eventBus) {
          eventBus.emitEvent('validation_check_complete', {
            check: check.name,
            level: check.level,
            passed: false,
            message: `Check failed with error: ${error.message}`,
            error: error.message
          }, taskId);
        }

        // Treat check errors as blockers
        blockers.push({
          check: check.name,
          message: `Check failed with error: ${error.message}`,
          details: { error: error.stack }
        });

        results.push({
          check: check.name,
          level: check.level,
          passed: false,
          message: `Check failed with error: ${error.message}`,
          details: { error: error.stack }
        });
      }
    }

    const duration = Date.now() - startTime;
    const passed = blockers.length === 0;

    // Build comprehensive report
    const report = {
      passed,
      totalChecks: this.checks.length,
      passedChecks: results.filter(r => r.passed).length,
      failedChecks: results.filter(r => !r.passed).length,
      blockers: blockers.length,
      warnings: warnings.length,
      duration,
      timestamp: new Date().toISOString(),
      results
    };

    // Log summary
    if (passed) {
      this.logger.info(`[ReleaseGate] ✓ All checks passed (${duration}ms)`, {
        passed: report.passedChecks,
        warnings: warnings.length
      });
    } else {
      this.logger.error(`[ReleaseGate] ✗ Gate failed with ${blockers.length} blocker(s) and ${warnings.length} warning(s)`, {
        blockers: blockers.length,
        warnings: warnings.length
      });
    }

    return {
      passed,
      blockers,
      warnings,
      report
    };
  }

  /**
   * Run specific check
   * @param {string} checkName - Name of check to run
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Check result
   */
  async runCheck(checkName, bundle) {
    const check = this.checks.find(c => c.name === checkName);

    if (!check) {
      throw new Error(`Check "${checkName}" not found`);
    }

    return await check.run(bundle);
  }

  /**
   * Get list of all checks
   * @returns {Array} Array of check names and levels
   */
  getChecks() {
    return this.checks.map(check => ({
      name: check.name,
      level: check.level
    }));
  }

  /**
   * Add custom check
   * @param {Object} check - Check instance
   */
  addCheck(check) {
    if (typeof check.run !== 'function') {
      throw new Error('Check must implement run() method');
    }

    this.checks.push(check);
  }

  /**
   * Remove check by name
   * @param {string} checkName - Name of check to remove
   */
  removeCheck(checkName) {
    const index = this.checks.findIndex(c => c.name === checkName);

    if (index !== -1) {
      this.checks.splice(index, 1);
    }
  }

  /**
   * Generate validation report summary
   * @param {Object} gateResult - Result from runAll()
   * @returns {string} Human-readable summary
   */
  generateSummary(gateResult) {
    const { passed, blockers, warnings, report } = gateResult;

    let summary = `\n========================================\n`;
    summary += `Release Gate Validation Report\n`;
    summary += `========================================\n\n`;

    summary += `Status: ${passed ? '✓ PASSED' : '✗ FAILED'}\n`;
    summary += `Duration: ${report.duration}ms\n`;
    summary += `Timestamp: ${report.timestamp}\n\n`;

    summary += `Checks: ${report.passedChecks}/${report.totalChecks} passed\n`;
    summary += `Blockers: ${blockers.length}\n`;
    summary += `Warnings: ${warnings.length}\n\n`;

    if (blockers.length > 0) {
      summary += `========================================\n`;
      summary += `BLOCKERS (Must Fix)\n`;
      summary += `========================================\n\n`;

      blockers.forEach((blocker, idx) => {
        summary += `${idx + 1}. [${blocker.check}] ${blocker.message}\n`;
        if (blocker.details && Object.keys(blocker.details).length > 0) {
          summary += `   Details: ${JSON.stringify(blocker.details, null, 2)}\n`;
        }
        summary += `\n`;
      });
    }

    if (warnings.length > 0) {
      summary += `========================================\n`;
      summary += `WARNINGS (Recommended Fixes)\n`;
      summary += `========================================\n\n`;

      warnings.forEach((warning, idx) => {
        summary += `${idx + 1}. [${warning.check}] ${warning.message}\n`;
        if (warning.details && Object.keys(warning.details).length > 0) {
          summary += `   Details: ${JSON.stringify(warning.details, null, 2)}\n`;
        }
        summary += `\n`;
      });
    }

    if (passed && warnings.length === 0) {
      summary += `========================================\n`;
      summary += `All Validation Checks Passed! ✓\n`;
      summary += `Bundle is ready for release.\n`;
      summary += `========================================\n`;
    }

    return summary;
  }
}

module.exports = ReleaseGate;
