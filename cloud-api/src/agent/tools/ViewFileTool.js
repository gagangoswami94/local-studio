const BaseTool = require('./BaseTool');
const fs = require('fs').promises;
const path = require('path');

/**
 * View File Tool
 * Read and display file contents
 */
class ViewFileTool extends BaseTool {
  constructor() {
    super({
      name: 'view_file',
      description: 'Read and view the contents of a file in the workspace. Returns file content with line numbers.',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the file from workspace root'
          },
          start_line: {
            type: 'number',
            description: 'Optional: Start line number (1-indexed, inclusive)'
          },
          end_line: {
            type: 'number',
            description: 'Optional: End line number (1-indexed, inclusive)'
          }
        }
      },
      requiresApproval: false
    });
  }

  async execute(params, context) {
    const { path: filePath, start_line, end_line } = params;
    const workspacePath = context.workspacePath || process.cwd();

    // Resolve absolute path
    const absolutePath = path.resolve(workspacePath, filePath);

    // Security check: prevent path traversal
    if (!absolutePath.startsWith(workspacePath)) {
      throw new Error('Access denied: path is outside workspace');
    }

    try {
      // Check if file exists
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        throw new Error(`Path is a directory, not a file: ${filePath}`);
      }

      // Check for binary files (simple heuristic: > 1MB or has null bytes in first 8KB)
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error(`File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum: 10MB`);
      }

      // Read file content
      const content = await fs.readFile(absolutePath, 'utf8');

      // Check for binary content (null bytes)
      if (content.includes('\0')) {
        throw new Error('Binary file detected. Cannot display binary content.');
      }

      // Split into lines
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Determine line range
      const startLine = Math.max(1, start_line || 1);
      const endLine = Math.min(totalLines, end_line || totalLines);

      if (startLine > totalLines) {
        throw new Error(`Start line ${startLine} exceeds file length (${totalLines} lines)`);
      }

      if (endLine < startLine) {
        throw new Error(`End line ${endLine} is before start line ${startLine}`);
      }

      // Extract requested lines (convert to 0-indexed)
      const selectedLines = lines.slice(startLine - 1, endLine);

      // Add line numbers
      const numberedLines = selectedLines.map((line, idx) => {
        const lineNum = startLine + idx;
        const lineNumStr = lineNum.toString().padStart(4, ' ');
        return `${lineNumStr} | ${line}`;
      });

      const displayContent = numberedLines.join('\n');

      // Determine if truncated
      const isTruncated = startLine > 1 || endLine < totalLines;

      return {
        data: {
          path: filePath,
          absolutePath,
          content: displayContent,
          totalLines,
          displayedLines: {
            start: startLine,
            end: endLine,
            count: selectedLines.length
          },
          truncated: isTruncated,
          sizeBytes: stats.size,
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

  /**
   * Format result for display
   * @override
   */
  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `File: ${data.path}\n`;
    output += `Lines: ${data.displayedLines.start}-${data.displayedLines.end} of ${data.totalLines}`;
    if (data.truncated) {
      output += ' (truncated)';
    }
    output += `\n${'='.repeat(60)}\n`;
    output += data.content;
    output += `\n${'='.repeat(60)}`;

    return output;
  }
}

module.exports = ViewFileTool;
