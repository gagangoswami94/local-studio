const BaseTool = require('./BaseTool');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Install Package Tool
 * Install npm packages and update package.json
 */
class InstallPackageTool extends BaseTool {
  constructor() {
    super({
      name: 'install_package',
      description: 'Install npm packages and update package.json. Use with caution - requires approval.',
      parameters: {
        type: 'object',
        required: ['package'],
        properties: {
          package: {
            type: 'string',
            description: 'Package name to install (e.g., "express", "lodash@4.17.21")'
          },
          dev: {
            type: 'boolean',
            description: 'Install as dev dependency (default: false)'
          },
          exact: {
            type: 'boolean',
            description: 'Install exact version (default: false)'
          }
        }
      },
      requiresApproval: true // ALWAYS requires approval
    });
  }

  /**
   * Validate package name
   * @private
   */
  _validatePackageName(packageName) {
    // Basic validation for npm package names
    // Format: @scope/name or name, optionally with @version
    const packageRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9-~][a-z0-9-._~]*)?$/i;

    if (!packageRegex.test(packageName)) {
      throw new Error(`Invalid package name: ${packageName}`);
    }

    // Block known dangerous packages
    const dangerousPackages = [
      'shelljs',
      'node-cmd',
      'child-process-promise'
      // Add more as needed
    ];

    const baseName = packageName.split('@')[0];
    if (dangerousPackages.includes(baseName)) {
      throw new Error(`Package '${baseName}' is not allowed for security reasons`);
    }

    return true;
  }

  /**
   * Check if package.json exists
   * @private
   */
  async _checkPackageJson(workspacePath) {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    try {
      await fs.access(packageJsonPath);
      return true;
    } catch {
      return false;
    }
  }

  async execute(params, context) {
    const { package: packageName, dev = false, exact = false } = params;
    const workspacePath = context.workspacePath || process.cwd();

    // Validate package name
    this._validatePackageName(packageName);

    // Check if package.json exists
    const hasPackageJson = await this._checkPackageJson(workspacePath);
    if (!hasPackageJson) {
      throw new Error('No package.json found in workspace. Initialize project first with "npm init".');
    }

    // Build npm install command
    let command = 'npm install';

    if (dev) {
      command += ' --save-dev';
    }

    if (exact) {
      command += ' --save-exact';
    }

    command += ` ${packageName}`;

    // Execute npm install
    return new Promise((resolve) => {
      const startTime = Date.now();

      exec(
        command,
        {
          cwd: workspacePath,
          timeout: 180000, // 3 minutes
          maxBuffer: 1024 * 1024 * 10, // 10MB
          env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'development'
          }
        },
        async (error, stdout, stderr) => {
          const duration = Date.now() - startTime;

          if (error) {
            resolve({
              data: {
                command,
                packageName,
                exitCode: error.code || 1,
                stdout: stdout || '',
                stderr: stderr || error.message,
                duration,
                success: false
              }
            });
            return;
          }

          // Read updated package.json to get installed version
          let installedVersion = 'unknown';
          try {
            const packageJsonPath = path.join(workspacePath, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);

            const deps = dev ? packageJson.devDependencies : packageJson.dependencies;
            const baseName = packageName.split('@')[0];

            if (deps && deps[baseName]) {
              installedVersion = deps[baseName];
            }
          } catch (err) {
            this.logger.warn('Failed to read installed version:', err.message);
          }

          resolve({
            data: {
              command,
              packageName,
              version: installedVersion,
              isDev: dev,
              exitCode: 0,
              stdout: stdout || '',
              stderr: stderr || '',
              duration,
              success: true
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
    let output = `Package Installation\n`;
    output += `Command: ${data.command}\n`;
    output += `Duration: ${data.duration}ms\n`;
    output += `${'='.repeat(60)}\n`;

    if (data.success) {
      output += `✅ Successfully installed: ${data.packageName}\n`;
      if (data.version !== 'unknown') {
        output += `Version: ${data.version}\n`;
      }
      output += `Type: ${data.isDev ? 'devDependency' : 'dependency'}\n`;
    } else {
      output += `❌ Installation failed (exit code: ${data.exitCode})\n`;
    }

    output += `${'='.repeat(60)}\n`;

    // Show output
    if (data.stdout) {
      output += `\nOutput:\n${data.stdout.slice(0, 1000)}`;
      if (data.stdout.length > 1000) {
        output += `\n... (truncated)`;
      }
    }

    if (data.stderr && !data.success) {
      output += `\nError:\n${data.stderr.slice(0, 500)}`;
    }

    return output;
  }
}

module.exports = InstallPackageTool;
