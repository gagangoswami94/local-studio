/**
 * Test Coverage Check
 * Verifies tests exist for new code
 */
const BaseCheck = require('./BaseCheck');

class TestCoverageCheck extends BaseCheck {
  constructor(config = {}) {
    super({
      name: 'TestCoverageCheck',
      level: 'blocker',
      ...config
    });

    // Configurable threshold (default 80%)
    this.threshold = config.threshold || 80;
  }

  /**
   * Run test coverage validation
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Validation result
   */
  async run(bundle) {
    this.logStart();

    // Get code files that should have tests
    const codeFiles = (bundle.files || []).filter(file =>
      this.shouldHaveTest(file.path)
    );

    if (codeFiles.length === 0) {
      const result = this.success('No code files requiring tests', {
        codeFiles: 0,
        testsFound: 0,
        coverage: 100
      });
      this.logResult(result);
      return result;
    }

    // Get test files
    const tests = bundle.tests || [];

    // Map tests to source files
    const testedFiles = new Set();
    const untestedFiles = [];

    for (const file of codeFiles) {
      const hasTest = tests.some(test =>
        test.sourceFile === file.path ||
        this.matchesTestPattern(file.path, test.path)
      );

      if (hasTest) {
        testedFiles.add(file.path);
      } else {
        untestedFiles.push(file.path);
      }
    }

    // Calculate coverage
    const coverage = (testedFiles.size / codeFiles.length) * 100;

    // Check against threshold
    if (coverage < this.threshold) {
      const result = this.failure(
        `Test coverage ${coverage.toFixed(1)}% is below threshold ${this.threshold}%`,
        {
          codeFiles: codeFiles.length,
          testedFiles: testedFiles.size,
          untestedFiles,
          coverage: coverage.toFixed(1),
          threshold: this.threshold
        }
      );
      this.logResult(result);
      return result;
    }

    const result = this.success(
      `Test coverage ${coverage.toFixed(1)}% meets threshold ${this.threshold}%`,
      {
        codeFiles: codeFiles.length,
        testedFiles: testedFiles.size,
        coverage: coverage.toFixed(1),
        threshold: this.threshold
      }
    );
    this.logResult(result);
    return result;
  }

  /**
   * Check if file should have a test
   * @param {string} filePath - File path
   * @returns {boolean} True if should have test
   */
  shouldHaveTest(filePath) {
    const ext = filePath.split('.').pop();

    // Code file extensions
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'java'];

    if (!codeExtensions.includes(ext)) {
      return false;
    }

    // Don't test test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return false;
    }

    // Don't test config files
    const configPatterns = [
      'config', 'setup', '.config.', 'webpack', 'vite', 'jest',
      'babel.config', 'rollup.config', 'tsconfig'
    ];

    if (configPatterns.some(pattern => filePath.includes(pattern))) {
      return false;
    }

    return true;
  }

  /**
   * Check if test path matches source file
   * @param {string} sourceFile - Source file path
   * @param {string} testFile - Test file path
   * @returns {boolean} True if matches
   */
  matchesTestPattern(sourceFile, testFile) {
    const path = require('path');

    // Remove extension from source file
    const sourceName = path.parse(sourceFile).name;
    const testName = path.parse(testFile).name;

    // Check if test name includes source name
    // e.g., helper.js → helper.test.js or helper.spec.js
    if (testName === sourceName || testName === `${sourceName}.test` || testName === `${sourceName}.spec`) {
      return true;
    }

    return false;
  }
}

module.exports = TestCoverageCheck;
