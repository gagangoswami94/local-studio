# Plan Builder System

> Generates step-by-step execution plans from application specifications

## Overview

The Plan Builder transforms high-level application specifications into detailed, ordered execution plans. It handles dependency resolution, risk assessment, resource estimation, and test generation.

## Core Features

- **Intelligent Step Generation** - Breaks features into granular implementation steps
- **Dependency Resolution** - Topological sorting with circular dependency detection
- **Layer Ordering** - Database → Backend → Frontend → Tests
- **Risk Assessment** - Identifies high-risk operations (deletions, migrations, modifications)
- **Resource Estimation** - Token usage, file counts, time estimates
- **Test Generation** - Automatic test plan creation
- **Plan Validation** - Comprehensive validation with detailed error reporting

## Usage

### Basic Usage

```javascript
const { PlanBuilder } = require('./agent/plan');

const builder = new PlanBuilder({
  maxSteps: 100,
  defaultRiskLevel: 'medium'
});

// Build plan from app specification
const plan = builder.build(appSpec, analysis, tokenBudget);

console.log(`Generated ${plan.steps.length} steps`);
console.log(`Estimated tokens: ${plan.totalEstimate.tokens.total}`);
console.log(`Risks: ${plan.risks.length}`);
```

### Validate Plan

```javascript
const validation = builder.validate(plan);

if (!validation.valid) {
  console.error('Plan validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:');
  validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}
```

### Estimate Resources

```javascript
const estimate = builder.estimate(plan);

console.log('Token Usage:');
console.log(`  Steps: ${estimate.tokens.steps}`);
console.log(`  Migrations: ${estimate.tokens.migrations}`);
console.log(`  Tests: ${estimate.tokens.tests}`);
console.log(`  Total: ${estimate.tokens.total}`);

console.log('Files:');
console.log(`  Created: ${estimate.files.created}`);
console.log(`  Modified: ${estimate.files.modified}`);
console.log(`  Deleted: ${estimate.files.deleted}`);

console.log(`Estimated time: ${estimate.time.estimatedMinutes} minutes`);
```

## App Specification Format

The Plan Builder accepts several appSpec formats:

### Format 1: Structured Features

```javascript
const appSpec = {
  id: 'app_001',
  name: 'User Authentication',
  description: 'Add user authentication system',
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
        { name: 'Login', props: ['onSubmit'] }
      ]
    }
  ]
};
```

### Format 2: Page-Based

```javascript
const appSpec = {
  id: 'app_002',
  name: 'Blog Platform',
  pages: [
    {
      name: 'Dashboard',
      components: ['Header', 'PostList', 'Sidebar'],
      routes: ['/dashboard']
    },
    {
      name: 'Post',
      components: ['PostDetail', 'Comments'],
      routes: ['/post/:id']
    }
  ]
};
```

### Format 3: Simple Description

```javascript
const appSpec = {
  id: 'app_003',
  name: 'Comments Feature',
  description: 'Users can add and view comments on posts'
};
```

## Plan Structure

