const assert = require('assert');
const RiskAssessor = require('../../src/agent/plan/RiskAssessor');
const PlanBuilder = require('../../src/agent/plan/PlanBuilder');

/**
 * Test Risk Assessor
 */

console.log('Testing Risk Assessor...\n');

// Sample plans for testing
const safePlan = {
  version: '1.0',
  appSpecId: 'safe_plan',
  steps: [
    {
      id: 's1',
      action: 'create',
      target: 'src/components/Button.jsx',
      layer: 'frontend',
      dependencies: [],
      estimatedTokens: 1500,
      riskLevel: 'low'
    },
    {
      id: 's2',
      action: 'create',
      target: 'src/components/Input.jsx',
      layer: 'frontend',
      dependencies: [],
      estimatedTokens: 1500,
      riskLevel: 'low'
    }
  ],
  migrations: [],
  totalEstimate: {
    tokens: { total: 3000, budget: 100000, withinBudget: true }
  }
};

const riskyPlan = {
  version: '1.0',
  appSpecId: 'risky_plan',
  steps: [
    {
      id: 's1',
      action: 'delete',
      target: 'src/models/User.js',
      layer: 'database',
      dependencies: [],
      riskLevel: 'high'
    },
    {
      id: 's2',
      action: 'modify',
      target: 'src/routes/auth.js',
      layer: 'backend',
      dependencies: ['s1'],
      riskLevel: 'high'
    },
    {
      id: 's3',
      action: 'modify',
      target: 'src/components/Login.jsx',
      layer: 'frontend',
      dependencies: ['s2'],
      riskLevel: 'medium'
    }
  ],
  migrations: [
    {
      id: 'migration_1',
      type: 'drop_table',
      description: 'Drop users table',
      sql_forward: 'DROP TABLE users;',
      sql_reverse: '',
      riskLevel: 'critical'
    },
    {
      id: 'migration_2',
      type: 'alter_table',
      description: 'Change email column type',
      sql_forward: 'ALTER TABLE accounts MODIFY email VARCHAR(500);',
      sql_reverse: 'ALTER TABLE accounts MODIFY email VARCHAR(255);',
      riskLevel: 'high'
    }
  ],
  totalEstimate: {
    tokens: { total: 5000, budget: 100000, withinBudget: true }
  }
};

const circularPlan = {
  version: '1.0',
  appSpecId: 'circular_plan',
  steps: [
    {
      id: 's1',
      action: 'create',
      target: 'a.js',
      dependencies: ['s2']
    },
    {
      id: 's2',
      action: 'create',
      target: 'b.js',
      dependencies: ['s3']
    },
    {
      id: 's3',
      action: 'create',
      target: 'c.js',
      dependencies: ['s1']
    }
  ],
  migrations: []
};

