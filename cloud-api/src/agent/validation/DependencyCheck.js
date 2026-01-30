/**
 * Dependency Check
 * Verifies all imports can be resolved
 */
const BaseCheck = require('./BaseCheck');

class DependencyCheck extends BaseCheck {
  constructor(config = {}) {
    super({
      name: 'DependencyCheck',
      level: 'blocker',
      ...config
    });
  }

  /**
   * Run dependency validation
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Validation result
   */
  async run(bundle) {
    this.logStart();

    const missingImports = [];
    const resolvedImports = [];
    const allFiles = [...(bundle.files || []), ...(bundle.tests || [])];

    // Extract all imports from files
    for (const file of allFiles) {
      const imports = this.extractImports(file.content || file.code || '');
      const filePath = file.path;

      for (const importPath of imports) {
        // Check if it's a relative import
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          // Check if file exists in bundle
          const resolved = this.resolveRelativeImport(importPath, filePath, allFiles);

          if (!resolved) {
            missingImports.push({
              file: filePath,
              import: importPath,
              type: 'relative'
            });
          } else {
            resolvedImports.push({ file: filePath, import: importPath });
          }
        } else {
          // External package - check if it's a known package
          // In production, we'd check package.json or node_modules
          // For now, we'll mark external packages as resolved
          resolvedImports.push({ file: filePath, import: importPath });
        }
      }
    }

    // Check results
    if (missingImports.length > 0) {
      const result = this.failure(
        `Missing ${missingImports.length} import(s)`,
        {
          missingImports,
          resolvedCount: resolvedImports.length
        }
      );
      this.logResult(result);
      return result;
    }

    const result = this.success(
      `All imports resolved (${resolvedImports.length} imports)`,
      {
        resolvedCount: resolvedImports.length
      }
    );
    this.logResult(result);
    return result;
  }

  /**
   * Extract import statements from code
   * @param {string} code - Source code
   * @returns {Array<string>} Array of import paths
   */
  extractImports(code) {
    const imports = [];

    // ES6 imports: import ... from 'path'
    const es6ImportRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = es6ImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // Dynamic imports: import('path')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = dynamicImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS requires: require('path')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = requireRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Resolve a relative import
   * @param {string} importPath - Import path
   * @param {string} fromFile - File making the import
   * @param {Array} allFiles - All files in bundle
   * @returns {boolean} True if resolved
   */
  resolveRelativeImport(importPath, fromFile, allFiles) {
    // Normalize paths
    const path = require('path');

    // Get directory of source file
    const fromDir = path.dirname(fromFile);

    // Resolve relative path
    let targetPath = path.join(fromDir, importPath);

    // Try with extensions if not specified
    const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json'];

    for (const ext of extensions) {
      const testPath = targetPath + ext;

      // Check if file exists in bundle
      const found = allFiles.some(f => {
        const filePath = f.path || f.target;
        return filePath === testPath || filePath === `/${testPath}`;
      });

      if (found) {
        return true;
      }
    }

    // Try /index files
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      const indexPath = path.join(targetPath, `index${ext}`);

      const found = allFiles.some(f => {
        const filePath = f.path || f.target;
        return filePath === indexPath || filePath === `/${indexPath}`;
      });

      if (found) {
        return true;
      }
    }

    return false;
  }
}

module.exports = DependencyCheck;
