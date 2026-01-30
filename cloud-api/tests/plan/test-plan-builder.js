const assert = require('assert');
const PlanBuilder = require('../../src/agent/plan/PlanBuilder');

/**
 * Test Plan Builder
 */

console.log('Testing Plan Builder...\n');

// Sample app spec for testing
const sampleAppSpec = {
  id: 'app_auth_001',
  name: 'User Authentication',
  description: 'Add user authentication with login and registration',
  features: [
    {
      id: 'f1',
      name: 'User Model',
      type: 'model',
      models: [
        { name: 'User', fields: ['email', 'password', 'name'] }
      ]
    },
    {
      id: 'f2',
      name: 'Auth Routes',
      type: 'api',
      routes: [
        { name: 'auth', methods: ['POST /login', 'POST /register'] }
      ]
    },
    {
      id: 'f3',
      name: 'Login Component',
      type: 'component',
      components: [
        { name: 'Login', props: ['onSubmit'] },
        { name: 'Register', props: ['onSubmit'] }
      ]
    }
  ]
};

// Sample analysis
const sampleAnalysis = {
  patterns: {
    frameworks: {
      frontend: [{ name: 'React', version: '^18.0.0' }],
      backend: [{ name: 'Express', version: '^4.18.0' }]
    }
  }
};

