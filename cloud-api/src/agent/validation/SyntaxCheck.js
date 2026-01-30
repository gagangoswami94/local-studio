/**
 * Syntax Check
 * Validates syntax of all generated files
 */
const BaseCheck = require('./BaseCheck');
const { parse } = require('@babel/parser');

class SyntaxCheck extends BaseCheck {
  constructor(config = {}) {
    super({
      name: 'SyntaxCheck',
      level: 'blocker',
      ...config
    });
  }

  /**
   * Run syntax validation
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Validation result
   */
  async run(bundle) {
    this.logStart();

    const errors = [];
    const validated = [];

    // Validate each file
    for (const file of bundle.files || []) {
      const result = this.validateFile(file);

      if (!result.valid) {
        errors.push({
          file: file.path,
          errors: result.errors
        });
      } else {
        validated.push(file.path);
      }
    }

    // Validate tests
    for (const test of bundle.tests || []) {
      const result = this.validateFile({ path: test.path, content: test.content });

      if (!result.valid) {
        errors.push({
          file: test.path,
          errors: result.errors
        });
      } else {
        validated.push(test.path);
      }
    }

    // Check results
    if (errors.length > 0) {
      const result = this.failure(
        `Syntax errors found in ${errors.length} file(s)`,
        {
          filesWithErrors: errors.length,
          filesValidated: validated.length,
          errors
        }
      );
      this.logResult(result);
      return result;
    }

    const result = this.success(
      `All files have valid syntax (${validated.length} files)`,
      {
        filesValidated: validated.length
      }
    );
    this.logResult(result);
    return result;
  }

  /**
   * Validate a single file
   * @param {Object} file - File object with path and content
   * @returns {Object} { valid, errors }
   */
  validateFile(file) {
    const ext = file.path.split('.').pop();

    // JavaScript/TypeScript files
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
      return this.validateJavaScript(file.content, ext);
    }

    // JSON files
    if (ext === 'json') {
      return this.validateJSON(file.content);
    }

    // CSS/SCSS files (basic validation)
    if (['css', 'scss', 'sass'].includes(ext)) {
      return this.validateCSS(file.content);
    }

    // Skip other file types (HTML, images, etc.)
    return { valid: true, errors: [] };
  }

  /**
   * Validate JavaScript/TypeScript syntax
   * @param {string} code - Code to validate
   * @param {string} ext - File extension
   * @returns {Object} { valid, errors }
   */
  validateJavaScript(code, ext) {
    try {
      const plugins = ['jsx'];

      if (ext === 'ts' || ext === 'tsx') {
        plugins.push('typescript');
      }

      plugins.push(
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        'objectRestSpread',
        'asyncGenerators'
      );

      parse(code, {
        sourceType: 'module',
        plugins
      });

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            type: 'SyntaxError',
            message: error.message,
            line: error.loc?.line,
            column: error.loc?.column
          }
        ]
      };
    }
  }

  /**
   * Validate JSON syntax
   * @param {string} json - JSON string
   * @returns {Object} { valid, errors }
   */
  validateJSON(json) {
    try {
      JSON.parse(json);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            type: 'JSONError',
            message: error.message
          }
        ]
      };
    }
  }

  /**
   * Validate CSS syntax (basic)
   * @param {string} css - CSS string
   * @returns {Object} { valid, errors }
   */
  validateCSS(css) {
    const errors = [];

    // Check for unclosed braces
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push({
        type: 'CSSError',
        message: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`
      });
    }

    // Check for unclosed parentheses
    const openParens = (css.match(/\(/g) || []).length;
    const closeParens = (css.match(/\)/g) || []).length;

    if (openParens !== closeParens) {
      errors.push({
        type: 'CSSError',
        message: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = SyntaxCheck;