```javascript
{
  version: '1.0',
  appSpecId: 'app_001',
  generatedAt: '2026-01-30T12:00:00.000Z',

  steps: [
    {
      id: 's1',
      featureId: 'f1',
      action: 'create',           // 'create' | 'modify' | 'delete'
      target: 'src/models/User.js',
      description: 'Create User model',
      layer: 'database',          // Layer for ordering
      dependencies: [],           // Step IDs this depends on
      estimatedTokens: 1500,
      riskLevel: 'low'           // 'low' | 'medium' | 'high'
    },
    {
      id: 's2',
      featureId: 'f2',
      action: 'create',
      target: 'src/routes/auth.js',
      description: 'Create auth routes',
      layer: 'backend',
      dependencies: ['s1'],       // Depends on User model
      estimatedTokens: 2000,
      riskLevel: 'low'
    }
  ],

  migrations: [
    {
      id: 'migration_1',
      type: 'create_table',
      description: 'Create table for User model',
      stepId: 's1',
      sql_forward: '-- SQL forward migration',
      sql_reverse: '-- SQL reverse migration',
      riskLevel: 'high'
    }
  ],

  tests: [
    {
      id: 'test_1',
      target: 'src/routes/auth.js',
      covers: 's2',
      type: 'integration',
      description: 'Test auth routes',
      priority: 'normal'
    }
  ],

  totalEstimate: {
    tokens: {
      steps: 10000,
      migrations: 1000,
      tests: 500,
      total: 11500,
      budget: 100000,
      withinBudget: true
    },
    files: {
      created: 4,
      modified: 0,
      deleted: 0,
      total: 4
    },
    time: {
      estimatedMinutes: 3,
      estimatedSeconds: 180
    }
  },

  risks: [
    {
      type: 'database_migration',
      description: '1 database migration(s) required',
      mitigation: 'Test migrations in development, backup production data',
      severity: 'high',
      affectedMigrations: ['migration_1']
    }
  ],

  metadata: {
    featuresCount: 3,
    stepsCount: 4,
    migrationsCount: 1,
    testsCount: 3
  }
}
```

## Step Ordering

The Plan Builder orders steps using a sophisticated multi-layer approach:

### 1. Layer-Based Ordering

Steps are grouped into layers with priority:

1. **Database** (Priority 1) - Models, schemas
2. **Backend** (Priority 2) - Routes, API, middleware
3. **Frontend** (Priority 3) - Components, pages
4. **General** (Priority 4) - Miscellaneous
5. **Test** (Priority 5) - Test files

### 2. Dependency Resolution

Within each layer, steps are topologically sorted by dependencies:

```javascript
// Example: Frontend depends on Backend
{
  id: 'frontend_step',
  dependencies: ['backend_step', 'model_step']
}
```

### 3. Circular Dependency Detection

The validator detects and reports circular dependencies:

```javascript
const validation = builder.validate(plan);
// Error: "Circular dependencies detected: s1 -> s2 -> s1"
```

## Risk Assessment

The Plan Builder identifies several risk categories:

### File Deletion (High Risk)

```javascript
{
  type: 'file_deletion',
  severity: 'high',
  description: '3 file(s) will be deleted',
  mitigation: 'Backup files before deletion, review carefully'
}
```

### File Modification (Medium Risk)

```javascript
{
  type: 'file_modification',
  severity: 'medium',
  description: '5 existing file(s) will be modified',
  mitigation: 'Review changes carefully, use version control'
}
```

### Database Migration (High Risk)

```javascript
{
  type: 'database_migration',
  severity: 'high',
  description: '2 database migration(s) required',
  mitigation: 'Test migrations in development, backup production data'
}
```

### Plan Complexity (Medium Risk)

```javascript
{
  type: 'complexity',
  severity: 'medium',
  description: 'Large plan with 75 steps',
  mitigation: 'Break into smaller sub-plans, incremental execution'
}
```

## Resource Estimation

### Token Estimation

```javascript
totalEstimate.tokens = {
  steps: 10000,          // Sum of all step tokens
  migrations: 1000,      // 1000 tokens per migration
  tests: 500,            // 500 tokens per test
  total: 11500,
  budget: 100000,
  withinBudget: true     // total <= budget
}
```

### File Estimation

```javascript
totalEstimate.files = {
  created: 4,            // New files
  modified: 0,           // Existing files changed
  deleted: 0,            // Files removed
  total: 4               // created + modified + deleted
}
```

### Time Estimation

```javascript
totalEstimate.time = {
  estimatedMinutes: 3,   // Rough estimate
  estimatedSeconds: 180  // Based on 30s per step + 60s per migration
}
```

## Validation

### Valid Plan

```javascript
{
  valid: true,
  errors: [],
  warnings: []
}
```

### Invalid Plan

```javascript
{
  valid: false,
  errors: [
    'Missing plan version',
    'Step 0: Missing action',
    'Circular dependencies detected: s1 -> s2 -> s1'
  ],
  warnings: [
    'Step count (75) exceeds recommended maximum (100)',
    'Missing total estimate'
  ]
}
```

