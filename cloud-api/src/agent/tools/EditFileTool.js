const BaseTool = require('./BaseTool');
const fs = require('fs').promises;
const path = require('path');

/**
 * Edit File Tool
 * Edit specific lines in a file by finding and replacing exact content
 */
class EditFileTool extends BaseTool {
  constructor() {
    super({
      name: 'edit_file',
      description: 'Edit specific lines in a file by finding and replacing exact content. Safer than write_file as it only modifies specific parts.',
      parameters: {
        type: 'object',
        required: ['path', 'old_content', 'new_content'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the file to edit'
          },
          old_content: {
            type: 'string',
            description: 'Exact content to find and replace (must match exactly including whitespace)'
          },
          new_content: {
            type: 'string',
            description: 'New content to replace with'
          }
        }
      },
      requiresApproval: true
    });
  }

  async execute(params, context) {
    const { path: filePath, old_content, new_content } = params;
    const workspacePath = context.workspacePath || process.cwd();
    const absolutePath = path.resolve(workspacePath, filePath);

    // Security check
    if (!absolutePath.startsWith(workspacePath)) {
      throw new Error('Access denied: path is outside workspace');
    }

    try {
      // Read current file content
      const currentContent = await fs.readFile(absolutePath, 'utf8');

      // Check if old_content exists in file
      if (!currentContent.includes(old_content)) {
        throw new Error(`Old content not found in file. Make sure the content matches exactly including whitespace.`);
      }

      // Count occurrences
      const occurrences = currentContent.split(old_content).length - 1;

      if (occurrences > 1) {
        throw new Error(`Old content appears ${occurrences} times in file. Content must be unique to edit safely.`);
      }

      // Replace content
      const newContent = currentContent.replace(old_content, new_content);

      // Write back to file
      await fs.writeFile(absolutePath, newContent, 'utf8');

      // Get stats
      const stats = await fs.stat(absolutePath);

      return {
        data: {
          path: filePath,
          absolutePath,
          oldLength: old_content.length,
          newLength: new_content.length,
          fileSize: stats.size,
          modified: stats.mtime.toISOString()
        }
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
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
    return `✅ File edited: ${data.path} (${data.oldLength} → ${data.newLength} chars)`;
  }
}

module.exports = EditFileTool;
