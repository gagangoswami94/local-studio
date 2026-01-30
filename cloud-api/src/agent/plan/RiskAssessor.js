/**
 * Risk Assessor
 * Evaluates potential risks in execution plans
 */

class RiskAssessor {
  constructor(options = {}) {
    this.options = {
      autoApplyThreshold: options.autoApplyThreshold || 30, // Score below this = safe to auto-apply
      criticalThreshold: options.criticalThreshold || 70,
      highThreshold: options.highThreshold || 50,
      mediumThreshold: options.mediumThreshold || 30,
      ...options
    };
  }

  /**
   * Assess risks in execution plan
   * @param {Object} plan - Execution plan to assess
   * @param {Object} analysis - Workspace analysis
   * @returns {Object} Risk report
   */
  assess(plan, analysis = {}) {
    const risks = [];

    // Check various risk categories
    risks.push(...this.checkBreakingChanges(plan, analysis));
    risks.push(...this.checkDataLoss(plan));
    risks.push(...this.checkSecurityRisks(plan));
    risks.push(...this.checkPerformanceRisks(plan));
    risks.push(...this.checkDependencyRisks(plan, analysis));
    risks.push(...this.checkMigrationRisks(plan));

    // Calculate overall risk score (0-100)
    const overallScore = this.calculateRiskScore(risks);

    // Determine risk level
    const level = this._getRiskLevel(overallScore);

    // Generate warnings
    const warnings = this._generateWarnings(plan, risks);

    // Determine recommendation
    const recommendation = this._getRecommendation(overallScore, risks);

    // Check if safe to auto-apply
    const safeToAutoApply = this._isSafeToAutoApply(overallScore, risks);

    return {
      overallScore,
      level, // 'critical' | 'high' | 'medium' | 'low'
      risks,
      warnings,
      recommendation,
      safeToAutoApply,
      metadata: {
        totalRisks: risks.length,
        criticalRisks: risks.filter(r => r.severity === 'critical').length,
        highRisks: risks.filter(r => r.severity === 'high').length,
        mediumRisks: risks.filter(r => r.severity === 'medium').length,
        lowRisks: risks.filter(r => r.severity === 'low').length
      }
    };
  }

  /**
   * Check for breaking changes
   * @param {Object} plan - Execution plan
   * @param {Object} analysis - Workspace analysis
   * @returns {Array} Breaking change risks
   */
  checkBreakingChanges(plan, analysis) {
    const risks = [];

    // Check for API changes
    const apiChanges = plan.steps.filter(s =>
      (s.layer === 'backend' && s.action === 'modify' && s.target.includes('route')) ||
      (s.target.includes('api') && s.action === 'modify')
    );

    if (apiChanges.length > 0) {
      risks.push({
        type: 'breaking_change',
        category: 'api',
        severity: 'high',
        description: `${apiChanges.length} API route(s) will be modified`,
        impact: 'May break existing API consumers',
        mitigation: 'Version API endpoints, maintain backward compatibility',
        affectedSteps: apiChanges.map(s => s.id),
        score: 50
      });
    }

    // Check for database schema changes
    const schemaChanges = plan.migrations?.filter(m =>
      m.type === 'alter_table' ||
      m.type === 'drop_column' ||
      m.type === 'change_column_type'
    ) || [];

    if (schemaChanges.length > 0) {
      risks.push({
        type: 'breaking_change',
        category: 'database',
        severity: 'critical',
        description: `${schemaChanges.length} breaking database schema change(s)`,
        impact: 'May break existing code, data may be incompatible',
        mitigation: 'Create migration path, update all dependent code',
        affectedMigrations: schemaChanges.map(m => m.id),
        score: 80
      });
    }

    // Check for component interface changes
    const componentChanges = plan.steps.filter(s =>
      s.layer === 'frontend' &&
      s.action === 'modify' &&
      s.target.includes('component')
    );

    if (componentChanges.length > 3) {
      risks.push({
        type: 'breaking_change',
        category: 'ui',
        severity: 'medium',
        description: `${componentChanges.length} component(s) will be modified`,
        impact: 'May break parent components or pages',
        mitigation: 'Test component integration, check prop usage',
        affectedSteps: componentChanges.map(s => s.id),
        score: 40
      });
    }

    return risks;
  }