## Advanced Usage

### Custom Step Generation

```javascript
const builder = new PlanBuilder();

// Override _generateStepsForFeature for custom logic
builder._generateStepsForFeature = function(feature, analysis) {
  // Custom step generation logic
  return customSteps;
};
```

### Custom Risk Assessment

```javascript
const builder = new PlanBuilder();

// Override _assessRisks for custom rules
builder._assessRisks = function(steps, migrations, analysis) {
  const risks = [];

  // Add custom risk checks
  if (steps.some(s => s.target.includes('critical'))) {
    risks.push({
      type: 'critical_file',
      severity: 'high',
      description: 'Modifying critical system files'
    });
  }

  return risks;
};
```

## Integration with Other Systems

### With ContextGatherer

```javascript
const { ContextGatherer } = require('../context');
const { PlanBuilder } = require('../plan');

// Gather workspace context
const gatherer = new ContextGatherer(workspacePath);
const context = await gatherer.gather(userRequest, 50000);

// Build plan with context
const builder = new PlanBuilder();
const plan = builder.build(appSpec, context.patterns, 100000);
```

### With AgentOrchestrator

```javascript
const { AgentOrchestrator } = require('../AgentOrchestrator');
const { PlanBuilder } = require('../plan');

// Generate plan
const builder = new PlanBuilder();
const plan = builder.build(appSpec, analysis);

// Execute plan with orchestrator
const orchestrator = new AgentOrchestrator(config);
await orchestrator.executePlan(plan);
```

## Testing

Run the comprehensive test suite:

```bash
node tests/plan/test-plan-builder.js
```

Tests cover:
- Plan generation from various spec formats
- Step ordering and dependency resolution
- Validation (valid and invalid plans)
- Resource estimation
- Risk assessment
- Circular dependency detection
- Migration generation
- Test generation

## Configuration Options

```javascript
const builder = new PlanBuilder({
  // Maximum steps before warning
  maxSteps: 100,

  // Default risk level for unclassified operations
  defaultRiskLevel: 'medium'
});
```

## Best Practices

1. **Validate plans before execution**
   ```javascript
   const validation = builder.validate(plan);
   if (!validation.valid) {
     throw new Error('Invalid plan');
   }
   ```

2. **Check token budget**
   ```javascript
   if (!plan.totalEstimate.tokens.withinBudget) {
     console.warn('Plan exceeds token budget');
   }
   ```

3. **Review high-risk operations**
   ```javascript
   const highRisks = plan.risks.filter(r => r.severity === 'high');
   if (highRisks.length > 0) {
     console.warn('High-risk operations detected');
   }
   ```

4. **Break large plans into sub-plans**
   ```javascript
   if (plan.steps.length > 50) {
     // Split by feature or layer
     const subPlans = splitPlanByFeature(plan);
   }
   ```

---

# Risk Assessor

> Evaluates potential risks in execution plans

## Overview

The Risk Assessor analyzes execution plans to identify risks, calculate risk scores, and determine if a plan is safe to auto-apply. It checks for breaking changes, data loss, security issues, performance problems, dependency issues, and migration risks.

## Core Features

- **Comprehensive Risk Detection** - Breaking changes, data loss, security, performance, dependencies, migrations
- **Weighted Risk Scoring** - 0-100 score based on severity and count
- **Auto-Apply Safety Rules** - Determines if plan can be applied automatically
- **Detailed Risk Reports** - Severity levels, mitigations, affected steps
- **Custom Thresholds** - Configurable risk levels and auto-apply rules

## Usage

### Basic Usage

```javascript
const { RiskAssessor } = require('./agent/plan');

const assessor = new RiskAssessor({
  autoApplyThreshold: 30,
  criticalThreshold: 70,
  highThreshold: 50,
  mediumThreshold: 30
});

// Assess plan
const report = assessor.assess(plan, analysis);

console.log(`Risk Score: ${report.overallScore}/100`);
console.log(`Risk Level: ${report.level}`);
console.log(`Safe to Auto-Apply: ${report.safeToAutoApply}`);

if (report.risks.length > 0) {
  console.log('Risks identified:');
  report.risks.forEach(risk => {
    console.log(`  - ${risk.description} (${risk.severity})`);
  });
}
```

