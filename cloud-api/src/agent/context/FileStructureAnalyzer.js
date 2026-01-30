const fs = require('fs').promises;
const path = require('path');

/**
 * File Structure Analyzer
 * Analyzes workspace file structure and generates metadata
 */
class FileStructureAnalyzer {
  constructor(workspacePath, options = {}) {
    this.workspacePath = workspacePath;
    this.options = {
      maxDepth: options.maxDepth || 5,
      ignorePatterns: options.ignorePatterns || [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'coverage',
        '.cache',
        'tmp',
        'temp',
        '.DS_Store',
        'yarn.lock',
        'package-lock.json',
        '.env',
        '.env.local',
        '.vscode',
        '.idea'
      ],
      ...options
    };
  }

  /**
   * Get file structure as a tree
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Object} File tree with metadata
   */
  async getStructure(maxDepth = null) {
    const depth = maxDepth !== null ? maxDepth : this.options.maxDepth;

    try {
      const structure = await this._buildTree(this.workspacePath, 0, depth);
      return {
        root: this.workspacePath,
        tree: structure,
        stats: this._calculateStats(structure)
      };
    } catch (error) {
      throw new Error(`Failed to analyze file structure: ${error.message}`);
    }
  }

  /**
   * Get flat list of all files with metadata
   * @returns {Array<Object>} List of files with metadata
   */
  async getFileList() {
    const files = [];
    await this._collectFiles(this.workspacePath, files, 0, this.options.maxDepth);
    return files;
  }

  /**
   * Build tree structure recursively
   * @private
   */
  async _buildTree(dir, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth) {
      return null;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const tree = {
      directories: [],
      files: []
    };

    for (const entry of entries) {
      // Skip ignored patterns
      if (this._shouldIgnore(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.workspacePath, fullPath);

      if (entry.isDirectory()) {
        const subtree = await this._buildTree(fullPath, currentDepth + 1, maxDepth);
        tree.directories.push({
          name: entry.name,
          path: relativePath,
          children: subtree
        });
      } else if (entry.isFile()) {
        const metadata = await this._getFileMetadata(fullPath, relativePath);
        tree.files.push(metadata);
      }
    }

    return tree;
  }

  /**
   * Collect files recursively into flat list
   * @private
   */
  async _collectFiles(dir, fileList, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth) {
      return;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (this._shouldIgnore(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.workspacePath, fullPath);

      if (entry.isDirectory()) {
        await this._collectFiles(fullPath, fileList, currentDepth + 1, maxDepth);
      } else if (entry.isFile()) {
        const metadata = await this._getFileMetadata(fullPath, relativePath);
        fileList.push(metadata);
      }
    }
  }

  /**
   * Get metadata for a file
   * @private
   */
  async _getFileMetadata(fullPath, relativePath) {
    const stats = await fs.stat(fullPath);
    const ext = path.extname(relativePath);

    return {
      name: path.basename(relativePath),
      path: relativePath,
      fullPath,
      size: stats.size,
      modified: stats.mtime,
      extension: ext,
      language: this._detectLanguage(ext),
      lines: await this._countLines(fullPath, stats.size)
    };
  }

  /**
   * Count lines in a file (for small files only)
   * @private
   */
  async _countLines(filePath, fileSize) {
    // Skip line counting for large files (> 1MB)
    if (fileSize > 1024 * 1024) {
      return null;
    }

    // Skip binary files
    const ext = path.extname(filePath);
    if (this._isBinaryExtension(ext)) {
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.split('\n').length;
    } catch (error) {
      // If file cannot be read as text, it's probably binary
      return null;
    }
  }

  /**
   * Detect programming language from extension
   * @private
   */
  _detectLanguage(ext) {
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.rb': 'ruby',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.dart': 'dart',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.md': 'markdown',
      '.sh': 'shell',
      '.bash': 'shell',
      '.sql': 'sql',
      '.graphql': 'graphql',
      '.gql': 'graphql'
    };

    return languageMap[ext.toLowerCase()] || 'unknown';
  }

  /**
   * Check if extension is binary
   * @private
   */
  _isBinaryExtension(ext) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
      '.pdf', '.zip', '.tar', '.gz', '.rar',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov',
      '.woff', '.woff2', '.ttf', '.eot',
      '.bin', '.dat'
    ];
    return binaryExtensions.includes(ext.toLowerCase());
  }

  /**
   * Check if file/directory should be ignored
   * @private
   */
  _shouldIgnore(name) {
    return this.options.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        // Simple wildcard matching
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(name);
      }
      return name === pattern || name.startsWith(pattern);
    });
  }

  /**
   * Calculate statistics about the file tree
   * @private
   */
  _calculateStats(tree) {
    const stats = {
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      languageBreakdown: {},
      largestFiles: []
    };

    const traverse = (node) => {
      if (!node) return;

      // Count directories
      stats.totalDirectories += node.directories ? node.directories.length : 0;

      // Process files
      if (node.files) {
        stats.totalFiles += node.files.length;

        for (const file of node.files) {
          stats.totalSize += file.size;

          // Track language breakdown
          const lang = file.language;
          stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;

          // Track largest files
          stats.largestFiles.push({
            path: file.path,
            size: file.size,
            lines: file.lines
          });
        }
      }

      // Recurse into directories
      if (node.directories) {
        for (const dir of node.directories) {
          traverse(dir.children);
        }
      }
    };

    traverse(tree);

    // Sort and limit largest files
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 10);

    return stats;
  }

  /**
   * Find files matching a pattern
   * @param {string|RegExp} pattern - Pattern to match
   * @returns {Array<Object>} Matching files
   */
  async findFiles(pattern) {
    const allFiles = await this.getFileList();

    if (typeof pattern === 'string') {
      return allFiles.filter(file => file.path.includes(pattern));
    } else if (pattern instanceof RegExp) {
      return allFiles.filter(file => pattern.test(file.path));
    }

    return [];
  }

  /**
   * Get files by language
   * @param {string} language - Programming language
   * @returns {Array<Object>} Files of that language
   */
  async getFilesByLanguage(language) {
    const allFiles = await this.getFileList();
    return allFiles.filter(file => file.language === language);
  }
}

module.exports = FileStructureAnalyzer;
