/**
 * Test CodeGenSubAgent
 */

const assert = require('assert');
const CodeGenSubAgent = require('../../src/agent/subagents/CodeGenSubAgent');

console.log('Testing CodeGenSubAgent...\n');

// Mock orchestrator
const mockOrchestrator = {
  logger: {
    info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
    debug: (msg, meta) => {} // Silent
  }
};

// Test 1: Create CodeGenSubAgent
console.log('Test 1: Create CodeGenSubAgent');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator, { tokenBudget: 30000 });

    assert(agent.name === 'CodeGen', 'Agent name should be CodeGen');
    assert(agent.tokenBudget === 30000, 'Token budget should be 30000');
    assert(agent.maxRetries === 2, 'Max retries should be 2');

    console.log('✓ CodeGenSubAgent created');
    console.log('  Name:', agent.name);
    console.log('  Budget:', agent.tokenBudget);
    console.log('  Max Retries:', agent.maxRetries);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Get System Prompt
console.log('Test 2: Get System Prompt');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);
    const systemPrompt = agent.getSystemPrompt();

    assert(systemPrompt, 'System prompt should exist');
    assert(systemPrompt.includes('expert code generation'), 'Should mention expert code generation');
    assert(systemPrompt.includes('JSDoc'), 'Should mention JSDoc');
    assert(systemPrompt.includes('error handling'), 'Should mention error handling');

    console.log('✓ System prompt generated');
    console.log(`  Length: ${systemPrompt.length} characters`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Build Prompt (Create Action)
console.log('Test 3: Build Prompt (Create Action)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const step = {
      id: 's1',
      action: 'create',
      target: 'src/components/Button.jsx',
      description: 'Create a reusable Button component',
      layer: 'frontend',
      dependencies: []
    };

    const context = {
      patterns: {
        frameworks: {
          frontend: [{ name: 'React', version: '^18.0.0' }]
        },
        stateManagement: [{ name: 'Zustand' }]
      }
    };

    const prompt = agent.buildPrompt(step, context);

    assert(prompt.includes('CREATE src/components/Button.jsx'), 'Should include CREATE action');
    assert(prompt.includes('Create a reusable Button component'), 'Should include description');
    assert(prompt.includes('frontend'), 'Should include layer');
    assert(prompt.includes('React'), 'Should include framework');
    assert(prompt.includes('Zustand'), 'Should include state management');
    assert(prompt.includes('Frontend Guidelines'), 'Should include frontend guidelines');

    console.log('✓ Prompt built for create action');
    console.log(`  Prompt length: ${prompt.length} characters`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Build Prompt (Modify Action)
console.log('Test 4: Build Prompt (Modify Action)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const step = {
      id: 's2',
      action: 'modify',
      target: 'src/routes/auth.js',
      description: 'Add password reset endpoint',
      layer: 'backend'
    };

    const context = {
      patterns: {
        frameworks: {
          backend: [{ name: 'Express', version: '^4.18.0' }]
        }
      }
    };

    const existingCode = `
const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
  // Login logic
});

module.exports = router;
`;

    const prompt = agent.buildPrompt(step, context, existingCode);

    assert(prompt.includes('MODIFY src/routes/auth.js'), 'Should include MODIFY action');
    assert(prompt.includes('Existing Code'), 'Should include existing code section');
    assert(prompt.includes('router.post'), 'Should include existing code content');
    assert(prompt.includes('Backend Guidelines'), 'Should include backend guidelines');

    console.log('✓ Prompt built for modify action');
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Build Prompt with Retry Feedback
console.log('Test 5: Build Prompt with Retry Feedback');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const step = {
      id: 's3',
      action: 'create',
      target: 'src/utils/helpers.js',
      description: 'Create helper functions',
      layer: 'general'
    };

    const lastError = {
      type: 'syntax_error',
      errors: [
        "Unclosed '{' from line 5",
        "Unexpected closing bracket '}' at line 10"
      ]
    };

    const prompt = agent.buildPrompt(step, {}, null, lastError);

    assert(prompt.includes('RETRY ATTEMPT'), 'Should indicate retry');
    assert(prompt.includes('Syntax Errors'), 'Should list syntax errors');
    assert(prompt.includes("Unclosed '{'"), 'Should include specific error');
    assert(prompt.includes('fix them'), 'Should ask to fix errors');

    console.log('✓ Prompt built with retry feedback');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Validate Syntax (Valid JS)
console.log('Test 6: Validate Syntax (Valid JS)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const validCode = `
const express = require('express');
const router = express.Router();

/**
 * Login endpoint
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Login logic here
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
`;

    const result = agent.validateSyntax(validCode, 'auth.js');

    assert(result.valid === true, 'Valid code should pass validation');
    assert(result.errors.length === 0, 'Should have no errors');

    console.log('✓ Valid JS code passed validation');
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: Validate Syntax (Invalid JS - Unclosed Bracket)
console.log('Test 7: Validate Syntax (Invalid JS - Unclosed Bracket)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const invalidCode = `
function test() {
  console.log('test');
  if (true) {
    console.log('nested');
  // Missing closing brace
}
`;

    const result = agent.validateSyntax(invalidCode, 'test.js');

    assert(result.valid === false, 'Invalid code should fail validation');
    assert(result.errors.length > 0, 'Should have errors');

    console.log('✓ Invalid JS code failed validation');
    console.log(`  Errors found: ${result.errors.length}`);
    console.log(`  Error: ${result.errors[0]}`);
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Validate Syntax (Valid JSON)
console.log('Test 8: Validate Syntax (Valid JSON)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const validJSON = `{
  "name": "test-package",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0"
  }
}`;

    const result = agent.validateSyntax(validJSON, 'package.json');

    assert(result.valid === true, 'Valid JSON should pass validation');
    assert(result.errors.length === 0, 'Should have no errors');

    console.log('✓ Valid JSON passed validation');
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Validate Syntax (Invalid JSON)
console.log('Test 9: Validate Syntax (Invalid JSON)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const invalidJSON = `{
  "name": "test-package",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0"
  }
  // Missing closing brace
`;

    const result = agent.validateSyntax(invalidJSON, 'package.json');

    assert(result.valid === false, 'Invalid JSON should fail validation');
    assert(result.errors.length > 0, 'Should have errors');
    assert(result.errors.some(e => e.includes('Invalid JSON')), 'Should mention JSON error');

    console.log('✓ Invalid JSON failed validation');
    console.log(`  Errors found: ${result.errors.length}`);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: Validate Syntax (Unclosed String)
console.log('Test 10: Validate Syntax (Unclosed String)');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const invalidCode = `
const message = "Hello world;
console.log(message);
`;

    const result = agent.validateSyntax(invalidCode, 'test.js');

    assert(result.valid === false, 'Code with unclosed string should fail');
    assert(result.errors.some(e => e.includes('Unclosed string')), 'Should detect unclosed string');

    console.log('✓ Unclosed string detected');
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: Check Relevant Files
console.log('Test 11: Check Relevant Files');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    // Same directory
    assert(
      agent.isRelevantFile('src/components/Header.jsx', 'src/components/Footer.jsx', 'frontend'),
      'Files in same directory should be relevant'
    );

    // Same layer
    assert(
      agent.isRelevantFile('src/components/Button.jsx', 'src/pages/Home.jsx', 'frontend'),
      'Files in same layer should be relevant'
    );

    // Same extension
    assert(
      agent.isRelevantFile('src/utils/helpers.js', 'src/services/api.js', 'backend'),
      'Files with same extension should be relevant'
    );

    // Different everything
    assert(
      !agent.isRelevantFile('src/styles/app.css', 'src/models/User.js', 'backend'),
      'Completely different files should not be relevant'
    );

    console.log('✓ Relevant file detection working');
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: Get Layer Instructions
console.log('Test 12: Get Layer Instructions');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const frontendInstructions = agent.getLayerInstructions('frontend');
    assert(frontendInstructions.includes('React hooks'), 'Frontend should mention React hooks');

    const backendInstructions = agent.getLayerInstructions('backend');
    assert(backendInstructions.includes('middleware'), 'Backend should mention middleware');

    const databaseInstructions = agent.getLayerInstructions('database');
    assert(databaseInstructions.includes('SQL injection'), 'Database should mention SQL injection');

    const testInstructions = agent.getLayerInstructions('test');
    assert(testInstructions.includes('Mock'), 'Test should mention mocking');

    console.log('✓ Layer-specific instructions working');
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Test 13: Get Supported Extensions
console.log('Test 13: Get Supported Extensions');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);
    const extensions = agent.getSupportedExtensions();

    assert(extensions.includes('js'), 'Should support .js');
    assert(extensions.includes('jsx'), 'Should support .jsx');
    assert(extensions.includes('ts'), 'Should support .ts');
    assert(extensions.includes('tsx'), 'Should support .tsx');
    assert(extensions.includes('json'), 'Should support .json');

    console.log('✓ Supported extensions:');
    console.log(`  ${extensions.join(', ')}`);
    console.log('✓ Test 13 passed\n');
  } catch (error) {
    console.error('✗ Test 13 failed:', error.message);
    process.exit(1);
  }
})();

// Test 14: Validate React Component
console.log('Test 14: Validate React Component');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const reactComponent = `
import React, { useState } from 'react';

/**
 * Button Component
 * @param {Object} props - Component props
 * @param {string} props.label - Button label
 * @param {Function} props.onClick - Click handler
 */
export const Button = ({ label, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={isHovered ? 'button-hover' : 'button'}
    >
      {label}
    </button>
  );
};

export default Button;
`;

    const result = agent.validateSyntax(reactComponent, 'Button.jsx');

    assert(result.valid === true, 'Valid React component should pass');
    assert(result.errors.length === 0, 'Should have no errors');

    console.log('✓ React component validated successfully');
    console.log('✓ Test 14 passed\n');
  } catch (error) {
    console.error('✗ Test 14 failed:', error.message);
    process.exit(1);
  }
})();

// Test 15: Get Line Number
console.log('Test 15: Get Line Number');
(async () => {
  try {
    const agent = new CodeGenSubAgent(mockOrchestrator);

    const code = `line 1
line 2
line 3
line 4`;

    assert(agent.getLineNumber(code, 0) === 1, 'First char should be line 1');
    assert(agent.getLineNumber(code, 7) === 2, 'After first newline should be line 2');
    assert(agent.getLineNumber(code, 14) === 3, 'After second newline should be line 3');

    console.log('✓ Line number calculation working');
    console.log('✓ Test 15 passed\n');
  } catch (error) {
    console.error('✗ Test 15 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests
setTimeout(() => {
  console.log('\n========================================');
  console.log('All CodeGenSubAgent Tests Passed! ✓');
  console.log('========================================\n');
  console.log('Summary:');
  console.log('- Agent initialization: ✓');
  console.log('- System prompt generation: ✓');
  console.log('- Prompt building (create/modify/retry): ✓');
  console.log('- Syntax validation (JS/JSON/React): ✓');
  console.log('- Error detection (brackets, strings, syntax): ✓');
  console.log('- Reference file relevance: ✓');
  console.log('- Layer-specific instructions: ✓');
  console.log('- Supported extensions: ✓');
  console.log('\nCodeGenSubAgent ready for use!');
}, 1000);
