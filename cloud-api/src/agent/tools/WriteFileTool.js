const BaseTool = require('./BaseTool');
const fs = require('fs').promises;
const path = require('path');

class WriteFileTool extends BaseTool {
  constructor() {
    super({
      name: 'write_file',
      description: 'Create or overwrite a file with content. Creates parent directories if needed. WARNING: Overwrites existing files!',
      parameters: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the file to write'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          }
        }
      },
      requiresApproval: true // Requires user approval!
    });
  }

  async execute(params, context) {
    const { path: filePath, content } = params;
    const workspacePath = context.workspacePath || process.cwd();
    const absolutePath = path.resolve(workspacePath, filePath);

    // Security check
    if (!absolutePath.startsWith(workspacePath)) {
      throw new Error('Access denied: path is outside workspace');
    }

    try {
      // Create parent directories if they don't exist
      const dirPath = path.dirname(absolutePath);
      await fs.mkdir(dirPath, { recursive: true });

      // Check if file exists
      let existed = false;
      try {
        await fs.access(absolutePath);
        existed = true;
      } catch {
        // File doesn't exist, will be created
      }

      // Write file
      await fs.writeFile(absolutePath, content, 'utf8');

      // Get file stats
      const stats = await fs.stat(absolutePath);

      return {
        data: {
          path: filePath,
          absolutePath,
          bytesWritten: stats.size,
          existed,
          action: existed ? 'overwritten' : 'created'
        }
      };

    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
      throw error;
    }
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    return `✅ File ${data.action}: ${data.path} (${data.bytesWritten} bytes)`;
  }
}

module.exports = WriteFileTool;
