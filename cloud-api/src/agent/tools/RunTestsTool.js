const BaseTool = require('./BaseTool');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Run Tests Tool
 * Execute test suites and parse results
 */
class RunTestsTool extends BaseTool {
  constructor() {
    super({
      name: 'run_tests',
      description: 'Run test suite for the project. Detects test framework automatically or uses specified command.',
      parameters: {
        type: 'object',
        properties: {
          testPath: {
            type: 'string',
            description: 'Specific test file or directory to run (optional)'
          },
          filter: {
            type: 'string',
            description: 'Test pattern/filter to match specific tests (optional)'
          },
          command: {
            type: 'string',
            description: 'Custom test command (optional, overrides auto-detection)'
          }
        }
      },
      requiresApproval: true // Test commands can be risky
    });
  }

  /**
   * Detect test framework from package.json
   * @private
   */
  async _detectTestFramework(workspacePath) {
    try {
      const packageJsonPath = path.join(workspacePath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check test script
      if (packageJson.scripts && packageJson.scripts.test) {
        return {
          command: 'npm test',
          framework: 'npm-script'
        };
      }

      // Check dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      if (allDeps.jest) {
        return { command: 'npx jest', framework: 'jest' };
      }
      if (allDeps.mocha) {
        return { command: 'npx mocha', framework: 'mocha' };
      }
      if (allDeps.vitest) {
        return { command: 'npx vitest run', framework: 'vitest' };
      }
      if (allDeps.ava) {
        return { command: 'npx ava', framework: 'ava' };
      }

      // Python projects
      const pyFiles = ['pytest.ini', 'setup.py', 'pyproject.toml'];
      for (const file of pyFiles) {
        try {
          await fs.access(path.join(workspacePath, file));
          return { command: 'pytest', framework: 'pytest' };
        } catch {
          // File doesn't exist, continue
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Failed to detect test framework:', error.message);
      return null;
    }
  }

  /**
   * Parse test output based on framework
   * @private
   */
  _parseTestOutput(output, framework) {
    const result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      details: []
    };

    // Jest/Vitest patterns
    if (framework === 'jest' || framework === 'vitest' || framework === 'npm-script') {
      // Pattern: "Tests: 2 failed, 5 passed, 7 total"
      const testsMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/i);
      if (testsMatch) {
        result.failed = parseInt(testsMatch[1], 10);
        result.passed = parseInt(testsMatch[2], 10);
        result.total = parseInt(testsMatch[3], 10);
      }

      // Alternative pattern: "Test Suites: 1 passed, 1 total"
      const suitesMatch = output.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/i);
      if (suitesMatch && !testsMatch) {
        result.passed = parseInt(suitesMatch[1], 10);
        result.total = parseInt(suitesMatch[2], 10);
      }

      // Extract test names
      const testMatches = output.matchAll(/(?:✓|✗|PASS|FAIL)\s+(.+?)(?:\s+\(\d+\s*ms\))?$/gm);
      for (const match of testMatches) {
        result.details.push(match[1].trim());
      }
    }

    // Mocha patterns
    if (framework === 'mocha') {
      // Pattern: "5 passing (10ms)" and "2 failing"
      const passingMatch = output.match(/(\d+)\s+passing/i);
      const failingMatch = output.match(/(\d+)\s+failing/i);

      if (passingMatch) result.passed = parseInt(passingMatch[1], 10);
      if (failingMatch) result.failed = parseInt(failingMatch[1], 10);

      result.total = result.passed + result.failed;
    }

    // Pytest patterns
    if (framework === 'pytest') {
      // Pattern: "5 passed, 2 failed in 1.23s"
      const pytestMatch = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/i);
      if (pytestMatch) {
        result.passed = parseInt(pytestMatch[1], 10);
        result.failed = pytestMatch[2] ? parseInt(pytestMatch[2], 10) : 0;
        result.total = result.passed + result.failed;
      }
    }

    return result;
  }

  async execute(params, context) {
    const { testPath, filter, command: customCommand } = params;
    const workspacePath = context.workspacePath || process.cwd();

    // Detect test framework or use custom command
    let testCommand;
    let framework = 'unknown';

    if (customCommand) {
      testCommand = customCommand;
    } else {
      const detected = await this._detectTestFramework(workspacePath);
      if (!detected) {
        throw new Error('No test framework detected. Please specify a custom test command.');
      }
      testCommand = detected.command;
      framework = detected.framework;
    }

    // Add test path if specified
    if (testPath) {
      testCommand += ` ${testPath}`;
    }

    // Add filter if specified
    if (filter) {
      if (framework === 'jest' || framework === 'vitest') {
        testCommand += ` -t "${filter}"`;
      } else if (framework === 'mocha') {
        testCommand += ` --grep "${filter}"`;
      } else if (framework === 'pytest') {
        testCommand += ` -k "${filter}"`;
      }
    }

    // Execute test command
    return new Promise((resolve) => {
      const startTime = Date.now();

      exec(
        testCommand,
        {
          cwd: workspacePath,
          timeout: 300000, // 5 minutes
          maxBuffer: 1024 * 1024 * 10, // 10MB
          env: {
            ...process.env,
            CI: 'true', // Disable interactive prompts
            NODE_ENV: 'test'
          }
        },
        (error, stdout, stderr) => {
          const duration = Date.now() - startTime;
          const output = stdout + stderr;

          // Parse test results
          const results = this._parseTestOutput(output, framework);

          // Determine if tests passed (exit code 0) or failed
          const allPassed = !error && results.failed === 0;

          resolve({
            data: {
              command: testCommand,
              framework,
              exitCode: error ? (error.code || 1) : 0,
              duration,
              passed: results.passed,
              failed: results.failed,
              skipped: results.skipped,
              total: results.total,
              details: results.details,
              output: output.slice(0, 5000), // Limit output to 5000 chars
              success: allPassed
            }
          });
        }
      );
    });
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `Test Suite: ${data.framework}\n`;
    output += `Command: ${data.command}\n`;
    output += `Duration: ${data.duration}ms\n`;
    output += `${'='.repeat(60)}\n`;

    // Summary
    output += `Results:\n`;
    output += `  ✅ Passed: ${data.passed}\n`;
    output += `  ❌ Failed: ${data.failed}\n`;
    output += `  ⏭️  Skipped: ${data.skipped}\n`;
    output += `  📊 Total: ${data.total}\n`;
    output += `\n`;

    if (data.success) {
      output += `✅ All tests passed!\n`;
    } else {
      output += `❌ Tests failed (exit code: ${data.exitCode})\n`;
    }

    output += `${'='.repeat(60)}\n`;

    // Show output preview
    if (data.output) {
      output += `\nOutput Preview:\n${data.output.slice(0, 1000)}`;
      if (data.output.length > 1000) {
        output += `\n... (truncated)`;
      }
    }

    return output;
  }
}

module.exports = RunTestsTool;