  /**
   * Check for data loss risks
   * @param {Object} plan - Execution plan
   * @returns {Array} Data loss risks
   */
  checkDataLoss(plan) {
    const risks = [];

    // Check for file deletions
    const fileDeletions = plan.steps.filter(s => s.action === 'delete');
    if (fileDeletions.length > 0) {
      const severity = fileDeletions.length > 5 ? 'critical' : 'high';
      const score = fileDeletions.length > 5 ? 70 : 50;

      risks.push({
        type: 'data_loss',
        category: 'file_deletion',
        severity,
        description: `${fileDeletions.length} file(s) will be deleted`,
        impact: 'Permanent loss of code and configuration',
        mitigation: 'Create backup, review each deletion carefully',
        affectedSteps: fileDeletions.map(s => s.id),
        score
      });
    }

    // Check for drop table migrations
    const dropTables = plan.migrations?.filter(m => m.type === 'drop_table') || [];
    if (dropTables.length > 0) {
      risks.push({
        type: 'data_loss',
        category: 'database',
        severity: 'critical',
        description: `${dropTables.length} table(s) will be dropped`,
        impact: 'Permanent loss of data',
        mitigation: 'Backup database, confirm data is no longer needed',
        affectedMigrations: dropTables.map(m => m.id),
        score: 90
      });
    }

    // Check for drop column migrations
    const dropColumns = plan.migrations?.filter(m => m.type === 'drop_column') || [];
    if (dropColumns.length > 0) {
      risks.push({
        type: 'data_loss',
        category: 'database',
        severity: 'high',
        description: `${dropColumns.length} column(s) will be dropped`,
        impact: 'Loss of data in specific columns',
        mitigation: 'Export data, confirm columns are unused',
        affectedMigrations: dropColumns.map(m => m.id),
        score: 70
      });
    }

    return risks;
  }

  /**
   * Check for security risks
   * @param {Object} plan - Execution plan
   * @returns {Array} Security risks
   */
  checkSecurityRisks(plan) {
    const risks = [];

    // Check for authentication changes
    const authChanges = plan.steps.filter(s =>
      s.target.includes('auth') ||
      s.target.includes('login') ||
      s.target.includes('session') ||
      (s.description && s.description.toLowerCase().includes('auth'))
    );

    if (authChanges.length > 0 && authChanges.some(s => s.action === 'modify')) {
      risks.push({
        type: 'security',
        category: 'authentication',
        severity: 'high',
        description: 'Authentication system will be modified',
        impact: 'May introduce security vulnerabilities',
        mitigation: 'Security audit, test authentication flows thoroughly',
        affectedSteps: authChanges.map(s => s.id),
        score: 60
      });
    }

    // Check for permission/authorization changes
    const permissionChanges = plan.steps.filter(s =>
      s.target.includes('permission') ||
      s.target.includes('role') ||
      s.target.includes('authorization')
    );

    if (permissionChanges.length > 0) {
      risks.push({
        type: 'security',
        category: 'authorization',
        severity: 'high',
        description: 'Authorization system will be modified',
        impact: 'May grant unintended access',
        mitigation: 'Review permission model, test access controls',
        affectedSteps: permissionChanges.map(s => s.id),
        score: 60
      });
    }

    // Check for sensitive data handling
    const sensitiveDataChanges = plan.steps.filter(s =>
      s.target.includes('password') ||
      s.target.includes('secret') ||
      s.target.includes('key') ||
      s.target.includes('token')
    );

    if (sensitiveDataChanges.length > 0) {
      risks.push({
        type: 'security',
        category: 'sensitive_data',
        severity: 'medium',
        description: 'Sensitive data handling will change',
        impact: 'May expose or mishandle sensitive information',
        mitigation: 'Encrypt sensitive data, use secure storage',
        affectedSteps: sensitiveDataChanges.map(s => s.id),
        score: 45
      });
    }

    return risks;
  }

