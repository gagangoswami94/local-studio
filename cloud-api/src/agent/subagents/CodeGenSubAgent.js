/**
 * Code Generation Sub-Agent
 * Generates code files with syntax validation and retry logic
 */

const BaseSubAgent = require('./BaseSubAgent');
const { parse } = require('@babel/parser');

class CodeGenSubAgent extends BaseSubAgent {
  constructor(orchestrator, config = {}) {
    super(orchestrator, {
      name: 'CodeGen',
      tokenBudget: config.tokenBudget || 30000,
      ...config
    });

    this.maxRetries = 2;
  }

  /**
   * Execute code generation task with validation and retry
   * @param {Object} step - Step to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Generation result
   */
  async execute(step, context = {}) {
    this.log('info', `Executing code generation for ${step.target}`, { stepId: step.id });

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

    let attempt = 0;
    let lastError = null;
    let generatedCode = null;
    let totalTokensUsed = 0;

    // Try up to maxRetries times
    while (attempt <= this.maxRetries) {
      try {
        // Get existing code if modifying
        const existingCode = step.action === 'modify' ? context.existingCode : null;

        // Build prompt
        const prompt = this.buildPrompt(step, context, existingCode, lastError);

        // Call AI to generate code
        this.emitProgress({
          type: 'ai_call',
          stepId: step.id,
          attempt: attempt + 1,
          maxAttempts: this.maxRetries + 1
        });

        const response = await this.callAI([
          {
            role: 'user',
            content: prompt
          }
        ], {
          system: this.getSystemPrompt()
        });

        totalTokensUsed += (response.usage.input_tokens + response.usage.output_tokens);

        // Extract code from response
        const codeBlocks = this.extractCodeBlocks(response.content);

        if (codeBlocks.length > 0) {
          generatedCode = codeBlocks[0].code;
        } else {
          // No code blocks found, use entire response
          generatedCode = response.content;
        }

        // Validate syntax
        const syntaxValidation = this.validateSyntax(generatedCode, step.target);

        if (syntaxValidation.valid) {
          // Success!
          this.emitProgress({
            type: 'step_complete',
            stepId: step.id,
            linesGenerated: generatedCode.split('\n').length,
            attempts: attempt + 1
          });

          return {
            success: true,
            stepId: step.id,
            target: step.target,
            action: step.action,
            content: generatedCode,
            tokensUsed: totalTokensUsed,
            attempts: attempt + 1,
            usage: {
              input_tokens: totalTokensUsed,
              output_tokens: 0
            },
            model: response.model
          };
        } else {
          // Validation failed, prepare for retry
          lastError = {
            type: 'syntax_error',
            errors: syntaxValidation.errors,
            message: `Syntax validation failed:\n${syntaxValidation.errors.join('\n')}`
          };

          this.log('warn', `Syntax validation failed for ${step.target}, attempt ${attempt + 1}`, {
            errors: syntaxValidation.errors
          });

          if (attempt < this.maxRetries) {
            this.emitProgress({
              type: 'retry',
              stepId: step.id,
              attempt: attempt + 1,
              reason: 'syntax_error',
              errors: syntaxValidation.errors
            });
          }

          attempt++;
        }
      } catch (error) {
        this.log('error', `Code generation error for ${step.target}, attempt ${attempt + 1}`, {
          error: error.message
        });

        // Prepare for retry
        lastError = {
          type: 'generation_error',
          message: error.message
        };

        if (attempt < this.maxRetries) {
          this.emitProgress({
            type: 'retry',
            stepId: step.id,
            attempt: attempt + 1,
            reason: 'generation_error',
            error: error.message
          });
          attempt++;
        } else {
          throw error;
        }
      }
    }

    // All retries exhausted
    const finalError = lastError || { message: 'Unknown error' };

    this.emitProgress({
      type: 'step_error',
      stepId: step.id,
      error: finalError.message,
      attempts: attempt
    });

    throw new Error(`Code generation failed after ${attempt} attempts: ${finalError.message}`);
  }

