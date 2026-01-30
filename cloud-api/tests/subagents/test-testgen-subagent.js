/**
 * Test TestGenSubAgent
 */

const assert = require('assert');
const TestGenSubAgent = require('../../src/agent/subagents/TestGenSubAgent');

console.log('Testing TestGenSubAgent...\n');

// Mock orchestrator
const mockOrchestrator = {
  logger: {
    info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
    debug: (msg, meta) => {} // Silent
  }
};

// Test 1: Create TestGenSubAgent
console.log('Test 1: Create TestGenSubAgent');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator, { tokenBudget: 15000 });

    assert(agent.name === 'TestGen', 'Agent name should be TestGen');
    assert(agent.tokenBudget === 15000, 'Token budget should be 15000');
    assert(agent.defaultFramework === 'vitest', 'Default framework should be vitest');

    console.log('✓ TestGenSubAgent created');
    console.log('  Name:', agent.name);
    console.log('  Budget:', agent.tokenBudget);
    console.log('  Default Framework:', agent.defaultFramework);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Analyze Simple Function Code
console.log('Test 2: Analyze Simple Function Code');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const sourceCode = `
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}
`;

    const analysis = agent.analyzeCode(sourceCode, 'math.js');

    assert(analysis.functions.length === 2, 'Should find 2 functions');
    assert(analysis.functions[0].name === 'add', 'First function should be add');
    assert(analysis.functions[1].name === 'subtract', 'Second function should be subtract');
    assert(analysis.exports.length === 2, 'Should find 2 exports');

    console.log('✓ Simple function analysis working');
    console.log('  Functions found:', analysis.functions.length);
    console.log('  Exports found:', analysis.exports.length);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Analyze Async Functions
console.log('Test 3: Analyze Async Functions');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const sourceCode = `
export async function fetchUser(id) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}

export const saveUser = async (user) => {
  const response = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
  return response.json();
};
`;

    const analysis = agent.analyzeCode(sourceCode, 'api.js');

    assert(analysis.functions.length === 2, 'Should find 2 functions');
    assert(analysis.functions[0].isAsync === true, 'First function should be async');
    assert(analysis.functions[1].isAsync === true, 'Second function should be async');
    assert(analysis.hasAsync === true, 'Should detect async functions');

    console.log('✓ Async function analysis working');
    console.log('  Async functions found:', analysis.functions.filter(f => f.isAsync).length);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Analyze Class Code
console.log('Test 4: Analyze Class Code');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const sourceCode = `
export class Calculator {
  add(a, b) {
    return a + b;
  }

  subtract(a, b) {
    return a - b;
  }

  async fetchResult(a, b) {
    return this.add(a, b);
  }
}
`;

    const analysis = agent.analyzeCode(sourceCode, 'Calculator.js');

    assert(analysis.classes.length === 1, 'Should find 1 class');
    assert(analysis.classes[0].name === 'Calculator', 'Class should be Calculator');
    assert(analysis.classes[0].methods.length === 3, 'Should find 3 methods');

    const asyncMethods = analysis.classes[0].methods.filter(m => m.isAsync);
    assert(asyncMethods.length === 1, 'Should find 1 async method');

    console.log('✓ Class analysis working');
    console.log('  Classes found:', analysis.classes.length);
    console.log('  Methods found:', analysis.classes[0].methods.length);
    console.log('  Async methods:', asyncMethods.length);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Analyze Dependencies