  /**
   * Check for performance risks
   * @param {Object} plan - Execution plan
   * @returns {Array} Performance risks
   */
  checkPerformanceRisks(plan) {
    const risks = [];

    // Check for large number of database operations
    const dbSteps = plan.steps.filter(s => s.layer === 'database');
    if (dbSteps.length > 10) {
      risks.push({
        type: 'performance',
        category: 'database',
        severity: 'medium',
        description: `${dbSteps.length} database operations`,
        impact: 'May slow down application startup or migrations',
        mitigation: 'Batch migrations, optimize queries, add indexes',
        affectedSteps: dbSteps.map(s => s.id),
        score: 35
      });
    }

    // Check for many file operations
    if (plan.steps.length > 50) {
      risks.push({
        type: 'performance',
        category: 'complexity',
        severity: 'medium',
        description: `Large plan with ${plan.steps.length} steps`,
        impact: 'May take significant time to execute',
        mitigation: 'Break into smaller sub-plans, prioritize critical changes',
        score: 40
      });
    }

    // Check token budget
    if (plan.totalEstimate?.tokens?.total > 80000) {
      risks.push({
        type: 'performance',
        category: 'cost',
        severity: 'low',
        description: `High token usage: ${plan.totalEstimate.tokens.total}`,
        impact: 'May incur higher API costs',
        mitigation: 'Optimize prompts, cache responses where possible',
        score: 20
      });
    }

    return risks;
  }

  /**
   * Check for dependency risks
   * @param {Object} plan - Execution plan
   * @param {Object} analysis - Workspace analysis
   * @returns {Array} Dependency risks
   */
  checkDependencyRisks(plan, analysis) {
    const risks = [];

    // Check for circular dependencies
    const circular = this._detectCircularDependencies(plan.steps);
    if (circular.length > 0) {
      risks.push({
        type: 'dependency',
        category: 'circular',
        severity: 'high',
        description: `${circular.length} circular dependency chain(s)`,
        impact: 'Cannot execute plan in correct order',
        mitigation: 'Resolve circular dependencies before execution',
        details: circular,
        score: 65
      });
    }

    // Check for missing dependencies
    const missingDeps = this._findMissingDependencies(plan.steps);
    if (missingDeps.length > 0) {
      risks.push({
        type: 'dependency',
        category: 'missing',
        severity: 'medium',
        description: `${missingDeps.length} step(s) reference non-existent dependencies`,
        impact: 'Execution may fail or produce incorrect results',
        mitigation: 'Add missing steps or remove invalid dependencies',
        details: missingDeps,
        score: 40
      });
    }

    // Check for many dependencies
    const complexSteps = plan.steps.filter(s => s.dependencies && s.dependencies.length > 5);
    if (complexSteps.length > 0) {
      risks.push({
        type: 'dependency',
        category: 'complexity',
        severity: 'low',
        description: `${complexSteps.length} step(s) have many dependencies`,
        impact: 'May be difficult to execute or debug',
        mitigation: 'Simplify dependencies, break into smaller steps',
        affectedSteps: complexSteps.map(s => s.id),
        score: 25
      });
    }

    return risks;
  }

  /**
   * Check for migration risks
   * @param {Object} plan - Execution plan
   * @returns {Array} Migration risks
   */
  checkMigrationRisks(plan) {
    const risks = [];

    if (!plan.migrations || plan.migrations.length === 0) {
      return risks;
    }

    // Check for many migrations
    if (plan.migrations.length > 5) {
      risks.push({
        type: 'migration',
        category: 'complexity',
        severity: 'medium',
        description: `${plan.migrations.length} database migrations`,
        impact: 'Complex migration path, higher chance of failure',
        mitigation: 'Test each migration individually, create rollback plan',
        affectedMigrations: plan.migrations.map(m => m.id),
        score: 45
      });
    }

    // Check for migrations without rollback
    const noRollback = plan.migrations.filter(m => !m.sql_reverse || m.sql_reverse.trim() === '');
    if (noRollback.length > 0) {
      risks.push({
        type: 'migration',
        category: 'rollback',
        severity: 'high',
        description: `${noRollback.length} migration(s) without rollback`,
        impact: 'Cannot undo migration if something goes wrong',
        mitigation: 'Create rollback SQL for all migrations',
        affectedMigrations: noRollback.map(m => m.id),
        score: 55
      });
    }

    // Check for destructive migrations
    const destructive = plan.migrations.filter(m =>
      m.type === 'drop_table' ||
      m.type === 'drop_column' ||
      m.type === 'truncate_table'
    );

    if (destructive.length > 0) {
      risks.push({
        type: 'migration',
        category: 'destructive',
        severity: 'critical',
        description: `${destructive.length} destructive migration(s)`,
        impact: 'Permanent data loss if executed',
        mitigation: 'Backup database, verify data is no longer needed',
        affectedMigrations: destructive.map(m => m.id),
        score: 85
      });
    }

    return risks;
  }

