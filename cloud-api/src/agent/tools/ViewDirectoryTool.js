const BaseTool = require('./BaseTool');
const fs = require('fs').promises;
const path = require('path');

/**
 * View Directory Tool
 * List contents of a directory
 */
class ViewDirectoryTool extends BaseTool {
  constructor() {
    super({
      name: 'view_directory',
      description: 'List files and directories in a workspace directory. Returns tree structure with file metadata.',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the directory from workspace root (use "." for root)'
          },
          recursive: {
            type: 'boolean',
            description: 'List subdirectories recursively (default: false)'
          },
          max_depth: {
            type: 'number',
            description: 'Maximum depth for recursive listing (default: 3, max: 10)'
          }
        }
      },
      requiresApproval: false
    });
  }

  async execute(params, context) {
    const { path: dirPath, recursive = false, max_depth = 3 } = params;
    const workspacePath = context.workspacePath || process.cwd();

    // Resolve absolute path
    const absolutePath = path.resolve(workspacePath, dirPath);

    // Security check: prevent path traversal
    if (!absolutePath.startsWith(workspacePath)) {
      throw new Error('Access denied: path is outside workspace');
    }

    // Limit max depth
    const maxDepth = Math.min(max_depth, 10);

    try {
      // Check if directory exists
      const stats = await fs.stat(absolutePath);

      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      // List directory contents
      const tree = await this._listDirectory(absolutePath, workspacePath, recursive, maxDepth, 0);

      return {
        data: {
          path: dirPath,
          absolutePath,
          tree,
          fileCount: this._countFiles(tree),
          dirCount: this._countDirs(tree)
        }
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${dirPath}`);
      }
      throw error;
    }
  }

  /**
   * List directory contents recursively
   * @private
   */
  async _listDirectory(absolutePath, workspacePath, recursive, maxDepth, currentDepth) {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    const tree = [];

    for (const entry of entries) {
      const entryPath = path.join(absolutePath, entry.name);
      const relativePath = path.relative(workspacePath, entryPath);

      // Skip hidden files and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      try {
        const stats = await fs.stat(entryPath);

        const item = {
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : 'file'
        };

        if (entry.isFile()) {
          item.size = stats.size;
          item.modified = stats.mtime.toISOString();
        }

        // Recursively list subdirectories
        if (entry.isDirectory() && recursive && currentDepth < maxDepth) {
          item.children = await this._listDirectory(entryPath, workspacePath, recursive, maxDepth, currentDepth + 1);
        }

        tree.push(item);
      } catch (error) {
        // Skip files we can't access
        this.logger.warn(`Skipping ${entryPath}:`, error.message);
      }
    }

    // Sort: directories first, then files, alphabetically
    tree.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    return tree;
  }

  /**
   * Count total files in tree
   * @private
   */
  _countFiles(tree) {
    let count = 0;
    for (const item of tree) {
      if (item.type === 'file') {
        count++;
      } else if (item.children) {
        count += this._countFiles(item.children);
      }
    }
    return count;
  }

  /**
   * Count total directories in tree
   * @private
   */
  _countDirs(tree) {
    let count = 0;
    for (const item of tree) {
      if (item.type === 'directory') {
        count++;
        if (item.children) {
          count += this._countDirs(item.children);
        }
      }
    }
    return count;
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
    let output = `Directory: ${data.path}\n`;
    output += `Files: ${data.fileCount}, Directories: ${data.dirCount}\n`;
    output += `${'='.repeat(60)}\n`;
    output += this._formatTree(data.tree, 0);

    return output;
  }

  /**
   * Format tree for display
   * @private
   */
  _formatTree(tree, depth) {
    let output = '';
    const indent = '  '.repeat(depth);

    for (const item of tree) {
      const icon = item.type === 'directory' ? '📁' : '📄';
      const size = item.size !== undefined ? ` (${this._formatSize(item.size)})` : '';

      output += `${indent}${icon} ${item.name}${size}\n`;

      if (item.children) {
        output += this._formatTree(item.children, depth + 1);
      }
    }

    return output;
  }

  /**
   * Format file size
   * @private
   */
  _formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  }
}

module.exports = ViewDirectoryTool;