console.log('Test 5: Analyze Dependencies');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const sourceCode = `
import axios from 'axios';
import { useState } from 'react';
import lodash from 'lodash';
import './styles.css';  // Should be ignored (relative import)

export async function fetchData() {
  const response = await axios.get('/api/data');
  return response.data;
}
`;

    const analysis = agent.analyzeCode(sourceCode, 'api.js');

    assert(analysis.dependencies.length === 3, 'Should find 3 external dependencies');
    assert(analysis.dependencies.includes('axios'), 'Should include axios');
    assert(analysis.dependencies.includes('react'), 'Should include react');
    assert(analysis.dependencies.includes('lodash'), 'Should include lodash');
    assert(!analysis.dependencies.includes('./styles.css'), 'Should not include relative imports');

    console.log('✓ Dependency analysis working');
    console.log('  Dependencies found:', analysis.dependencies);
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Detect React Component
console.log('Test 6: Detect React Component');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const reactCode = `
import React from 'react';

export const Button = ({ label, onClick }) => {
  return (
    <button onClick={onClick}>
      {label}
    </button>
  );
};
`;

    const nonReactCode = `
export function add(a, b) {
  return a + b;
}
`;

    assert(agent.isReactComponent(reactCode) === true, 'Should detect React component');
    assert(agent.isReactComponent(nonReactCode) === false, 'Should not detect non-React code');

    console.log('✓ React component detection working');
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Framework Detection
console.log('Test 7: Framework Detection');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    // Test with vitest
    const vitestContext = {
      patterns: {
        testingFrameworks: [{ name: 'Vitest', version: '^0.34.0' }]
      }
    };
    assert(agent.detectTestFramework(vitestContext) === 'vitest', 'Should detect vitest');

    // Test with jest
    const jestContext = {
      patterns: {
        testingFrameworks: [{ name: 'Jest', version: '^29.0.0' }]
      }
    };
    assert(agent.detectTestFramework(jestContext) === 'jest', 'Should detect jest');

    // Test with mocha
    const mochaContext = {
      patterns: {
        testingFrameworks: [{ name: 'Mocha', version: '^10.0.0' }]
      }
    };
    assert(agent.detectTestFramework(mochaContext) === 'mocha', 'Should detect mocha');

    // Test default
    const emptyContext = {};
    assert(agent.detectTestFramework(emptyContext) === 'vitest', 'Should default to vitest');

    console.log('✓ Framework detection working');
    console.log('  Vitest: ✓');
    console.log('  Jest: ✓');
    console.log('  Mocha: ✓');
    console.log('  Default: vitest ✓');
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Get Framework Imports
console.log('Test 8: Get Framework Imports');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const vitestImports = agent.getFrameworkImports('vitest');
    assert(vitestImports.includes('vitest'), 'Vitest imports should include vitest');
    assert(vitestImports.includes('describe'), 'Should include describe');
    assert(vitestImports.includes('it'), 'Should include it');
    assert(vitestImports.includes('expect'), 'Should include expect');

    const jestImports = agent.getFrameworkImports('jest');
    assert(jestImports.includes('jest'), 'Jest imports should include jest');

    const mochaImports = agent.getFrameworkImports('mocha');
    assert(mochaImports.includes('mocha'), 'Mocha imports should include mocha');
    assert(mochaImports.includes('chai'), 'Should include chai');

    console.log('✓ Framework imports working');
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Get Test File Path
console.log('Test 9: Get Test File Path');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    // Test __tests__ pattern (default)
    const path1 = agent.getTestFilePath('src/utils/helper.js');
    assert(path1.includes('__tests__'), 'Should use __tests__ directory');
    assert(path1.includes('helper.test.js'), 'Should have .test.js extension');

    // Test with custom pattern
    const customContext = {
      testPathPattern: 'tests/{file}'
    };
    const path2 = agent.getTestFilePath('src/utils/helper.js', customContext);
    assert(path2 === 'tests/src/utils/helper.js', 'Should use custom pattern');

    console.log('✓ Test file path generation working');
    console.log('  Default pattern:', path1);
    console.log('  Custom pattern:', path2);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: System Prompt Generation
