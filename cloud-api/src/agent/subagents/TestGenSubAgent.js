/**
 * Test Generation Sub-Agent
 * Generates comprehensive test files with high coverage
 */

const BaseSubAgent = require('./BaseSubAgent');
const { parse } = require('@babel/parser');
const path = require('path');

class TestGenSubAgent extends BaseSubAgent {
  constructor(orchestrator, config = {}) {
    super(orchestrator, {
      name: 'TestGen',
      tokenBudget: config.tokenBudget || 15000,
      ...config
    });

    this.defaultFramework = 'vitest';
  }

  /**
   * Execute test generation task
   * @param {Object} step - Step to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Generation result
   */
  async execute(step, context = {}) {
    this.log('info', `Executing test generation for ${step.target}`, { stepId: step.id });

    // Validate step
    const validation = this.validateTask(step);
    if (!validation.valid) {
      throw new Error(`Invalid task: ${validation.errors.join(', ')}`);
    }

    this.emitProgress({
      type: 'step_start',
      stepId: step.id,
      action: step.action,
      target: step.target
    });

    try {
      // Get source code to test
      const sourceCode = context.sourceCode || step.sourceCode;
      if (!sourceCode) {
        throw new Error('No source code provided to generate tests for');
      }

      // Detect or use provided test framework
      const framework = this.detectTestFramework(context);

      // Analyze the source code
      this.emitProgress({
        type: 'analyzing_code',
        stepId: step.id,
        framework
      });

      const analysis = this.analyzeCode(sourceCode, step.target);

      // Build prompt for test generation
      const prompt = this.buildPrompt(step, context, sourceCode, analysis, framework);

      // Call AI to generate tests
      this.emitProgress({
        type: 'generating_tests',
        stepId: step.id,
        functionsToTest: analysis.functions.length,
        classesToTest: analysis.classes.length
      });

      const response = await this.callAI([
        {
          role: 'user',
          content: prompt
        }
      ], {
        system: this.getSystemPrompt(framework)
      });

      // Extract test code from response
      const codeBlocks = this.extractCodeBlocks(response.content);

      let testCode = response.content;
      if (codeBlocks.length > 0) {
        testCode = codeBlocks[0].code;
      }

      // Analyze test coverage
      const coverage = this.analyzeTestCoverage(testCode, analysis);

      this.emitProgress({
        type: 'step_complete',
        stepId: step.id,
        testsGenerated: coverage.testCount,
        coverage: coverage.percentage,
        framework
      });

      return {
        success: true,
        stepId: step.id,
        sourceFile: step.target,
        testFile: this.getTestFilePath(step.target, context),
        content: testCode,
        framework,
        coveredFunctions: coverage.coveredFunctions,
        coverage,
        analysis,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        },
        model: response.model
      };
    } catch (error) {
      this.log('error', `Test generation failed for ${step.target}`, { error: error.message });

      this.emitProgress({
        type: 'step_error',
        stepId: step.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get system prompt for test generation
   * @param {string} framework - Test framework name
   * @returns {string} System prompt
   */
  getSystemPrompt(framework) {
    const frameworkImports = this.getFrameworkImports(framework);

    return `You are an expert test writer. Your job is to generate comprehensive, high-quality tests.

**Framework:** ${framework}

**Standard Imports:**
${frameworkImports}

**Rules:**
1. Test ALL exported functions, classes, and components
2. Cover happy path (normal operation)
3. Cover error cases (invalid input, failures)
4. Cover edge cases (null, undefined, empty arrays, boundary values)
5. Mock all external dependencies (API calls, database, file system)
6. Test async behavior properly (await, promises, callbacks)
7. Use descriptive test names that explain what is being tested
8. Group related tests with describe blocks
9. Use beforeEach/afterEach for setup/teardown when needed
10. Assert on all important aspects (return values, side effects, state changes)

**Test Structure:**
- Use ${framework === 'jest' ? 'describe/test' : 'describe/it'} for organization
- Clear test names: "should [expected behavior] when [condition]"
- Arrange-Act-Assert pattern
- One assertion per concept (can have multiple assertions for same concept)

**Mocking Guidelines:**
- Mock external modules with ${framework === 'jest' ? 'jest.mock()' : 'vi.mock()'}
- Mock functions with ${framework === 'jest' ? 'jest.fn()' : 'vi.fn()'}
- Spy on methods with ${framework === 'jest' ? 'jest.spyOn()' : 'vi.spyOn()'}
- Clear mocks in afterEach

**Coverage Goals:**
- 100% of exported functions
- All error paths
- All conditional branches
- All edge cases
- Async success and failure

**Output Format:**
- Complete, working test file
- All necessary imports at the top
- Proper ${framework} syntax
- Code wrapped in markdown code block with language tag
- No explanations outside the code block

Generate tests that would achieve >90% code coverage.`;
  }

  /**
   * Get framework-specific imports
   * @param {string} framework - Test framework name
   * @returns {string} Import statements
   */
  getFrameworkImports(framework) {
    const imports = {
      vitest: `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';`,
      jest: `import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';`,
      mocha: `import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';`,
      'react-testing-library': `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';`,
      jest__react: `import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';`
    };

    return imports[framework] || imports.vitest;
  }

  /**
   * Build prompt for test generation
   * @param {Object} step - Step details
   * @param {Object} context - Context information
   * @param {string} sourceCode - Source code to test
   * @param {Object} analysis - Code analysis
   * @param {string} framework - Test framework
   * @returns {string} Generated prompt
   */
  buildPrompt(step, context, sourceCode, analysis, framework) {
    let prompt = `**Task:** Generate comprehensive tests for ${step.target}\n`;
    prompt += `**Test Framework:** ${framework}\n`;
    prompt += `**Test File:** ${this.getTestFilePath(step.target, context)}\n\n`;

    // Source code
    prompt += `**Source Code to Test:**\n\`\`\`\n${sourceCode}\n\`\`\`\n\n`;

    // Analysis summary
    if (analysis.functions.length > 0) {
      prompt += `**Functions to Test (${analysis.functions.length}):**\n`;
      analysis.functions.forEach(fn => {
        prompt += `- ${fn.name}${fn.isAsync ? ' (async)' : ''}\n`;
      });
      prompt += `\n`;
    }

    if (analysis.classes.length > 0) {
      prompt += `**Classes to Test (${analysis.classes.length}):**\n`;
      analysis.classes.forEach(cls => {
        prompt += `- ${cls.name} (${cls.methods.length} methods)\n`;
      });
      prompt += `\n`;
    }

    if (analysis.exports.length > 0) {
      prompt += `**Exports to Test:**\n`;
      analysis.exports.forEach(exp => {
        prompt += `- ${exp}\n`;
      });
      prompt += `\n`;
    }

    if (analysis.dependencies.length > 0) {
      prompt += `**Dependencies to Mock:**\n`;
      analysis.dependencies.forEach(dep => {
        prompt += `- ${dep}\n`;
      });
      prompt += `\n`;
    }

    // Test requirements
    prompt += `**Test Requirements:**\n\n`;

    prompt += `1. **Happy Path Tests:**\n`;
    prompt += `   - Test normal operation with valid inputs\n`;
    prompt += `   - Verify correct return values\n`;
    prompt += `   - Check expected side effects\n\n`;

    prompt += `2. **Error Case Tests:**\n`;
    prompt += `   - Test with invalid inputs (null, undefined, wrong types)\n`;
    prompt += `   - Test error handling and error messages\n`;
    prompt += `   - Test rejection of promises (for async functions)\n\n`;

    prompt += `3. **Edge Case Tests:**\n`;
    prompt += `   - Empty arrays/objects\n`;
    prompt += `   - Boundary values (0, -1, max values)\n`;
    prompt += `   - Special characters in strings\n\n`;

    prompt += `4. **Async Tests:**\n`;
    analysis.functions.filter(f => f.isAsync).forEach(fn => {
      prompt += `   - Test ${fn.name} async success\n`;
      prompt += `   - Test ${fn.name} async failure\n`;
    });

    if (analysis.functions.filter(f => f.isAsync).length > 0) {
      prompt += `\n`;
    }

    prompt += `5. **Mock all dependencies:**\n`;
    if (analysis.dependencies.length > 0) {
      analysis.dependencies.forEach(dep => {
        prompt += `   - Mock ${dep}\n`;
      });
    } else {
      prompt += `   - No external dependencies to mock\n`;
    }
    prompt += `\n`;

    // Special instructions for React components
    if (this.isReactComponent(sourceCode)) {
      prompt += `**React Component Testing:**\n`;
      prompt += `- Render the component\n`;
      prompt += `- Test props are passed correctly\n`;
      prompt += `- Test user interactions (clicks, inputs)\n`;
      prompt += `- Test conditional rendering\n`;
      prompt += `- Test state changes\n`;
      prompt += `- Use ${framework === 'jest' ? '@testing-library/react' : '@testing-library/react'}\n\n`;
    }

    // Project context
    if (context.patterns && context.patterns.testingFrameworks) {
      prompt += `**Project Testing Setup:**\n`;
      context.patterns.testingFrameworks.forEach(tf => {
        prompt += `- ${tf.name}${tf.version ? ` ${tf.version}` : ''}\n`;
      });
      prompt += `\n`;
    }

    prompt += `**Instructions:**\n`;
    prompt += `Generate a complete test file that:\n`;
    prompt += `1. Imports the source code correctly\n`;
    prompt += `2. Mocks all external dependencies\n`;
    prompt += `3. Tests all exported functions/classes/components\n`;
    prompt += `4. Achieves >90% code coverage\n`;
    prompt += `5. Uses proper ${framework} syntax\n`;
    prompt += `6. Has clear, descriptive test names\n`;
    prompt += `7. Follows arrange-act-assert pattern\n\n`;

    prompt += `Wrap the test code in a markdown code block with the appropriate language tag.\n`;

    return prompt;
  }

  /**
   * Analyze source code to extract testable elements
   * @param {string} code - Source code
   * @param {string} filePath - File path
   * @returns {Object} Analysis result
   */
  analyzeCode(code, filePath) {
    const analysis = {
      functions: [],
      classes: [],
      exports: [],
      dependencies: [],
      hasAsync: false,
      isReactComponent: false
    };

    try {
      // Parse the code
      const ast = parse(code, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'optionalChaining',
          'nullishCoalescingOperator',
          'dynamicImport'
        ]
      });

      // Walk the AST
      this.walkAST(ast, analysis);

      // Detect React component
      analysis.isReactComponent = this.isReactComponent(code);

    } catch (error) {
      // If parsing fails, do basic regex-based analysis
      this.log('warn', 'AST parsing failed, using regex fallback', { error: error.message });
      this.fallbackAnalysis(code, analysis);
    }

    return analysis;
  }

  /**
   * Walk AST to extract information
   * @param {Object} ast - Abstract syntax tree
   * @param {Object} analysis - Analysis object to populate
   */
  walkAST(ast, analysis) {
    const traverse = (node) => {
      if (!node || typeof node !== 'object') return;

      // Function declarations
      if (node.type === 'FunctionDeclaration' && node.id) {
        analysis.functions.push({
          name: node.id.name,
          isAsync: node.async || false,
          params: node.params ? node.params.length : 0
        });
      }

      // Arrow functions assigned to variables
      if (node.type === 'VariableDeclarator' &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
        if (node.id && node.id.name) {
          analysis.functions.push({
            name: node.id.name,
            isAsync: node.init.async || false,
            params: node.init.params ? node.init.params.length : 0
          });
        }
      }

      // Class declarations
      if (node.type === 'ClassDeclaration' && node.id) {
        const methods = [];
        if (node.body && node.body.body) {
          node.body.body.forEach(member => {
            if (member.type === 'ClassMethod' || member.type === 'MethodDefinition') {
              if (member.key && member.key.name) {
                methods.push({
                  name: member.key.name,
                  isAsync: member.async || member.value?.async || false,
                  kind: member.kind || 'method'
                });
              }
            }
          });
        }

        analysis.classes.push({
          name: node.id.name,
          methods
        });
      }

      // Exports
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.declarations) {
            node.declaration.declarations.forEach(decl => {
              if (decl.id && decl.id.name) {
                analysis.exports.push(decl.id.name);
              }
            });
          } else if (node.declaration.id && node.declaration.id.name) {
            analysis.exports.push(node.declaration.id.name);
          }
        }
        if (node.specifiers) {
          node.specifiers.forEach(spec => {
            if (spec.exported && spec.exported.name) {
              analysis.exports.push(spec.exported.name);
            }
          });
        }
      }