  /**
   * Get system prompt for code generation
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are an expert code generation AI. Your job is to generate high-quality, production-ready code.

**Rules:**
1. Follow existing code patterns and conventions in the project
2. Include comprehensive error handling
3. Add JSDoc comments for all functions, classes, and complex logic
4. Use modern JavaScript/TypeScript syntax and best practices
5. Make code readable and maintainable
6. Handle edge cases appropriately
7. Follow the DRY (Don't Repeat Yourself) principle
8. Use meaningful variable and function names
9. Add input validation where appropriate
10. Consider performance implications

**Output Format:**
- Output ONLY the code, wrapped in a markdown code block
- Use appropriate language tag (js, jsx, ts, tsx, etc.)
- Do NOT include explanations outside the code block
- Do NOT add commentary before or after the code block
- All explanations should be in JSDoc or inline comments

**Code Quality:**
- Ensure all brackets, parentheses, and quotes are properly closed
- Use consistent indentation (2 spaces)
- Follow the project's existing code style
- Import all necessary dependencies
- Export modules appropriately

**Error Handling:**
- Wrap operations that might fail in try-catch blocks
- Provide meaningful error messages
- Log errors appropriately
- Handle async operations with proper error handling

Generate code that works correctly on the first attempt.`;
  }

  /**
   * Build prompt for code generation
   * @param {Object} step - Step details
   * @param {Object} context - Context information
   * @param {string} existingCode - Existing code (if modifying)
   * @param {Object} lastError - Previous error (if retrying)
   * @returns {string} Generated prompt
   */
  buildPrompt(step, context, existingCode = null, lastError = null) {
    const { action, target, description, layer } = step;

    let prompt = '';

    // Retry feedback
    if (lastError) {
      prompt += `**IMPORTANT - RETRY ATTEMPT:**\n`;
      prompt += `The previous generation had errors. Please fix them:\n\n`;

      if (lastError.type === 'syntax_error') {
        prompt += `**Syntax Errors:**\n`;
        lastError.errors.forEach((error, idx) => {
          prompt += `${idx + 1}. ${error}\n`;
        });
      } else {
        prompt += `**Error:** ${lastError.message}\n`;
      }

      prompt += `\nPlease regenerate the code with these issues fixed.\n\n`;
      prompt += `---\n\n`;
    }

    // Task description
    prompt += `**Task:** ${action.toUpperCase()} ${target}\n`;
    prompt += `**Description:** ${description || 'No description provided'}\n`;
    prompt += `**Layer:** ${layer || 'general'}\n\n`;

    // Action-specific instructions
    if (action === 'create') {
      prompt += `**Action:** Create a new file at ${target}\n\n`;
    } else if (action === 'modify') {
      prompt += `**Action:** Modify the existing file at ${target}\n\n`;

      if (existingCode) {
        prompt += `**Existing Code:**\n\`\`\`\n${existingCode}\n\`\`\`\n\n`;
      }
    } else if (action === 'delete') {
      prompt += `**Action:** This step will delete the file (no code generation needed)\n\n`;
      return prompt;
    }

    // Project context
    if (context.patterns) {
      prompt += `**Project Context:**\n`;

      // Frameworks
      if (context.patterns.frameworks) {
        const { frameworks } = context.patterns;

        if (frameworks.frontend && frameworks.frontend.length > 0) {
          prompt += `- Frontend: ${frameworks.frontend.map(f => `${f.name} ${f.version || ''}`).join(', ')}\n`;
        }

        if (frameworks.backend && frameworks.backend.length > 0) {
          prompt += `- Backend: ${frameworks.backend.map(f => `${f.name} ${f.version || ''}`).join(', ')}\n`;
        }
      }

      // State management
      if (context.patterns.stateManagement && context.patterns.stateManagement.length > 0) {
        prompt += `- State Management: ${context.patterns.stateManagement.map(s => s.name).join(', ')}\n`;
      }

      // Testing frameworks
      if (context.patterns.testingFrameworks && context.patterns.testingFrameworks.length > 0) {
        prompt += `- Testing: ${context.patterns.testingFrameworks.map(t => t.name).join(', ')}\n`;
      }

      // Databases
      if (context.patterns.databases && context.patterns.databases.length > 0) {
        prompt += `- Databases: ${context.patterns.databases.map(d => d.name).join(', ')}\n`;
      }

      prompt += `\n`;
    }

    // Reference files
    if (context.existingFiles && context.existingFiles.length > 0) {
      prompt += `**Reference Files (follow these patterns):**\n`;

      const relevantFiles = context.existingFiles
        .filter(file => this.isRelevantFile(file.path, target, layer))
        .slice(0, 3); // Limit to 3 most relevant files

      relevantFiles.forEach(file => {
        prompt += `\n### ${file.path}\n`;
        if (file.content) {
          // Truncate long files
          const content = file.content.length > 1000
            ? file.content.substring(0, 1000) + '\n... (truncated)'
            : file.content;
          prompt += `\`\`\`\n${content}\n\`\`\`\n`;
        }
      });

      if (relevantFiles.length > 0) {
        prompt += `\nFollow the patterns, naming conventions, and code style from these files.\n\n`;
      }
    }

    // Dependencies mentioned in step
    if (step.dependencies && step.dependencies.length > 0) {
      prompt += `**Dependencies:**\n`;
      prompt += `This step depends on: ${step.dependencies.join(', ')}\n`;
      prompt += `Ensure compatibility with these dependencies.\n\n`;
    }

    // Layer-specific instructions
    prompt += this.getLayerInstructions(layer);

    // Requirements
    prompt += `**Requirements:**\n`;
    prompt += `1. Follow best practices for ${layer} development\n`;
    prompt += `2. Include comprehensive error handling\n`;
    prompt += `3. Add JSDoc comments for all functions and classes\n`;
    prompt += `4. Use modern, clean syntax\n`;
    prompt += `5. Make code readable and maintainable\n`;
    prompt += `6. Ensure all syntax is valid (no unclosed brackets, quotes, etc.)\n`;
    prompt += `7. Import all necessary dependencies\n`;
    prompt += `8. Export modules appropriately\n\n`;

    // Final instructions
    prompt += `**Output:**\n`;
    prompt += `Generate complete, working code for ${target}.\n`;
    prompt += `Wrap the code in a markdown code block with the appropriate language tag.\n`;
    prompt += `Do NOT include any text before or after the code block.\n`;

    return prompt;
  }

