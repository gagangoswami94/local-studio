/**
 * Validation utilities for API data structures
 */

/**
 * Validate plan structure
 * @param {Object} plan - Plan object to validate
 * @returns {Object} {valid: boolean, errors: string[]}
 */
function validatePlan(plan) {
  const errors = [];

  // Check required top-level fields
  if (!plan.plan_id || typeof plan.plan_id !== 'string') {
    errors.push('Missing or invalid plan_id');
  }

  if (!plan.complexity || !['low', 'medium', 'high'].includes(plan.complexity)) {
    errors.push('Missing or invalid complexity (must be: low, medium, or high)');
  }

  if (typeof plan.estimated_minutes !== 'number' || plan.estimated_minutes <= 0) {
    errors.push('Missing or invalid estimated_minutes (must be positive number)');
  }

  // Validate steps array
  if (!Array.isArray(plan.steps)) {
    errors.push('Missing or invalid steps (must be array)');
  } else {
    plan.steps.forEach((step, index) => {
      const validTypes = ['database', 'backend', 'frontend', 'test', 'config', 'deployment'];

      if (!step.type || !validTypes.includes(step.type)) {
        errors.push(`Step ${index + 1}: Missing or invalid type (must be one of: ${validTypes.join(', ')})`);
      }

      if (!step.description || typeof step.description !== 'string' || step.description.trim().length === 0) {
        errors.push(`Step ${index + 1}: Missing or invalid description`);
      }

      if (!Array.isArray(step.files)) {
        errors.push(`Step ${index + 1}: Missing or invalid files array`);
      }
    });
  }

  // Validate files_to_change array
  if (!Array.isArray(plan.files_to_change)) {
    errors.push('Missing or invalid files_to_change (must be array)');
  } else {
    plan.files_to_change.forEach((file, index) => {
      if (!file.path || typeof file.path !== 'string') {
        errors.push(`files_to_change[${index}]: Missing or invalid path`);
      }

      const validChangeTypes = ['create', 'modify', 'delete'];
      if (!file.change_type || !validChangeTypes.includes(file.change_type)) {
        errors.push(`files_to_change[${index}]: Missing or invalid change_type (must be: ${validChangeTypes.join(', ')})`);
      }
    });
  }

  // Validate migrations array
  if (!Array.isArray(plan.migrations)) {
    errors.push('Missing or invalid migrations (must be array)');
  } else {
    plan.migrations.forEach((migration, index) => {
      if (!migration.sql_forward || typeof migration.sql_forward !== 'string') {
        errors.push(`migrations[${index}]: Missing or invalid sql_forward`);
      }

      if (!migration.sql_reverse || typeof migration.sql_reverse !== 'string') {
        errors.push(`migrations[${index}]: Missing or invalid sql_reverse`);
      }
    });
  }

  // Validate risks array
  if (!Array.isArray(plan.risks)) {
    errors.push('Missing or invalid risks (must be array)');
  } else {
    plan.risks.forEach((risk, index) => {
      if (typeof risk !== 'string' || risk.trim().length === 0) {
        errors.push(`risks[${index}]: Invalid risk (must be non-empty string)`);
      }
    });
  }

  // Validate dependencies object
  if (!plan.dependencies || typeof plan.dependencies !== 'object') {
    errors.push('Missing or invalid dependencies (must be object)');
  } else {
    if (!Array.isArray(plan.dependencies.add)) {
      errors.push('dependencies.add must be array');
    }

    if (!Array.isArray(plan.dependencies.remove)) {
      errors.push('dependencies.remove must be array');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate code generation result structure
 * @param {Object} result - Code generation result
 * @returns {Object} {valid: boolean, errors: string[]}
 */
function validateCodeResult(result) {
  const errors = [];

  if (!result.title || typeof result.title !== 'string') {
    errors.push('Missing or invalid title');
  }

  if (!Array.isArray(result.files)) {
    errors.push('Missing or invalid files array');
  } else {
    result.files.forEach((file, index) => {
      if (!file.path || typeof file.path !== 'string') {
        errors.push(`files[${index}]: Missing or invalid path`);
      }

      const validActions = ['created', 'modified', 'deleted'];
      if (!file.action || !validActions.includes(file.action)) {
        errors.push(`files[${index}]: Missing or invalid action (must be: ${validActions.join(', ')})`);
      }

      if (file.action !== 'deleted' && (!file.diff || typeof file.diff !== 'string')) {
        errors.push(`files[${index}]: Missing or invalid diff`);
      }
    });
  }

  if (!result.summary || typeof result.summary !== 'string') {
    errors.push('Missing or invalid summary');
  }

  if (typeof result.filesCreated !== 'number') {
    errors.push('Missing or invalid filesCreated');
  }

  if (typeof result.filesModified !== 'number') {
    errors.push('Missing or invalid filesModified');
  }

  if (typeof result.filesDeleted !== 'number') {
    errors.push('Missing or invalid filesDeleted');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize and normalize plan object
 * Ensures all required fields have default values
 * @param {Object} plan - Plan object
 * @returns {Object} Normalized plan
 */
function normalizePlan(plan) {
  return {
    plan_id: plan.plan_id || `plan_${Date.now()}`,
    complexity: plan.complexity || 'medium',
    estimated_minutes: plan.estimated_minutes || 30,
    steps: Array.isArray(plan.steps) ? plan.steps : [],
    files_to_change: Array.isArray(plan.files_to_change) ? plan.files_to_change : [],
    migrations: Array.isArray(plan.migrations) ? plan.migrations : [],
    risks: Array.isArray(plan.risks) ? plan.risks : [],
    dependencies: {
      add: Array.isArray(plan.dependencies?.add) ? plan.dependencies.add : [],
      remove: Array.isArray(plan.dependencies?.remove) ? plan.dependencies.remove : []
    }
  };
}

module.exports = {
  validatePlan,
  validateCodeResult,
  normalizePlan
};