console.log('Test 10: System Prompt Generation');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const vitestPrompt = agent.getSystemPrompt('vitest');
    assert(vitestPrompt.includes('vitest'), 'Should mention vitest');
    assert(vitestPrompt.includes('expert test writer'), 'Should have expert instruction');
    assert(vitestPrompt.includes('90% code coverage'), 'Should mention coverage goal');

    const jestPrompt = agent.getSystemPrompt('jest');
    assert(jestPrompt.includes('jest'), 'Should mention jest');
    assert(jestPrompt.includes('describe/test'), 'Should mention jest test structure');

    console.log('✓ System prompt generation working');
    console.log(`  Vitest prompt length: ${vitestPrompt.length} chars`);
    console.log(`  Jest prompt length: ${jestPrompt.length} chars`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Build Prompt
console.log('Test 11: Build Prompt');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const step = {
      id: 's1',
      action: 'create',
      target: 'src/utils/math.js',
      description: 'Math utility functions'
    };

    const sourceCode = `
export function add(a, b) {
  return a + b;
}
`;

    const context = {
      patterns: {
        testingFrameworks: [{ name: 'Vitest' }]
      }
    };

    const analysis = agent.analyzeCode(sourceCode, step.target);
    const prompt = agent.buildPrompt(step, context, sourceCode, analysis, 'vitest');

    assert(prompt.includes('src/utils/math.js'), 'Should include target file');
    assert(prompt.includes('vitest'), 'Should mention framework');
    assert(prompt.includes('add'), 'Should mention function to test');
    assert(prompt.includes('Happy Path Tests'), 'Should include test requirements');
    assert(prompt.includes('Error Case Tests'), 'Should include error tests');
    assert(prompt.includes('Edge Case Tests'), 'Should include edge cases');

    console.log('✓ Prompt building working');
    console.log(`  Prompt length: ${prompt.length} chars`);
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Analyze Test Coverage
console.log('Test 12: Analyze Test Coverage');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    const testCode = `
import { describe, it, expect, vi } from 'vitest';
import { add, subtract } from './math.js';

describe('Math utilities', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(add(-2, 3)).toBe(1);
  });

  it('should subtract two numbers correctly', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});
`;

    const analysis = {
      functions: [
        { name: 'add', isAsync: false },
        { name: 'subtract', isAsync: false }
      ],
      classes: [],
      exports: ['add', 'subtract']
    };

    const coverage = agent.analyzeTestCoverage(testCode, analysis);

    assert(coverage.testCount === 3, 'Should count 3 tests');
    assert(coverage.hasAssertions === true, 'Should detect assertions');
    assert(coverage.coveredFunctions.includes('add'), 'Should cover add function');
    assert(coverage.coveredFunctions.includes('subtract'), 'Should cover subtract function');
    assert(coverage.percentage === 100, 'Should have 100% coverage');

    console.log('✓ Test coverage analysis working');
    console.log('  Test count:', coverage.testCount);
    console.log('  Coverage:', coverage.percentage + '%');
    console.log('  Covered functions:', coverage.coveredFunctions);
    console.log('  Quality:', coverage.quality);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Test 13: Assess Test Quality
console.log('Test 13: Assess Test Quality');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    // Excellent quality (coverage >= 90%, testCount >= totalItems * 3, hasMocks)
    const excellent = agent.assessTestQuality(15, 5, 5, true, true);
    assert(excellent === 'excellent', 'Should be excellent quality');

    // Good quality (coverage >= 75%, testCount >= totalItems * 2)
    const good = agent.assessTestQuality(10, 4, 5, true, true);
    assert(good === 'good', 'Should be good quality');

    // Basic quality (coverage >= 50%, testCount >= totalItems)
    const basic = agent.assessTestQuality(5, 3, 5, true, false);
    assert(basic === 'basic', 'Should be basic quality');

    // Insufficient quality
    const insufficient = agent.assessTestQuality(0, 0, 5, false, false);
    assert(insufficient === 'insufficient', 'Should be insufficient quality');

    console.log('✓ Test quality assessment working');
    console.log('  Excellent: ✓');
    console.log('  Good: ✓');
    console.log('  Basic: ✓');
    console.log('  Insufficient: ✓');
    console.log('✓ Test 13 passed\n');
  } catch (error) {
    console.error('✗ Test 13 failed:', error.message);
    process.exit(1);
  }
})();

// Test 14: Fallback Analysis
console.log('Test 14: Fallback Analysis');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);

    // Invalid syntax that will trigger fallback
    const invalidCode = `
export function add(a, b) {
  return a + b;
}

export const subtract = (a, b) => {
  return a - b;
};

export class Calculator {
  multiply(a, b) {
    return a * b;
  }
}
`;

    const analysis = {
      functions: [],
      classes: [],
      exports: [],
      dependencies: [],
      hasAsync: false
    };

    agent.fallbackAnalysis(invalidCode, analysis);

    assert(analysis.functions.length > 0, 'Should find functions');
    assert(analysis.classes.length > 0, 'Should find classes');

    console.log('✓ Fallback analysis working');
    console.log('  Functions found:', analysis.functions.length);
    console.log('  Classes found:', analysis.classes.length);
    console.log('✓ Test 14 passed\n');
  } catch (error) {
    console.error('✗ Test 14 failed:', error.message);
    process.exit(1);
  }
})();

// Test 15: Get Supported Patterns
console.log('Test 15: Get Supported Patterns');
(async () => {
  try {
    const agent = new TestGenSubAgent(mockOrchestrator);
    const patterns = agent.getSupportedPatterns();

    assert(patterns.includes('*.test.js'), 'Should support .test.js');
    assert(patterns.includes('*.spec.ts'), 'Should support .spec.ts');
    assert(patterns.includes('__tests__/*.js'), 'Should support __tests__ pattern');

    console.log('✓ Supported patterns:');
    console.log(`  ${patterns.join(', ')}`);
    console.log('✓ Test 15 passed\n');
  } catch (error) {
    console.error('✗ Test 15 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  console.log('\n========================================');
  console.log('All TestGenSubAgent Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Summary:');
  console.log('- Agent initialization: ✓');
  console.log('- Code analysis (functions, classes, async): ✓');
  console.log('- Dependency extraction: ✓');
  console.log('- React component detection: ✓');
  console.log('- Framework detection: ✓');
  console.log('- System prompt generation: ✓');
  console.log('- Prompt building: ✓');
  console.log('- Test file path generation: ✓');
  console.log('- Coverage analysis: ✓');
  console.log('- Quality assessment: ✓');
  console.log('- Fallback analysis: ✓');
  console.log('- Supported patterns: ✓');
  console.log('\nTestGenSubAgent ready for use!');
}, 1000);