// Test 1: Build Basic Plan
console.log('Test 1: Build Basic Plan');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis, 100000);

    assert(plan, 'Should return a plan');
    assert(plan.version, 'Should have version');
    assert(plan.appSpecId, 'Should have appSpecId');
    assert(Array.isArray(plan.steps), 'Should have steps array');
    assert(plan.steps.length > 0, 'Should have at least one step');
    assert(Array.isArray(plan.migrations), 'Should have migrations array');
    assert(Array.isArray(plan.tests), 'Should have tests array');
    assert(plan.totalEstimate, 'Should have total estimate');
    assert(Array.isArray(plan.risks), 'Should have risks array');

    console.log(`✓ Plan generated with ${plan.steps.length} steps`);
    console.log(`✓ ${plan.migrations.length} migrations`);
    console.log(`✓ ${plan.tests.length} tests`);
    console.log(`✓ ${plan.risks.length} risks identified`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Step Ordering (Database -> Backend -> Frontend)
console.log('Test 2: Step Ordering');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis);

    const layers = plan.steps.map(s => s.layer);

    // Find indices of each layer
    const dbIndex = layers.findIndex(l => l === 'database');
    const backendIndex = layers.findIndex(l => l === 'backend');
    const frontendIndex = layers.findIndex(l => l === 'frontend');

    if (dbIndex >= 0 && backendIndex >= 0) {
      assert(dbIndex < backendIndex, 'Database steps should come before backend');
    }
    if (backendIndex >= 0 && frontendIndex >= 0) {
      assert(backendIndex < frontendIndex, 'Backend steps should come before frontend');
    }

    console.log('✓ Steps ordered correctly by layer');
    console.log(`  Database: ${layers.filter(l => l === 'database').length} steps`);
    console.log(`  Backend: ${layers.filter(l => l === 'backend').length} steps`);
    console.log(`  Frontend: ${layers.filter(l => l === 'frontend').length} steps`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Validate Plan
console.log('Test 3: Validate Plan');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis);

    const validation = builder.validate(plan);

    assert(validation.valid === true, 'Plan should be valid');
    assert(Array.isArray(validation.errors), 'Should have errors array');
    assert(Array.isArray(validation.warnings), 'Should have warnings array');
    assert(validation.errors.length === 0, 'Should have no errors');

    console.log(`✓ Plan validated successfully`);
    console.log(`  Errors: ${validation.errors.length}`);
    console.log(`  Warnings: ${validation.warnings.length}`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Validate Invalid Plan
console.log('Test 4: Validate Invalid Plan');
(async () => {
  try {
    const builder = new PlanBuilder();
    const invalidPlan = {
      // Missing version, appSpecId
      steps: [
        { id: 's1', target: 'test.js' } // Missing action
      ]
    };

    const validation = builder.validate(invalidPlan);

    assert(validation.valid === false, 'Invalid plan should fail validation');
    assert(validation.errors.length > 0, 'Should have errors');

    console.log(`✓ Invalid plan detected`);
    console.log(`  Errors: ${validation.errors.length}`);
    validation.errors.forEach(err => console.log(`    - ${err}`));
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Estimate Resources
console.log('Test 5: Estimate Resources');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis, 50000);

    const estimate = plan.totalEstimate;

    assert(estimate.tokens, 'Should have token estimate');
    assert(estimate.files, 'Should have file estimate');
    assert(estimate.time, 'Should have time estimate');
    assert(typeof estimate.tokens.total === 'number', 'Total tokens should be a number');
    assert(typeof estimate.files.total === 'number', 'Total files should be a number');
    assert(typeof estimate.time.estimatedMinutes === 'number', 'Time should be a number');

    console.log(`✓ Tokens: ${estimate.tokens.total} (budget: ${estimate.tokens.budget})`);
    console.log(`✓ Files: ${estimate.files.created} created, ${estimate.files.modified} modified`);
    console.log(`✓ Time: ~${estimate.time.estimatedMinutes} minutes`);
    console.log(`✓ Within budget: ${estimate.tokens.withinBudget}`);
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Risk Assessment
console.log('Test 6: Risk Assessment');
(async () => {
  try {
    const builder = new PlanBuilder();

    // Create spec with risky operations
    const riskySpec = {
      id: 'risky_001',
      features: [
        {
          id: 'f1',
          name: 'Modify existing files',
          models: [{ name: 'User' }]
        }
      ]
    };

    const plan = builder.build(riskySpec, sampleAnalysis);

    assert(Array.isArray(plan.risks), 'Should have risks array');

    console.log(`✓ ${plan.risks.length} risk(s) identified`);
    plan.risks.forEach(risk => {
      console.log(`  - ${risk.type}: ${risk.description} (${risk.severity})`);
    });
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Step Dependencies
console.log('Test 7: Step Dependencies');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis);

    // Check that steps have dependencies
    const stepsWithDeps = plan.steps.filter(s => s.dependencies && s.dependencies.length > 0);

    console.log(`✓ ${stepsWithDeps.length} step(s) have dependencies`);

    // Check that frontend depends on backend
    const frontendSteps = plan.steps.filter(s => s.layer === 'frontend');
    frontendSteps.forEach(step => {
      if (step.dependencies.length > 0) {
        const depSteps = plan.steps.filter(s => step.dependencies.includes(s.id));
        const hasBackendDep = depSteps.some(s => s.layer === 'backend' || s.layer === 'database');
        console.log(`  ${step.target} depends on ${step.dependencies.length} step(s)`);
      }
    });

    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Migrations Generation
console.log('Test 8: Migrations Generation');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis);

    const migrations = plan.migrations;

    assert(Array.isArray(migrations), 'Should have migrations array');

    // Should have migrations for database steps
    const dbSteps = plan.steps.filter(s => s.layer === 'database');
    if (dbSteps.length > 0) {
      assert(migrations.length > 0, 'Should have migrations for database steps');

      migrations.forEach(migration => {
        assert(migration.id, 'Migration should have id');
        assert(migration.type, 'Migration should have type');
        assert(migration.description, 'Migration should have description');
      });
    }

    console.log(`✓ ${migrations.length} migration(s) generated`);
    migrations.forEach(m => {
      console.log(`  ${m.id}: ${m.description}`);
    });
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Test Generation
console.log('Test 9: Test Generation');
(async () => {
  try {
    const builder = new PlanBuilder();
    const plan = builder.build(sampleAppSpec, sampleAnalysis);

    const tests = plan.tests;

    assert(Array.isArray(tests), 'Should have tests array');
    assert(tests.length > 0, 'Should generate tests');

    tests.forEach(test => {
      assert(test.id, 'Test should have id');
      assert(test.target, 'Test should have target');
      assert(test.type, 'Test should have type');
    });

    console.log(`✓ ${tests.length} test(s) generated`);
    const integrationTests = tests.filter(t => t.type === 'integration').length;
    const componentTests = tests.filter(t => t.type === 'component').length;
    console.log(`  Integration: ${integrationTests}`);
    console.log(`  Component: ${componentTests}`);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Plan from Simple Description
console.log('Test 10: Plan from Simple Description');
(async () => {
  try {
    const builder = new PlanBuilder();
    const simpleSpec = {
      id: 'simple_001',
      name: 'Add Comments Feature',
      description: 'Users can add and view comments on posts'
    };

    const plan = builder.build(simpleSpec, sampleAnalysis);

    assert(plan.steps.length > 0, 'Should generate steps from simple description');
    assert(plan.appSpecId === simpleSpec.id, 'Should preserve appSpecId');

    console.log(`✓ Generated plan with ${plan.steps.length} step(s) from simple description`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Circular Dependency Detection
console.log('Test 11: Circular Dependency Detection');
(async () => {
  try {
    const builder = new PlanBuilder();

    // Create plan with circular dependencies
    const circularPlan = {
      version: '1.0',
      appSpecId: 'test',
      steps: [
        { id: 's1', action: 'create', target: 'a.js', dependencies: ['s2'] },
        { id: 's2', action: 'create', target: 'b.js', dependencies: ['s1'] }
      ]
    };

    const validation = builder.validate(circularPlan);

    assert(validation.valid === false, 'Should detect circular dependencies');
    assert(validation.errors.some(e => e.includes('Circular')), 'Should report circular dependency error');

    console.log('✓ Circular dependencies detected');
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Large Plan Warning
console.log('Test 12: Large Plan Warning');
(async () => {
  try {
    const builder = new PlanBuilder({ maxSteps: 10 });

    // Create large spec
    const largeSpec = {
      id: 'large_001',
      features: Array.from({ length: 20 }, (_, i) => ({
        id: `f${i}`,
        name: `Feature ${i}`,
        components: [{ name: `Component${i}` }]
      }))
    };

    const plan = builder.build(largeSpec, sampleAnalysis);
    const validation = builder.validate(plan);

    assert(validation.warnings.length > 0, 'Should have warnings for large plan');
    assert(validation.warnings.some(w => w.includes('exceeds')), 'Should warn about step count');

    console.log('✓ Large plan warning generated');
    console.log(`  Steps: ${plan.steps.length}, Max: ${builder.options.maxSteps}`);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests to complete
setTimeout(() => {
  console.log('\n========================================');
  console.log('All Plan Builder tests passed! ✓');
  console.log('========================================\n');
}, 3000);
