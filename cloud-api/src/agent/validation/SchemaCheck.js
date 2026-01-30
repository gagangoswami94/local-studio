/**
 * Schema Check
 * Validates JSON files against schemas
 */
const BaseCheck = require('./BaseCheck');

class SchemaCheck extends BaseCheck {
  constructor(config = {}) {
    super({
      name: 'SchemaCheck',
      level: 'blocker',
      ...config
    });
  }

  /**
   * Run schema validation
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Validation result
   */
  async run(bundle) {
    this.logStart();

    const errors = [];

    // Validate bundle structure
    const bundleValidation = this.validateBundleSchema(bundle);
    if (!bundleValidation.valid) {
      errors.push({
        schema: 'bundle',
        errors: bundleValidation.errors
      });
    }

    // Validate appSpec if present
    if (bundle.appSpec) {
      const appSpecValidation = this.validateAppSpecSchema(bundle.appSpec);
      if (!appSpecValidation.valid) {
        errors.push({
          schema: 'appSpec',
          errors: appSpecValidation.errors
        });
      }
    }

    // Validate plan if present
    if (bundle.plan) {
      const planValidation = this.validatePlanSchema(bundle.plan);
      if (!planValidation.valid) {
        errors.push({
          schema: 'plan',
          errors: planValidation.errors
        });
      }
    }

    // Check results
    if (errors.length > 0) {
      const result = this.failure(
        `Schema validation failed for ${errors.length} structure(s)`,
        { errors }
      );
      this.logResult(result);
      return result;
    }

    const result = this.success('All schemas valid', {
      bundleValid: true,
      appSpecValid: !!bundle.appSpec,
      planValid: !!bundle.plan
    });
    this.logResult(result);
    return result;
  }

  /**
   * Validate bundle schema
   * @param {Object} bundle - Bundle object
   * @returns {Object} { valid, errors }
   */
  validateBundleSchema(bundle) {
    const errors = [];

    // Required fields
    if (!bundle.bundle_id) {
      errors.push('Missing required field: bundle_id');
    }
    if (!bundle.bundle_type) {
      errors.push('Missing required field: bundle_type');
    }
    if (!bundle.created_at) {
      errors.push('Missing required field: created_at');
    }

    // Files must be array
    if (!Array.isArray(bundle.files)) {
      errors.push('files must be an array');
    }

    // Tests must be array
    if (bundle.tests && !Array.isArray(bundle.tests)) {
      errors.push('tests must be an array');
    }

    // Migrations must be array
    if (bundle.migrations && !Array.isArray(bundle.migrations)) {
      errors.push('migrations must be an array');
    }

    // Commands must be array
    if (bundle.commands && !Array.isArray(bundle.commands)) {
      errors.push('commands must be an array');
    }

    // Metadata must be object
    if (bundle.metadata && typeof bundle.metadata !== 'object') {
      errors.push('metadata must be an object');
    }

    // Bundle type must be valid
    const validTypes = ['full', 'patch', 'feature', 'cleanup'];
    if (bundle.bundle_type && !validTypes.includes(bundle.bundle_type)) {
      errors.push(`bundle_type must be one of: ${validTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate appSpec schema
   * @param {Object} appSpec - AppSpec object
   * @returns {Object} { valid, errors }
   */
  validateAppSpecSchema(appSpec) {
    const errors = [];

    if (typeof appSpec !== 'object') {
      errors.push('appSpec must be an object');
      return { valid: false, errors };
    }

    // Common optional fields (just check types if present)
    if (appSpec.name && typeof appSpec.name !== 'string') {
      errors.push('appSpec.name must be a string');
    }

    if (appSpec.version && typeof appSpec.version !== 'string') {
      errors.push('appSpec.version must be a string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate plan schema
   * @param {Object} plan - Plan object
   * @returns {Object} { valid, errors }
   */
  validatePlanSchema(plan) {
    const errors = [];

    if (typeof plan !== 'object') {
      errors.push('plan must be an object');
      return { valid: false, errors };
    }

    // Check title
    if (plan.title && typeof plan.title !== 'string') {
      errors.push('plan.title must be a string');
    }

    // Check steps
    if (plan.steps && !Array.isArray(plan.steps)) {
      errors.push('plan.steps must be an array');
    }

    // Validate each step
    if (Array.isArray(plan.steps)) {
      plan.steps.forEach((step, idx) => {
        if (!step.id) {
          errors.push(`plan.steps[${idx}] missing required field: id`);
        }
        if (!step.action) {
          errors.push(`plan.steps[${idx}] missing required field: action`);
        }
        if (!step.target) {
          errors.push(`plan.steps[${idx}] missing required field: target`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = SchemaCheck;