### Integration with PlanBuilder

```javascript
const { PlanBuilder, RiskAssessor } = require('./agent/plan');

const builder = new PlanBuilder();
const assessor = new RiskAssessor();

// Generate plan
const plan = builder.build(appSpec, analysis);

// Assess risks
const riskReport = assessor.assess(plan, analysis);

if (riskReport.safeToAutoApply) {
  console.log('✓ Safe to execute automatically');
  // Execute plan
} else {
  console.log('⚠ Manual review required');
  console.log(`Reason: ${riskReport.recommendation}`);
}
```

## Risk Report Structure

```javascript
{
  overallScore: 45,              // 0-100
  level: 'medium',               // 'critical' | 'high' | 'medium' | 'low'
  risks: [
    {
      type: 'breaking_change',   // Risk category
      category: 'api',           // Subcategory
      severity: 'high',          // Impact level
      description: '2 API route(s) will be modified',
      impact: 'May break existing API consumers',
      mitigation: 'Version API endpoints, maintain backward compatibility',
      affectedSteps: ['s1', 's2'],
      score: 50                  // Individual risk score
    }
  ],
  warnings: [
    'Plan contains 2 high-risk operation(s)',
    'Breaking changes detected - coordinate with team'
  ],
  recommendation: 'Moderate risk - review carefully before execution',
  safeToAutoApply: false,
  metadata: {
    totalRisks: 5,
    criticalRisks: 1,
    highRisks: 2,
    mediumRisks: 2,
    lowRisks: 0
  }
}
```

## Risk Types

### 1. Breaking Changes

**API Changes:**
- Modifying route endpoints
- Changing request/response formats
- Severity: **High**

**Database Schema:**
- Altering table structure
- Dropping columns
- Changing column types
- Severity: **Critical**

**Component Interfaces:**
- Modifying component props
- Changing component APIs
- Severity: **Medium** (if > 3 components)

### 2. Data Loss

**File Deletions:**
- Deleting source files
- Severity: **High** (1-5 files), **Critical** (>5 files)

**Drop Tables:**
- Permanent loss of database tables
- Severity: **Critical**

**Drop Columns:**
- Loss of column data
- Severity: **High**

### 3. Security Risks

**Authentication:**
- Changes to login/session handling
- Severity: **High**

**Authorization:**
- Permission/role modifications
- Severity: **High**

**Sensitive Data:**
- Password, secret, key, token handling
- Severity: **Medium**

### 4. Performance Risks

**Database Operations:**
- > 10 database steps
- Severity: **Medium**

**Complexity:**
- > 50 total steps
- Severity: **Medium**

**Token Usage:**
- > 80,000 tokens
- Severity: **Low**

### 5. Dependency Risks

**Circular Dependencies:**
- Steps depend on each other in a loop
- Severity: **High**

**Missing Dependencies:**
- Steps reference non-existent dependencies
- Severity: **Medium**

**Complex Dependencies:**
- Steps with > 5 dependencies
- Severity: **Low**

### 6. Migration Risks

**Many Migrations:**
- > 5 migrations in plan
- Severity: **Medium**

**No Rollback:**
- Migrations without reverse SQL
- Severity: **High**

**Destructive Migrations:**
- Drop table, drop column, truncate
- Severity: **Critical**

## Risk Scoring

### Score Calculation

```javascript
// Severity weights
critical: 4
high: 3
medium: 2
low: 1

// Weighted average
weightedScore = Σ(risk.score × severityWeight) / Σ(severityWeight)

// Count multiplier (more risks = higher score)
countMultiplier = min(1 + (riskCount × 0.05), 1.5)

// Final score
overallScore = min(weightedScore × countMultiplier, 100)
```

### Risk Levels

