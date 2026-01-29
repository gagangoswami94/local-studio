const BaseTool = require('./BaseTool');
const { exec } = require('child_process');
const path = require('path');

/**
 * Run Command Tool
 * Execute shell commands with security restrictions
 */
class RunCommandTool extends BaseTool {
  constructor() {
    super({
      name: 'run_command',
      description: 'Execute a shell command in the workspace. Use with caution - requires approval.',
      parameters: {
        type: 'object',
        required: ['command'],
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute'
          },
          cwd: {
            type: 'string',
            description: 'Working directory (relative to workspace, default: workspace root)'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in seconds (default: 60, max: 300)'
          }
        }
      },
      requiresApproval: true // ALWAYS requires approval
    });

    // Whitelist of allowed command prefixes
    this.allowedCommands = [
      'npm',
      'node',
      'git',
      'ls',
      'pwd',
      'cat',
      'echo',
      'mkdir',
      'touch',
      'cp',
      'mv',
      'grep',
      'find',
      'test',
      'jest',
      'mocha',
      'pytest',
      'python',
      'python3',
      'tsc',
      'eslint',
      'prettier'
    ];

    // Blacklist of dangerous commands/patterns
    this.dangerousPatterns = [
      /rm\s+-rf/i,
      /sudo/i,
      /su\s/i,
      /chmod\s+777/i,
      />\s*\/dev\//i,
      /mkfs/i,
      /dd\s+if=/i,
      /fork\s+bomb/i,
      /:()\{\s*:\|:&\s*\};:/i, // fork bomb pattern
      /curl.*\|\s*sh/i,
      /wget.*\|\s*sh/i,
      /eval/i,
      /exec/i
    ];
  }

  /**
   * Validate command for security
   * @private
   */
  _validateCommand(command) {
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Command blocked: dangerous pattern detected`);
      }
    }

    // Extract first word (command name)
    const firstWord = command.trim().split(/\s+/)[0];
    const commandName = path.basename(firstWord);

    // Check if command is in whitelist
    const isAllowed = this.allowedCommands.some(allowed =>
      commandName === allowed || commandName.startsWith(allowed)
    );

    if (!isAllowed) {
      throw new Error(`Command blocked: '${commandName}' is not in the allowed list`);
    }

    return true;
  }

  async execute(params, context) {
    const { command, cwd: relativeCwd = '.', timeout = 60 } = params;
    const workspacePath = context.workspacePath || process.cwd();

    // Validate command
    this._validateCommand(command);

    // Resolve working directory
    const absoluteCwd = path.resolve(workspacePath, relativeCwd);

    // Security check: prevent path traversal
    if (!absoluteCwd.startsWith(workspacePath)) {
      throw new Error('Access denied: working directory is outside workspace');
    }

    // Limit timeout
    const timeoutMs = Math.min(timeout * 1000, 300000); // Max 5 minutes

    return new Promise((resolve) => {
      const startTime = Date.now();

      const childProcess = exec(
        command,
        {
          cwd: absoluteCwd,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: {
            ...process.env,
            // Add safety environment variables
            NODE_ENV: process.env.NODE_ENV || 'development',
            PATH: process.env.PATH
          }
        },
        (error, stdout, stderr) => {
          const duration = Date.now() - startTime;

          // Handle timeout
          if (error && error.killed && error.signal === 'SIGTERM') {
            resolve({
              data: {
                command,
                exitCode: -1,
                stdout: stdout || '',
                stderr: stderr || 'Command timed out',
                duration,
                timedOut: true
              }
            });
            return;
          }

          // Handle other errors (non-zero exit code)
          if (error) {
            resolve({
              data: {
                command,
                exitCode: error.code || 1,
                stdout: stdout || '',
                stderr: stderr || error.message,
                duration,
                timedOut: false
              }
            });
            return;
          }

          // Success
          resolve({
            data: {
              command,
              exitCode: 0,
              stdout: stdout || '',
              stderr: stderr || '',
              duration,
              timedOut: false
            }
          });
        }
      );

      // Handle process errors
      childProcess.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          data: {
            command,
            exitCode: -1,
            stdout: '',
            stderr: error.message,
            duration,
            timedOut: false
          }
        });
      });
    });
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `Command: ${data.command}\n`;
    output += `Exit Code: ${data.exitCode}\n`;
    output += `Duration: ${data.duration}ms\n`;

    if (data.timedOut) {
      output += `⚠️  Command timed out\n`;
    }

    output += `${'='.repeat(60)}\n`;

    if (data.stdout) {
      output += `STDOUT:\n${data.stdout}\n`;
    }

    if (data.stderr) {
      output += `${'='.repeat(60)}\nSTDERR:\n${data.stderr}\n`;
    }

    output += `${'='.repeat(60)}`;

    return output;
  }
}

module.exports = RunCommandTool;
