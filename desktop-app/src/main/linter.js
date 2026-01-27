const { ESLint } = require('eslint');
const path = require('path');

/**
 * Basic ESLint configuration for linting
 */
const eslintConfig = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'no-console': 'off',
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single'],
    'no-debugger': 'warn'
  }
};

/**
 * Lint a file's content
 * @param {string} filePath - Path to the file
 * @param {string} content - File content to lint
 * @returns {Promise<Array>} Array of problems {line, column, message, severity, ruleId}
 */
async function lintFile(filePath, content) {
  try {
    // Only lint JavaScript/JSX files
    const ext = path.extname(filePath).toLowerCase();
    if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      return { success: true, problems: [] };
    }

    const eslint = new ESLint({
      overrideConfig: eslintConfig
    });

    const results = await eslint.lintText(content, {
      filePath: filePath
    });

    if (results.length === 0) {
      return { success: true, problems: [] };
    }

    const problems = results[0].messages.map(msg => ({
      line: msg.line,
      column: msg.column,
      endLine: msg.endLine,
      endColumn: msg.endColumn,
      message: msg.message,
      severity: msg.severity === 2 ? 'error' : 'warning', // 2 = error, 1 = warning
      ruleId: msg.ruleId || 'unknown',
      source: 'ESLint'
    }));

    return {
      success: true,
      problems: problems
    };
  } catch (error) {
    // If there's a syntax error, ESLint will throw
    // Try to extract syntax error info
    if (error.message && error.lineNumber) {
      return {
        success: true,
        problems: [{
          line: error.lineNumber || 1,
          column: error.column || 1,
          message: error.message,
          severity: 'error',
          ruleId: 'syntax-error',
          source: 'ESLint'
        }]
      };
    }

    console.error('Linting error:', error);
    return {
      success: false,
      error: error.message,
      problems: []
    };
  }
}

/**
 * Get problem counts from a list of problems
 * @param {Array} problems - Array of problem objects
 * @returns {Object} {errors: number, warnings: number}
 */
function getProblemCounts(problems) {
  return problems.reduce((counts, problem) => {
    if (problem.severity === 'error') {
      counts.errors++;
    } else {
      counts.warnings++;
    }
    return counts;
  }, { errors: 0, warnings: 0 });
}

module.exports = {
  lintFile,
  getProblemCounts
};