```javascript
Score >= 70: Critical  // Extreme caution required
Score >= 50: High      // Manual review required
Score >= 30: Medium    // Standard review recommended
Score < 30:  Low       // Safe to proceed
```

## Auto-Apply Rules

A plan is safe to auto-apply if **ALL** conditions are met:

1. ✓ Overall score < 30 (default threshold)
2. ✓ No critical or high severity risks
3. ✓ No data loss risks
4. ✓ No breaking change risks

```javascript
const assessor = new RiskAssessor({ autoApplyThreshold: 30 });
const report = assessor.assess(plan);

if (report.safeToAutoApply) {
  // Execute automatically
  await executor.execute(plan);
} else {
  // Request user approval
  await ui.showApprovalDialog(report);
}
```

## Methods

### assess(plan, analysis)

Main assessment method. Returns complete risk report.

```javascript
const report = assessor.assess(plan, analysis);
```

### checkBreakingChanges(plan, analysis)

Identifies API, database, and UI breaking changes.

```javascript
const risks = assessor.checkBreakingChanges(plan, analysis);
```

### checkDataLoss(plan)

Detects file deletions and destructive migrations.

```javascript
const risks = assessor.checkDataLoss(plan);
```

### checkSecurityRisks(plan)

Finds authentication, authorization, and sensitive data issues.

```javascript
const risks = assessor.checkSecurityRisks(plan);
```

### checkPerformanceRisks(plan)

Identifies complexity and resource usage concerns.

```javascript
const risks = assessor.checkPerformanceRisks(plan);
```

### checkDependencyRisks(plan, analysis)

Detects circular, missing, and complex dependencies.

```javascript
const risks = assessor.checkDependencyRisks(plan, analysis);
```

### checkMigrationRisks(plan)

Evaluates migration complexity, rollback, and destructiveness.

```javascript
const risks = assessor.checkMigrationRisks(plan);
```

### calculateRiskScore(risks)

Computes weighted score from risk array.

```javascript
const score = assessor.calculateRiskScore(risks);
// Returns 0-100
```

## Configuration

```javascript
const assessor = new RiskAssessor({
  // Score below this = safe to auto-apply
  autoApplyThreshold: 30,

  // Risk level thresholds
  criticalThreshold: 70,
  highThreshold: 50,
  mediumThreshold: 30
});
```

## Testing

Run the comprehensive test suite:

```bash
node tests/plan/test-risk-assessor.js
```

Tests cover:
- Safe and risky plan assessment
- All risk category checks
- Score calculation
- Auto-apply rules
- Custom thresholds
- Integration with PlanBuilder

## Best Practices

1. **Always assess before execution**
   ```javascript
   const report = assessor.assess(plan);
   if (!report.safeToAutoApply) {
     await getUserApproval(report);
   }
   ```

2. **Review high-risk operations**
   ```javascript
   const highRisks = report.risks.filter(r =>
     r.severity === 'high' || r.severity === 'critical'
   );
   if (highRisks.length > 0) {
     console.warn('High-risk operations require manual review');
   }
   ```

3. **Show mitigation strategies**
   ```javascript
   report.risks.forEach(risk => {
     console.log(`Risk: ${risk.description}`);
     console.log(`Mitigation: ${risk.mitigation}`);
   });
   ```

4. **Adjust thresholds per environment**
   ```javascript
   const prodAssessor = new RiskAssessor({
     autoApplyThreshold: 10,  // Stricter for production
     criticalThreshold: 40
   });

   const devAssessor = new RiskAssessor({
     autoApplyThreshold: 50   // More lenient for development
   });
   ```

---

## Future Enhancements

- [ ] Parallel execution groups (independent steps run together)
- [ ] Rollback plan generation
- [ ] Dependency graph visualization
- [ ] Step cost estimation per file
- [ ] Integration with CI/CD pipelines
- [ ] Plan templates for common patterns
- [ ] Machine learning-based time estimation
- [ ] Historical risk analysis and learning
- [ ] Environment-specific risk profiles
- [ ] Risk trend tracking over time