// Test 1: Assess Safe Plan
console.log('Test 1: Assess Safe Plan');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const report = assessor.assess(safePlan);

    assert(report, 'Should return risk report');
    assert(typeof report.overallScore === 'number', 'Should have overall score');
    assert(report.level, 'Should have risk level');
    assert(Array.isArray(report.risks), 'Should have risks array');
    assert(Array.isArray(report.warnings), 'Should have warnings array');
    assert(typeof report.safeToAutoApply === 'boolean', 'Should have safeToAutoApply flag');

    console.log(`✓ Overall Score: ${report.overallScore}/100`);
    console.log(`✓ Risk Level: ${report.level}`);
    console.log(`✓ Total Risks: ${report.risks.length}`);
    console.log(`✓ Safe to Auto-Apply: ${report.safeToAutoApply}`);
    assert(report.safeToAutoApply === true, 'Safe plan should be auto-appliable');
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Assess Risky Plan
console.log('Test 2: Assess Risky Plan');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const report = assessor.assess(riskyPlan);

    assert(report.overallScore > 50, 'Risky plan should have high score');
    assert(['high', 'critical'].includes(report.level), 'Should have high or critical level');
    assert(report.risks.length > 0, 'Should identify risks');
    assert(report.safeToAutoApply === false, 'Risky plan should NOT be auto-appliable');
    assert(report.warnings.length > 0, 'Should have warnings');

    console.log(`✓ Overall Score: ${report.overallScore}/100`);
    console.log(`✓ Risk Level: ${report.level}`);
    console.log(`✓ Total Risks: ${report.risks.length}`);
    console.log(`✓ Warnings: ${report.warnings.length}`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Check Breaking Changes
console.log('Test 3: Check Breaking Changes');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const risks = assessor.checkBreakingChanges(riskyPlan, {});

    assert(Array.isArray(risks), 'Should return risks array');
    assert(risks.length > 0, 'Should detect breaking changes');

    const apiRisk = risks.find(r => r.category === 'api');
    const dbRisk = risks.find(r => r.category === 'database');

    if (apiRisk) {
      console.log(`✓ Detected API breaking change: ${apiRisk.description}`);
    }
    if (dbRisk) {
      console.log(`✓ Detected DB breaking change: ${dbRisk.description}`);
    }

    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Check Data Loss
console.log('Test 4: Check Data Loss');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const risks = assessor.checkDataLoss(riskyPlan);

    assert(Array.isArray(risks), 'Should return risks array');
    assert(risks.length > 0, 'Should detect data loss risks');

    const fileDeletion = risks.find(r => r.category === 'file_deletion');
    const dropTable = risks.find(r => r.category === 'database' && r.type === 'data_loss');

    assert(fileDeletion, 'Should detect file deletion risk');
    assert(dropTable, 'Should detect drop table risk');

    console.log(`✓ Detected ${risks.length} data loss risk(s)`);
    risks.forEach(r => {
      console.log(`  - ${r.description} (${r.severity})`);
    });
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Check Security Risks
console.log('Test 5: Check Security Risks');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const risks = assessor.checkSecurityRisks(riskyPlan);

    assert(Array.isArray(risks), 'Should return risks array');
    assert(risks.length > 0, 'Should detect security risks');

    const authRisk = risks.find(r => r.category === 'authentication');
    assert(authRisk, 'Should detect authentication risk');

    console.log(`✓ Detected ${risks.length} security risk(s)`);
    console.log(`  - ${authRisk.description} (${authRisk.severity})`);
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Check Performance Risks
console.log('Test 6: Check Performance Risks');
(async () => {
  try {
    const assessor = new RiskAssessor();

    // Create plan with many steps
    const largePlan = {
      ...safePlan,
      steps: Array.from({ length: 60 }, (_, i) => ({
        id: `s${i}`,
        action: 'create',
        target: `file${i}.js`,
        layer: 'frontend'
      }))
    };

    const risks = assessor.checkPerformanceRisks(largePlan);

    assert(Array.isArray(risks), 'Should return risks array');
    assert(risks.length > 0, 'Should detect performance risks');

    const complexityRisk = risks.find(r => r.category === 'complexity');
    assert(complexityRisk, 'Should detect complexity risk');

    console.log(`✓ Detected ${risks.length} performance risk(s)`);
    console.log(`  - ${complexityRisk.description}`);
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Check Dependency Risks
console.log('Test 7: Check Dependency Risks');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const risks = assessor.checkDependencyRisks(circularPlan, {});

    assert(Array.isArray(risks), 'Should return risks array');
    assert(risks.length > 0, 'Should detect dependency risks');

    const circularRisk = risks.find(r => r.category === 'circular');
    assert(circularRisk, 'Should detect circular dependencies');

    console.log(`✓ Detected ${risks.length} dependency risk(s)`);
    console.log(`  - ${circularRisk.description}`);
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Check Migration Risks
console.log('Test 8: Check Migration Risks');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const risks = assessor.checkMigrationRisks(riskyPlan);

    assert(Array.isArray(risks), 'Should return risks array');
    assert(risks.length > 0, 'Should detect migration risks');

    const destructiveRisk = risks.find(r => r.category === 'destructive');
    const rollbackRisk = risks.find(r => r.category === 'rollback');

    assert(destructiveRisk, 'Should detect destructive migrations');
    assert(rollbackRisk, 'Should detect missing rollback');

    console.log(`✓ Detected ${risks.length} migration risk(s)`);
    risks.forEach(r => {
      console.log(`  - ${r.description} (${r.severity})`);
    });
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Calculate Risk Score
console.log('Test 9: Calculate Risk Score');
(async () => {
  try {
    const assessor = new RiskAssessor();

    const lowRisks = [
      { severity: 'low', score: 10 },
      { severity: 'low', score: 15 }
    ];

    const highRisks = [
      { severity: 'critical', score: 90 },
      { severity: 'high', score: 70 },
      { severity: 'medium', score: 40 }
    ];

    const lowScore = assessor.calculateRiskScore(lowRisks);
    const highScore = assessor.calculateRiskScore(highRisks);

    assert(typeof lowScore === 'number', 'Should return number');
    assert(lowScore >= 0 && lowScore <= 100, 'Score should be 0-100');
    assert(lowScore < highScore, 'High risks should score higher');

    console.log(`✓ Low risk score: ${lowScore}/100`);
    console.log(`✓ High risk score: ${highScore}/100`);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Auto-Apply Rules
console.log('Test 10: Auto-Apply Rules');
(async () => {
  try {
    const assessor = new RiskAssessor({ autoApplyThreshold: 30 });

    // Safe plan - should be auto-appliable
    const safeReport = assessor.assess(safePlan);
    assert(safeReport.safeToAutoApply === true, 'Safe plan should be auto-appliable');

    // Risky plan - should NOT be auto-appliable
    const riskyReport = assessor.assess(riskyPlan);
    assert(riskyReport.safeToAutoApply === false, 'Risky plan should NOT be auto-appliable');

    console.log(`✓ Safe plan: auto-apply = ${safeReport.safeToAutoApply}`);
    console.log(`✓ Risky plan: auto-apply = ${riskyReport.safeToAutoApply}`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Risk Report Metadata
console.log('Test 11: Risk Report Metadata');
(async () => {
  try {
    const assessor = new RiskAssessor();
    const report = assessor.assess(riskyPlan);

    assert(report.metadata, 'Should have metadata');
    assert(typeof report.metadata.totalRisks === 'number', 'Should have total risks count');
    assert(typeof report.metadata.criticalRisks === 'number', 'Should have critical risks count');
    assert(typeof report.metadata.highRisks === 'number', 'Should have high risks count');

    console.log(`✓ Total Risks: ${report.metadata.totalRisks}`);
    console.log(`✓ Critical: ${report.metadata.criticalRisks}`);
    console.log(`✓ High: ${report.metadata.highRisks}`);
    console.log(`✓ Medium: ${report.metadata.mediumRisks}`);
    console.log(`✓ Low: ${report.metadata.lowRisks}`);
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Integration with PlanBuilder
console.log('Test 12: Integration with PlanBuilder');
(async () => {
  try {
    const builder = new PlanBuilder();
    const assessor = new RiskAssessor();

    const appSpec = {
      id: 'test_app',
      name: 'Test App',
      features: [
        {
          id: 'f1',
          name: 'User Model',
          type: 'model',
          models: [{ name: 'User', fields: ['email', 'password'] }]
        },
        {
          id: 'f2',
          name: 'Auth Routes',
          type: 'api',
          routes: [{ name: 'auth', methods: ['POST /login'] }]
        }
      ]
    };

    const plan = builder.build(appSpec);
    const report = assessor.assess(plan);

    assert(report, 'Should assess plan from PlanBuilder');
    assert(typeof report.overallScore === 'number', 'Should have score');

    console.log(`✓ Generated plan with ${plan.steps.length} steps`);
    console.log(`✓ Risk score: ${report.overallScore}/100`);
    console.log(`✓ Risk level: ${report.level}`);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Test 13: Custom Thresholds
console.log('Test 13: Custom Thresholds');
(async () => {
  try {
    const strictAssessor = new RiskAssessor({
      autoApplyThreshold: 10,
      criticalThreshold: 40,
      highThreshold: 30,
      mediumThreshold: 20
    });

    const report = strictAssessor.assess(safePlan);

    assert(report, 'Should work with custom thresholds');
    console.log(`✓ Custom thresholds applied`);
    console.log(`✓ Risk level: ${report.level}`);
    console.log('✓ Test 13 passed\n');
  } catch (error) {
    console.error('✗ Test 13 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests to complete
setTimeout(() => {
  console.log('\n========================================');
  console.log('All Risk Assessor tests passed! ✓');
  console.log('========================================\n');
}, 3000);