  /**
   * Calculate overall risk score from individual risks
   * @param {Array} risks - Array of risk objects
   * @returns {number} Overall score (0-100)
   */
  calculateRiskScore(risks) {
    if (risks.length === 0) return 0;

    // Weight by severity
    const severityWeights = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    // Calculate weighted average
    const totalWeight = risks.reduce((sum, risk) => {
      const weight = severityWeights[risk.severity] || 1;
      return sum + (risk.score * weight);
    }, 0);

    const totalSeverity = risks.reduce((sum, risk) => {
      return sum + (severityWeights[risk.severity] || 1);
    }, 0);

    const weightedScore = totalWeight / totalSeverity;

    // Apply multiplier for number of risks
    const countMultiplier = Math.min(1 + (risks.length * 0.05), 1.5);

    return Math.min(Math.round(weightedScore * countMultiplier), 100);
  }

  /**
   * Get risk level from score
   * @private
   */
  _getRiskLevel(score) {
    if (score >= this.options.criticalThreshold) return 'critical';
    if (score >= this.options.highThreshold) return 'high';
    if (score >= this.options.mediumThreshold) return 'medium';
    return 'low';
  }

  /**
   * Generate warnings based on risks
   * @private
   */
  _generateWarnings(plan, risks) {
    const warnings = [];

    // High-risk operations
    const highRisks = risks.filter(r => r.severity === 'high' || r.severity === 'critical');
    if (highRisks.length > 0) {
      warnings.push(`Plan contains ${highRisks.length} high-risk operation(s)`);
    }

    // Data loss
    const dataLoss = risks.filter(r => r.type === 'data_loss');
    if (dataLoss.length > 0) {
      warnings.push('Data loss is possible - backup recommended');
    }

    // Breaking changes
    const breaking = risks.filter(r => r.type === 'breaking_change');
    if (breaking.length > 0) {
      warnings.push('Breaking changes detected - coordinate with team');
    }

    // Security
    const security = risks.filter(r => r.type === 'security');
    if (security.length > 0) {
      warnings.push('Security-sensitive changes - review carefully');
    }

    // Budget
    if (plan.totalEstimate && !plan.totalEstimate.tokens.withinBudget) {
      warnings.push('Plan exceeds token budget');
    }

    return warnings;
  }

  /**
   * Get recommendation based on score and risks
   * @private
   */
  _getRecommendation(score, risks) {
    if (score >= 70) {
      return 'High risk - proceed with extreme caution. Manual review required. Consider breaking into smaller changes.';
    }
    if (score >= 50) {
      return 'Moderate risk - review carefully before execution. Test in staging environment first.';
    }
    if (score >= 30) {
      return 'Low to moderate risk - standard review recommended. Can proceed with caution.';
    }
    return 'Low risk - safe to proceed with normal precautions.';
  }

  /**
   * Check if plan is safe to auto-apply
   * @private
   */
  _isSafeToAutoApply(score, risks) {
    // Score must be below threshold
    if (score >= this.options.autoApplyThreshold) {
      return false;
    }

    // Must have no critical or high severity risks
    const dangerousRisks = risks.filter(r =>
      r.severity === 'critical' || r.severity === 'high'
    );
    if (dangerousRisks.length > 0) {
      return false;
    }

    // Must have no data loss risks
    const dataLossRisks = risks.filter(r => r.type === 'data_loss');
    if (dataLossRisks.length > 0) {
      return false;
    }

    // Must have no breaking changes
    const breakingRisks = risks.filter(r => r.type === 'breaking_change');
    if (breakingRisks.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Detect circular dependencies
   * @private
   */
  _detectCircularDependencies(steps) {
    const circular = [];

    const visit = (stepId, path = []) => {
      if (path.includes(stepId)) {
        circular.push([...path, stepId].join(' -> '));
        return;
      }

      const step = steps.find(s => s.id === stepId);
      if (step && step.dependencies) {
        step.dependencies.forEach(depId => {
          visit(depId, [...path, stepId]);
        });
      }
    };

    steps.forEach(step => visit(step.id));

    return [...new Set(circular)];
  }

  /**
   * Find missing dependencies
   * @private
   */
  _findMissingDependencies(steps) {
    const stepIds = new Set(steps.map(s => s.id));
    const missing = [];

    steps.forEach(step => {
      if (step.dependencies) {
        step.dependencies.forEach(depId => {
          if (!stepIds.has(depId)) {
            missing.push({
              stepId: step.id,
              missingDep: depId
            });
          }
        });
      }
    });

    return missing;
  }
}

module.exports = RiskAssessor;
