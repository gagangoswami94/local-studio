/**
 * Security Check
 * Scans for hardcoded secrets and dangerous patterns
 */
const BaseCheck = require('./BaseCheck');

class SecurityCheck extends BaseCheck {
  constructor(config = {}) {
    super({
      name: 'SecurityCheck',
      level: 'warning',  // Warning level - doesn't block
      ...config
    });
  }

  /**
   * Run security validation
   * @param {Object} bundle - Bundle to validate
   * @returns {Promise<Object>} Validation result
   */
  async run(bundle) {
    this.logStart();

    const issues = [];
    const allFiles = [...(bundle.files || []), ...(bundle.tests || [])];

    for (const file of allFiles) {
      const content = file.content || file.code || '';
      const filePath = file.path;

      // Check for hardcoded secrets
      const secrets = this.findHardcodedSecrets(content);
      if (secrets.length > 0) {
        issues.push({
          file: filePath,
          type: 'hardcoded_secrets',
          severity: 'high',
          issues: secrets
        });
      }

      // Check for dangerous patterns
      const dangerous = this.findDangerousPatterns(content);
      if (dangerous.length > 0) {
        issues.push({
          file: filePath,
          type: 'dangerous_patterns',
          severity: 'medium',
          issues: dangerous
        });
      }

      // Check for SQL injection risks
      const sqlInjection = this.findSQLInjectionRisks(content);
      if (sqlInjection.length > 0) {
        issues.push({
          file: filePath,
          type: 'sql_injection',
          severity: 'high',
          issues: sqlInjection
        });
      }
    }

    // Check results (warnings don't block)
    if (issues.length > 0) {
      const highSeverity = issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = issues.filter(i => i.severity === 'medium').length;

      const result = this.failure(
        `Found ${issues.length} security issue(s) (${highSeverity} high, ${mediumSeverity} medium)`,
        {
          issuesFound: issues.length,
          highSeverity,
          mediumSeverity,
          issues
        }
      );
      this.logResult(result);
      return result;
    }

    const result = this.success('No security issues detected', {
      filesScanned: allFiles.length
    });
    this.logResult(result);
    return result;
  }

  /**
   * Find hardcoded secrets
   * @param {string} content - File content
   * @returns {Array} Array of found secrets
   */
  findHardcodedSecrets(content) {
    const secrets = [];

    // API keys patterns
    const apiKeyPatterns = [
      { pattern: /['"]?API[_-]?KEY['"]?\s*[:=]\s*['"]([A-Za-z0-9\-_]{20,})['"]/, type: 'API Key' },
      { pattern: /['"]?SECRET[_-]?KEY['"]?\s*[:=]\s*['"]([A-Za-z0-9\-_]{20,})['"]/, type: 'Secret Key' },
      { pattern: /['"]?ACCESS[_-]?TOKEN['"]?\s*[:=]\s*['"]([A-Za-z0-9\-_]{20,})['"]/, type: 'Access Token' },
      { pattern: /['"]?PRIVATE[_-]?KEY['"]?\s*[:=]\s*['"]([A-Za-z0-9\-_]{20,})['"]/, type: 'Private Key' }
    ];

    for (const { pattern, type } of apiKeyPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        secrets.push({
          type,
          message: `Possible hardcoded ${type} found`,
          preview: matches[0].substring(0, 50) + '...'
        });
      }
    }

    // AWS keys
    if (content.match(/AKIA[0-9A-Z]{16}/)) {
      secrets.push({
        type: 'AWS Access Key',
        message: 'Possible AWS access key found'
      });
    }

    // Database connection strings with passwords
    if (content.match(/(?:mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/)) {
      secrets.push({
        type: 'Database Connection String',
        message: 'Database connection string with credentials found'
      });
    }

    return secrets;
  }

  /**
   * Find dangerous patterns
   * @param {string} content - File content
   * @returns {Array} Array of dangerous patterns
   */
  findDangerousPatterns(content) {
    const dangerous = [];

    // eval()
    if (content.includes('eval(')) {
      dangerous.push({
        pattern: 'eval()',
        message: 'Use of eval() is dangerous and can lead to code injection',
        severity: 'high'
      });
    }

    // Function constructor
    if (content.match(/new\s+Function\s*\(/)) {
      dangerous.push({
        pattern: 'new Function()',
        message: 'Function constructor can be used for code injection',
        severity: 'medium'
      });
    }

    // innerHTML
    if (content.match(/\.innerHTML\s*=/)) {
      dangerous.push({
        pattern: '.innerHTML =',
        message: 'Direct innerHTML assignment can lead to XSS vulnerabilities',
        severity: 'medium'
      });
    }

    // document.write
    if (content.includes('document.write(')) {
      dangerous.push({
        pattern: 'document.write()',
        message: 'document.write() is unsafe and deprecated',
        severity: 'low'
      });
    }

    return dangerous;
  }

  /**
   * Find SQL injection risks
   * @param {string} content - File content
   * @returns {Array} Array of SQL injection risks
   */
  findSQLInjectionRisks(content) {
    const risks = [];

    // String concatenation in SQL queries
    const sqlConcatPattern = /['"`]SELECT|INSERT|UPDATE|DELETE.*?\+.*?['"`]/gi;
    if (content.match(sqlConcatPattern)) {
      risks.push({
        pattern: 'SQL string concatenation',
        message: 'SQL query string concatenation can lead to SQL injection',
        recommendation: 'Use parameterized queries or prepared statements'
      });
    }

    // Template literals in SQL
    const sqlTemplatePattern = /`SELECT|INSERT|UPDATE|DELETE.*?\$\{/gi;
    if (content.match(sqlTemplatePattern)) {
      risks.push({
        pattern: 'SQL template literals',
        message: 'Template literals in SQL queries can lead to SQL injection',
        recommendation: 'Use parameterized queries'
      });
    }

    return risks;
  }
}

module.exports = SecurityCheck;
