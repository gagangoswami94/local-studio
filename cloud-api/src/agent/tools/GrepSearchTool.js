const BaseTool = require('./BaseTool');
const fs = require('fs').promises;
const path = require('path');

class GrepSearchTool extends BaseTool {
  constructor() {
    super({
      name: 'grep_search',
      description: 'Search for text patterns in files using grep-like functionality. Returns matches with file, line number, and context.',
      parameters: {
        type: 'object',
        required: ['pattern'],
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern or regex to find'
          },
          path: {
            type: 'string',
            description: 'Path to search in (default: workspace root ".")'
          },
          include: {
            type: 'string',
            description: 'File pattern to include (e.g., "*.js", "*.{js,ts}")'
          },
          exclude: {
            type: 'string',
            description: 'File pattern to exclude (e.g., "*.test.js")'
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Case sensitive search (default: false)'
          },
          context_lines: {
            type: 'number',
            description: 'Number of context lines to show (default: 2)'
          }
        }
      },
      requiresApproval: false
    });
  }

  async execute(params, context) {
    const {
      pattern,
      path: searchPath = '.',
      include,
      exclude,
      case_sensitive = false,
      context_lines = 2
    } = params;

    const workspacePath = context.workspacePath || process.cwd();
    const absolutePath = path.resolve(workspacePath, searchPath);

    // Security check
    if (!absolutePath.startsWith(workspacePath)) {
      throw new Error('Access denied: path is outside workspace');
    }

    // Create regex from pattern
    const flags = case_sensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);

    const matches = [];
    await this._searchDirectory(absolutePath, workspacePath, regex, include, exclude, context_lines, matches);

    return {
      data: {
        pattern,
        path: searchPath,
        matches,
        totalMatches: matches.reduce((sum, m) => sum + m.matchCount, 0),
        filesSearched: matches.length
      }
    };
  }

  async _searchDirectory(dirPath, workspacePath, regex, include, exclude, contextLines, matches) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(workspacePath, entryPath);

        // Skip hidden, node_modules, and excluded patterns
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (exclude && this._matchPattern(entry.name, exclude)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this._searchDirectory(entryPath, workspacePath, regex, include, exclude, contextLines, matches);
        } else if (entry.isFile()) {
          // Check include pattern
          if (include && !this._matchPattern(entry.name, include)) {
            continue;
          }

          await this._searchFile(entryPath, relativePath, regex, contextLines, matches);
        }
      }
    } catch (error) {
      // Skip directories we can't access
      this.logger.warn(`Skipping directory ${dirPath}:`, error.message);
    }
  }

  async _searchFile(filePath, relativePath, regex, contextLines, matches) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Skip binary files
      if (content.includes('\0')) {
        return;
      }

      const lines = content.split('\n');
      const lineMatches = [];

      lines.forEach((line, idx) => {
        if (regex.test(line)) {
          const lineNum = idx + 1;
          const start = Math.max(0, idx - contextLines);
          const end = Math.min(lines.length, idx + contextLines + 1);

          const contextBefore = lines.slice(start, idx);
          const contextAfter = lines.slice(idx + 1, end);

          lineMatches.push({
            line: lineNum,
            content: line.trim(),
            contextBefore,
            contextAfter
          });
        }
      });

      if (lineMatches.length > 0) {
        matches.push({
          file: relativePath,
          matchCount: lineMatches.length,
          matches: lineMatches
        });
      }
    } catch (error) {
      // Skip files we can't read
      this.logger.warn(`Skipping file ${filePath}:`, error.message);
    }
  }

  _matchPattern(filename, pattern) {
    // Simple glob matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\{([^}]+)\}/g, '($1)')
      .replace(/,/g, '|');

    return new RegExp(`^${regexPattern}$`).test(filename);
  }

  formatResult(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data;
    let output = `Pattern: "${data.pattern}"\n`;
    output += `Found ${data.totalMatches} matches in ${data.filesSearched} files\n`;
    output += `${'='.repeat(60)}\n\n`;

    for (const fileMatch of data.matches) {
      output += `📄 ${fileMatch.file} (${fileMatch.matchCount} matches)\n`;

      for (const match of fileMatch.matches) {
        output += `  Line ${match.line}: ${match.content}\n`;
      }
      output += '\n';
    }

    return output;
  }
}

module.exports = GrepSearchTool;