      if (node.type === 'ExportDefaultDeclaration') {
        if (node.declaration && node.declaration.name) {
          analysis.exports.push(node.declaration.name);
        } else {
          analysis.exports.push('default');
        }
      }

      // Import declarations (dependencies)
      if (node.type === 'ImportDeclaration' && node.source && node.source.value) {
        const source = node.source.value;
        // Only track external dependencies (not relative imports)
        if (!source.startsWith('.') && !source.startsWith('/')) {
          if (!analysis.dependencies.includes(source)) {
            analysis.dependencies.push(source);
          }
        }
      }

      // Check for async
      if (node.async) {
        analysis.hasAsync = true;
      }

      // Recursively traverse children
      for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'tokens') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(c => traverse(c));
        } else if (child && typeof child === 'object') {
          traverse(child);
        }
      }
    };

    traverse(ast);
  }

  /**
   * Fallback analysis using regex (when AST parsing fails)
   * @param {string} code - Source code
   * @param {Object} analysis - Analysis object
   */
  fallbackAnalysis(code, analysis) {
    // Find function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      analysis.functions.push({
        name: match[1],
        isAsync: match[0].includes('async'),
        params: 0
      });
      analysis.exports.push(match[1]);
    }

    // Find arrow functions
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(code)) !== null) {
      analysis.functions.push({
        name: match[1],
        isAsync: match[0].includes('async'),
        params: 0
      });
      analysis.exports.push(match[1]);
    }

    // Find classes
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(code)) !== null) {
      analysis.classes.push({
        name: match[1],
        methods: []
      });
      analysis.exports.push(match[1]);
    }

    // Find imports
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(code)) !== null) {
      const source = match[1];
      if (!source.startsWith('.') && !source.startsWith('/')) {
        if (!analysis.dependencies.includes(source)) {
          analysis.dependencies.push(source);
        }
      }
    }

    // Check for async
    analysis.hasAsync = code.includes('async');
  }

  /**
   * Check if code is a React component
   * @param {string} code - Source code
   * @returns {boolean} True if React component
   */
  isReactComponent(code) {
    return (
      code.includes('import React') ||
      code.includes('from \'react\'') ||
      code.includes('from "react"') ||
      code.includes('export default function') && code.includes('return (') && code.includes('<') ||
      code.includes('export const') && code.includes('= ()') && code.includes('return (') && code.includes('<')
    );
  }

  /**
   * Detect test framework from context
   * @param {Object} context - Execution context
   * @returns {string} Framework name
   */
  detectTestFramework(context) {
    if (context.testFramework) {
      return context.testFramework;
    }

    if (context.patterns && context.patterns.testingFrameworks) {
      const frameworks = context.patterns.testingFrameworks;
      if (frameworks.length > 0) {
        const fw = frameworks[0].name.toLowerCase();

        if (fw.includes('vitest')) return 'vitest';
        if (fw.includes('jest')) {
          // Check if React Testing Library is also present
          if (frameworks.some(f => f.name.toLowerCase().includes('testing-library'))) {
            return 'jest__react';
          }
          return 'jest';
        }
        if (fw.includes('mocha')) return 'mocha';
        if (fw.includes('testing-library')) return 'react-testing-library';
      }
    }

    // Check dependencies in package.json if available
    if (context.packageJson && context.packageJson.devDependencies) {
      const deps = context.packageJson.devDependencies;
      if (deps.vitest) return 'vitest';
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
    }

    return this.defaultFramework;
  }

  /**
   * Analyze test coverage from generated tests
   * @param {string} testCode - Generated test code
   * @param {Object} analysis - Source code analysis
   * @returns {Object} Coverage analysis
   */
  analyzeTestCoverage(testCode, analysis) {
    // Count test cases
    const testPatterns = [
      /\btest\s*\(/g,
      /\bit\s*\(/g
    ];

    let testCount = 0;
    for (const pattern of testPatterns) {
      const matches = testCode.match(pattern);
      if (matches) {
        testCount += matches.length;
      }
    }

    // Check which functions are covered
    const coveredFunctions = [];
    analysis.functions.forEach(fn => {
      if (testCode.includes(fn.name)) {
        coveredFunctions.push(fn.name);
      }
    });

    // Check which classes are covered
    const coveredClasses = [];
    analysis.classes.forEach(cls => {
      if (testCode.includes(cls.name)) {
        coveredClasses.push(cls.name);
      }
    });

    // Calculate coverage percentage
    const totalItems = analysis.functions.length + analysis.classes.length;
    const coveredItems = coveredFunctions.length + coveredClasses.length;
    const percentage = totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 0;

    // Check for common test patterns
    const hasSetup = /beforeEach|beforeAll|setUp/.test(testCode);
    const hasTeardown = /afterEach|afterAll|tearDown/.test(testCode);
    const hasMocks = /mock|stub|spy|vi\.|jest\./i.test(testCode);
    const hasAssertions = /expect|assert|should/.test(testCode);

    return {
      testCount,
      percentage,
      coveredFunctions,
      coveredClasses,
      hasSetup,
      hasTeardown,
      hasMocks,
      hasAssertions,
      quality: this.assessTestQuality(testCount, coveredItems, totalItems, hasAssertions, hasMocks)
    };
  }

  /**
   * Assess test quality
   * @param {number} testCount - Number of tests
   * @param {number} coveredItems - Items covered
   * @param {number} totalItems - Total items
   * @param {boolean} hasAssertions - Has assertions
   * @param {boolean} hasMocks - Has mocks
   * @returns {string} Quality level
   */
  assessTestQuality(testCount, coveredItems, totalItems, hasAssertions, hasMocks) {
    if (testCount === 0 || !hasAssertions) {
      return 'insufficient';
    }

    const coverage = totalItems > 0 ? (coveredItems / totalItems) * 100 : 0;

    if (coverage >= 90 && testCount >= totalItems * 3 && hasMocks) {
      return 'excellent';
    }
    if (coverage >= 75 && testCount >= totalItems * 2) {
      return 'good';
    }
    if (coverage >= 50 && testCount >= totalItems) {
      return 'basic';
    }

    return 'insufficient';
  }

  /**
   * Get test file path from source file path
   * @param {string} filePath - Source file path
   * @param {Object} context - Context (may contain testPathPattern)
   * @returns {string} Test file path
   */
  getTestFilePath(filePath, context = {}) {
    // Check if context provides a pattern
    if (context.testPathPattern) {
      return context.testPathPattern.replace('{file}', filePath);
    }

    // Parse the file path
    const parsed = path.parse(filePath);
    const ext = parsed.ext;
    const name = parsed.name;
    const dir = parsed.dir;

    // Common test file patterns (in order of preference)
    const patterns = [
      // Pattern 1: src/utils/__tests__/helper.test.js
      path.join(dir, '__tests__', `${name}.test${ext}`),

      // Pattern 2: src/utils/helper.test.js (colocated)
      path.join(dir, `${name}.test${ext}`),

      // Pattern 3: src/utils/helper.spec.js (spec pattern)
      path.join(dir, `${name}.spec${ext}`)
    ];

    // Use the first pattern by default
    return patterns[0];
  }

  /**
   * Get supported test file patterns
   * @returns {Array} Array of file patterns
   */
  getSupportedPatterns() {
    return [
      '*.test.js', '*.spec.js',
      '*.test.ts', '*.spec.ts',
      '*.test.jsx', '*.spec.jsx',
      '*.test.tsx', '*.spec.tsx',
      '__tests__/*.js', '__tests__/*.ts',
      '__tests__/*.jsx', '__tests__/*.tsx'
    ];
  }
}

module.exports = TestGenSubAgent;
