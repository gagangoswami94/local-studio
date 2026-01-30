/**
 * Plan Builder
 * Generates step-by-step execution plans from app specifications
 */
class PlanBuilder {
  constructor(options = {}) {
    this.options = {
      maxSteps: options.maxSteps || 100,
      defaultRiskLevel: options.defaultRiskLevel || 'medium',
      ...options
    };
  }

  /**
   * Build execution plan from app specification
   * @param {Object} appSpec - Application specification
   * @param {Object} analysis - Workspace analysis/context
   * @param {number} budget - Token budget
   * @returns {Object} Execution plan
   */
  build(appSpec, analysis = {}, budget = 100000) {
    // 1. Extract features and requirements
    const features = this._extractFeatures(appSpec);

    // 2. Generate steps for each feature
    const rawSteps = [];
    features.forEach(feature => {
      const steps = this._generateStepsForFeature(feature, analysis);
      rawSteps.push(...steps);
    });

    // 3. Detect dependencies between steps
    const stepsWithDeps = this._detectDependencies(rawSteps, analysis);

    // 4. Order steps (topological sort + layer ordering)
    const orderedSteps = this._orderSteps(stepsWithDeps);

    // 5. Generate migrations
    const migrations = this._generateMigrations(appSpec, orderedSteps);

    // 6. Generate test plan
    const tests = this._generateTests(orderedSteps, appSpec);

    // 7. Assess risks
    const risks = this._assessRisks(orderedSteps, migrations, analysis);

    // 8. Estimate resources
    const totalEstimate = this._estimateResources(orderedSteps, migrations, tests, budget);

    // 9. Build final plan
    const plan = {
      version: '1.0',
      appSpecId: appSpec.id || `spec_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      steps: orderedSteps,
      migrations,
      tests,
      totalEstimate,
      risks,
      metadata: {
        featuresCount: features.length,
        stepsCount: orderedSteps.length,
        migrationsCount: migrations.length,
        testsCount: tests.length
      }
    };

    return plan;
  }

  /**
   * Validate execution plan
   * @param {Object} plan - Plan to validate
   * @returns {Object} Validation result
   */
  validate(plan) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!plan.version) errors.push('Missing plan version');
    if (!plan.appSpecId) errors.push('Missing appSpecId');
    if (!plan.steps || !Array.isArray(plan.steps)) {
      errors.push('Missing or invalid steps array');
    }

    // Validate steps
    if (plan.steps) {
      plan.steps.forEach((step, idx) => {
        if (!step.id) errors.push(`Step ${idx}: Missing id`);
        if (!step.action) errors.push(`Step ${idx}: Missing action`);
        if (!step.target) errors.push(`Step ${idx}: Missing target`);
        if (!['create', 'modify', 'delete'].includes(step.action)) {
          errors.push(`Step ${idx}: Invalid action '${step.action}'`);
        }
      });

      // Check for circular dependencies
      const circular = this._detectCircularDependencies(plan.steps);
      if (circular.length > 0) {
        errors.push(`Circular dependencies detected: ${circular.join(', ')}`);
      }

      // Check step count
      if (plan.steps.length > this.options.maxSteps) {
        warnings.push(`Step count (${plan.steps.length}) exceeds recommended maximum (${this.options.maxSteps})`);
      }
    }

    // Validate migrations
    if (plan.migrations) {
      plan.migrations.forEach((migration, idx) => {
        if (!migration.id) errors.push(`Migration ${idx}: Missing id`);
        if (!migration.type) errors.push(`Migration ${idx}: Missing type`);
      });
    }

    // Validate estimates
    if (!plan.totalEstimate) {
      warnings.push('Missing total estimate');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Estimate plan resources
   * @param {Object} plan - Plan to estimate
   * @returns {Object} Resource estimates
   */
  estimate(plan) {
    return this._estimateResources(
      plan.steps || [],
      plan.migrations || [],
      plan.tests || [],
      100000 // Default budget
    );
  }

  /**
   * Extract features from app spec
   * @private
   */
  _extractFeatures(appSpec) {
    const features = [];

    // Handle different appSpec formats
    if (appSpec.features && Array.isArray(appSpec.features)) {
      features.push(...appSpec.features);
    } else if (appSpec.pages && Array.isArray(appSpec.pages)) {
      // Convert pages to features
      appSpec.pages.forEach(page => {
        features.push({
          id: `page_${page.name}`,
          name: page.name,
          type: 'page',
          components: page.components || [],
          routes: page.routes || []
        });
      });
    } else if (appSpec.description) {
      // Single feature from description
      features.push({
        id: 'main_feature',
        name: appSpec.name || 'Main Feature',
        description: appSpec.description,
        type: 'general'
      });
    }

    return features;
  }

  /**
   * Generate steps for a feature
   * @private
   */
  _generateStepsForFeature(feature, analysis) {
    const steps = [];
    let stepCounter = 0;

    // Database models
    if (feature.models || feature.database) {
      const models = feature.models || [];
      models.forEach(model => {
        steps.push({
          id: `${feature.id}_model_${stepCounter++}`,
          featureId: feature.id,
          action: 'create',
          target: `src/models/${model.name}.js`,
          description: `Create ${model.name} model`,
          layer: 'database',
          dependencies: [],
          estimatedTokens: 1500,
          riskLevel: 'low'
        });
      });
    }

    // Backend routes/API
    if (feature.routes || feature.api) {
      const routes = feature.routes || [];
      routes.forEach(route => {
        steps.push({
          id: `${feature.id}_route_${stepCounter++}`,
          featureId: feature.id,
          action: 'create',
          target: `src/routes/${route.name}.js`,
          description: `Create ${route.name} route`,
          layer: 'backend',
          dependencies: [],
          estimatedTokens: 2000,
          riskLevel: 'low'
        });
      });
    }

    // Frontend components
    if (feature.components) {
      feature.components.forEach(component => {
        steps.push({
          id: `${feature.id}_comp_${stepCounter++}`,
          featureId: feature.id,
          action: 'create',
          target: `src/components/${component.name}.jsx`,
          description: `Create ${component.name} component`,
          layer: 'frontend',
          dependencies: [],
          estimatedTokens: 2500,
          riskLevel: 'low'
        });
      });
    }

    // If no specific structure, create a general step
    if (steps.length === 0) {
      steps.push({
        id: `${feature.id}_impl`,
        featureId: feature.id,
        action: 'create',
        target: this._inferTargetPath(feature, analysis),
        description: feature.description || `Implement ${feature.name}`,
        layer: 'general',
        dependencies: [],
        estimatedTokens: 3000,
        riskLevel: 'medium'
      });
    }

    return steps;
  }

  /**
   * Infer target path from feature
   * @private
   */
  _inferTargetPath(feature, analysis) {
    // Check if we can infer from patterns
    if (analysis.patterns) {
      const { frameworks } = analysis.patterns;

      // Frontend component
      if (feature.type === 'component' || feature.type === 'page') {
        if (frameworks.frontend?.some(f => f.name === 'React')) {
          return `src/components/${feature.name}.jsx`;
        }
        if (frameworks.frontend?.some(f => f.name === 'Vue')) {
          return `src/components/${feature.name}.vue`;
        }
      }

      // Backend route
      if (feature.type === 'api' || feature.type === 'route') {
        return `src/routes/${feature.name}.js`;
      }

      // Model
      if (feature.type === 'model') {
        return `src/models/${feature.name}.js`;
      }
    }

    // Default
    return `src/${feature.name}.js`;
  }

  /**
   * Detect dependencies between steps
   * @private
   */
  _detectDependencies(steps, analysis) {
    return steps.map(step => {
      const dependencies = [];

      // Database dependencies
      if (step.layer === 'backend') {
        // Backend depends on database models
        const modelSteps = steps.filter(s =>
          s.layer === 'database' &&
          s.featureId === step.featureId
        );
        dependencies.push(...modelSteps.map(s => s.id));
      }

      // Frontend dependencies
      if (step.layer === 'frontend') {
        // Frontend depends on backend routes
        const backendSteps = steps.filter(s =>
          (s.layer === 'backend' || s.layer === 'database') &&
          s.featureId === step.featureId
        );
        dependencies.push(...backendSteps.map(s => s.id));
      }

      return {
        ...step,
        dependencies: [...new Set(dependencies)] // Deduplicate
      };
    });
  }

  /**
   * Order steps by dependencies and layers
   * @private
   */
  _orderSteps(steps) {
    // Layer priority (lower = earlier)
    const layerPriority = {
      database: 1,
      backend: 2,
      frontend: 3,
      general: 4,
      test: 5
    };

    // Topological sort with layer ordering
    const sorted = [];
    const visited = new Set();
    const temp = new Set();

    const visit = (stepId) => {
      if (visited.has(stepId)) return;
      if (temp.has(stepId)) {
        // Circular dependency - skip
        return;
      }

      temp.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step && step.dependencies) {
        step.dependencies.forEach(depId => visit(depId));
      }

      temp.delete(stepId);
      visited.add(stepId);
      if (step) sorted.push(step);
    };

    // Sort by layer first, then apply topological sort
    const layerSorted = [...steps].sort((a, b) => {
      const priorityA = layerPriority[a.layer] || 999;
      const priorityB = layerPriority[b.layer] || 999;
      return priorityA - priorityB;
    });

    layerSorted.forEach(step => visit(step.id));

    return sorted;
  }

  /**
   * Generate database migrations
   * @private
   */
  _generateMigrations(appSpec, steps) {
    const migrations = [];

    // Find database-related steps
    const dbSteps = steps.filter(s => s.layer === 'database');

    dbSteps.forEach((step, idx) => {
      if (step.action === 'create' && step.target.includes('model')) {
        migrations.push({
          id: `migration_${idx + 1}`,
          type: 'create_table',
          description: `Create table for ${step.target}`,
          stepId: step.id,
          sql_forward: '-- SQL forward migration',
          sql_reverse: '-- SQL reverse migration',
          riskLevel: 'high'
        });
      }
    });

    return migrations;
  }

  /**
   * Generate test plan
   * @private
   */
  _generateTests(steps, appSpec) {
    const tests = [];

    steps.forEach((step, idx) => {
      // Generate tests for backend and frontend
      if (step.layer === 'backend' || step.layer === 'frontend') {
        tests.push({
          id: `test_${idx + 1}`,
          target: step.target,
          covers: step.id,
          type: step.layer === 'backend' ? 'integration' : 'component',
          description: `Test ${step.description}`,
          priority: step.riskLevel === 'high' ? 'critical' : 'normal'
        });
      }
    });

    return tests;
  }

  /**
   * Assess risks
   * @private
   */
  _assessRisks(steps, migrations, analysis) {
    const risks = [];

    // Check for file deletions
    const deleteSteps = steps.filter(s => s.action === 'delete');
    if (deleteSteps.length > 0) {
      risks.push({
        type: 'file_deletion',
        description: `${deleteSteps.length} file(s) will be deleted`,
        mitigation: 'Backup files before deletion, review carefully',
        severity: 'high',
        affectedSteps: deleteSteps.map(s => s.id)
      });
    }

    // Check for file modifications
    const modifySteps = steps.filter(s => s.action === 'modify');
    if (modifySteps.length > 0) {
      risks.push({
        type: 'file_modification',
        description: `${modifySteps.length} existing file(s) will be modified`,
        mitigation: 'Review changes carefully, use version control',
        severity: 'medium',
        affectedSteps: modifySteps.map(s => s.id)
      });
    }

    // Check for database migrations
    if (migrations.length > 0) {
      risks.push({
        type: 'database_migration',
        description: `${migrations.length} database migration(s) required`,
        mitigation: 'Test migrations in development, backup production data',
        severity: 'high',
        affectedMigrations: migrations.map(m => m.id)
      });
    }

    // Check for large plans
    if (steps.length > 50) {
      risks.push({
        type: 'complexity',
        description: `Large plan with ${steps.length} steps`,
        mitigation: 'Break into smaller sub-plans, incremental execution',
        severity: 'medium'
      });
    }

    return risks;
  }

  /**
   * Estimate resources
   * @private
   */
  _estimateResources(steps, migrations, tests, budget) {
    // Token estimates
    const stepsTokens = steps.reduce((sum, s) => sum + (s.estimatedTokens || 2000), 0);
    const migrationsTokens = migrations.length * 1000;
    const testsTokens = tests.length * 500;
    const totalTokens = stepsTokens + migrationsTokens + testsTokens;

    // File estimates
    const filesCreated = steps.filter(s => s.action === 'create').length;
    const filesModified = steps.filter(s => s.action === 'modify').length;
    const filesDeleted = steps.filter(s => s.action === 'delete').length;

    // Time estimates (rough)
    const avgTimePerStep = 30; // seconds
    const totalSeconds = steps.length * avgTimePerStep + migrations.length * 60;
    const totalMinutes = Math.ceil(totalSeconds / 60);

    return {
      tokens: {
        steps: stepsTokens,
        migrations: migrationsTokens,
        tests: testsTokens,
        total: totalTokens,
        budget,
        withinBudget: totalTokens <= budget
      },
      files: {
        created: filesCreated,
        modified: filesModified,
        deleted: filesDeleted,
        total: filesCreated + filesModified + filesDeleted
      },
      time: {
        estimatedMinutes: totalMinutes,
        estimatedSeconds: totalSeconds
      }
    };
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
}

module.exports = PlanBuilder;