  /**
   * Get layer-specific instructions
   * @param {string} layer - Layer name
   * @returns {string} Instructions
   */
  getLayerInstructions(layer) {
    const instructions = {
      frontend: `**Frontend Guidelines:**
- Use React hooks (useState, useEffect, etc.)
- Follow component composition patterns
- Implement proper prop validation
- Handle loading and error states
- Make components reusable
- Use semantic HTML
- Ensure accessibility (ARIA labels, keyboard navigation)
- Optimize re-renders

`,
      backend: `**Backend Guidelines:**
- Implement proper request validation
- Use middleware appropriately
- Handle errors with try-catch
- Return consistent response formats
- Add logging for debugging
- Validate input data
- Implement proper authentication/authorization checks
- Use async/await for async operations

`,
      database: `**Database Guidelines:**
- Use parameterized queries (prevent SQL injection)
- Add proper indexes
- Handle transactions appropriately
- Include migration rollback logic
- Validate data before inserting
- Use appropriate data types
- Consider performance for large datasets

`,
      test: `**Testing Guidelines:**
- Write clear, descriptive test names
- Test happy path and edge cases
- Mock external dependencies
- Use setup and teardown appropriately
- Aim for high code coverage
- Test error conditions
- Keep tests independent and isolated

`,
      general: `**General Guidelines:**
- Follow SOLID principles
- Keep functions small and focused
- Use meaningful names
- Comment complex logic
- Handle edge cases

`
    };

    return instructions[layer] || instructions.general;
  }

  /**
   * Check if a file is relevant to the current generation
   * @param {string} filePath - File path to check
   * @param {string} target - Target file path
   * @param {string} layer - Current layer
   * @returns {boolean} True if relevant
   */
  isRelevantFile(filePath, target, layer) {
    // Same directory
    const targetDir = target.split('/').slice(0, -1).join('/');
    const fileDir = filePath.split('/').slice(0, -1).join('/');

    if (targetDir === fileDir) {
      return true;
    }

    // Same layer
    if (layer && filePath.includes(layer)) {
      return true;
    }

    // Similar file type
    const targetExt = target.split('.').pop();
    const fileExt = filePath.split('.').pop();

    if (targetExt === fileExt) {
      return true;
    }

    return false;
  }

  /**
   * Validate syntax of generated code
   * @param {string} code - Code to validate
   * @param {string} filePath - File path (for extension detection)
   * @returns {Object} Validation result { valid, errors }
   */
  validateSyntax(code, filePath) {
    const errors = [];

    if (!code || code.trim().length === 0) {
      errors.push('Generated code is empty');
      return { valid: false, errors };
    }

    const ext = filePath.split('.').pop();

    // JavaScript/TypeScript validation
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
      try {
        parse(code, {
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
          ],
          errorRecovery: false
        });
      } catch (error) {
        errors.push(`Syntax error at line ${error.loc?.line}: ${error.message}`);
      }
    }

    // JSON validation
    if (ext === 'json') {
      try {
        JSON.parse(code);
      } catch (error) {
        errors.push(`Invalid JSON: ${error.message}`);
      }
    }

    // Basic bracket/quote matching for all files
    const brackets = {
      '{': '}',
      '[': ']',
      '(': ')'
    };

    const stack = [];
    let inString = false;
    let stringChar = null;
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : null;

      // Handle string states
      if ((char === '"' || char === "'" || char === '`') && !escaped) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
      }

      // Track escape sequences
      escaped = (prevChar === '\\' && !escaped);

      // Skip bracket matching inside strings
      if (inString) {
        continue;
      }

      // Check opening brackets
      if (brackets[char]) {
        stack.push({ char, line: this.getLineNumber(code, i) });
      }

      // Check closing brackets
      if (Object.values(brackets).includes(char)) {
        const expected = stack.pop();
        if (!expected) {
          errors.push(`Unexpected closing bracket '${char}' at line ${this.getLineNumber(code, i)}`);
        } else if (brackets[expected.char] !== char) {
          errors.push(`Mismatched bracket: expected '${brackets[expected.char]}' but found '${char}' at line ${this.getLineNumber(code, i)}`);
        }
      }
    }

    // Check for unclosed brackets
    if (stack.length > 0) {
      stack.forEach(item => {
        errors.push(`Unclosed '${item.char}' from line ${item.line}`);
      });
    }

    // Check for unclosed strings
    if (inString) {
      errors.push(`Unclosed string starting with '${stringChar}'`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get line number for a character position
   * @param {string} code - Source code
   * @param {number} pos - Character position
   * @returns {number} Line number
   */
  getLineNumber(code, pos) {
    return code.substring(0, pos).split('\n').length;
  }

  /**
   * Get supported file extensions
   * @returns {Array} Array of file extensions
   */
  getSupportedExtensions() {
    return [
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'json', 'html', 'css', 'scss', 'sass',
      'md', 'txt', 'yaml', 'yml'
    ];
  }
}

module.exports = CodeGenSubAgent;
