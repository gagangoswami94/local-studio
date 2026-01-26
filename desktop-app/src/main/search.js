const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Check if ripgrep is available
 */
function isRipgrepAvailable() {
  return new Promise((resolve) => {
    const rg = spawn('rg', ['--version']);
    rg.on('error', () => resolve(false));
    rg.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Search files using ripgrep (preferred) or grep (fallback)
 * @param {string} workspacePath - Root directory to search
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
async function searchFiles(workspacePath, query, options = {}) {
  try {
    if (!workspacePath || !query) {
      return {
        success: true,
        results: [],
        totalMatches: 0
      };
    }

    // Check if workspace exists
    if (!fs.existsSync(workspacePath)) {
      return {
        success: false,
        error: 'Workspace path does not exist'
      };
    }

    const {
      matchCase = false,
      matchWholeWord = false,
      useRegex = false,
      includePattern = '',
      excludePattern = '',
      contextLines = 1
    } = options;

    // Try ripgrep first, fallback to grep
    const useRipgrep = await isRipgrepAvailable();

    if (useRipgrep) {
      return await searchWithRipgrep(workspacePath, query, {
        matchCase,
        matchWholeWord,
        useRegex,
        includePattern,
        excludePattern,
        contextLines
      });
    } else {
      return await searchWithGrep(workspacePath, query, {
        matchCase,
        matchWholeWord,
        useRegex,
        includePattern,
        excludePattern,
        contextLines
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search using ripgrep
 */
function searchWithRipgrep(workspacePath, query, options) {
  return new Promise((resolve) => {
    const args = [
      '--json',
      '--line-number',
      '--column',
      '--no-heading',
      '--with-filename',
      `--context=${options.contextLines}`
    ];

    // Case sensitivity
    if (!options.matchCase) {
      args.push('--ignore-case');
    }

    // Whole word matching
    if (options.matchWholeWord) {
      args.push('--word-regexp');
    }

    // Regex mode
    if (!options.useRegex) {
      args.push('--fixed-strings');
    }

    // Include/exclude patterns
    if (options.includePattern) {
      args.push('--glob', options.includePattern);
    }
    if (options.excludePattern) {
      args.push('--glob', `!${options.excludePattern}`);
    }

    // Always exclude common directories
    args.push('--glob', '!node_modules/**');
    args.push('--glob', '!.git/**');
    args.push('--glob', '!dist/**');
    args.push('--glob', '!build/**');

    args.push('--', query, workspacePath);

    const rg = spawn('rg', args);
    let output = '';
    let errorOutput = '';

    rg.stdout.on('data', (data) => {
      output += data.toString();
    });

    rg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    rg.on('close', (code) => {
      // Exit code 1 means no matches found (not an error)
      if (code !== 0 && code !== 1) {
        resolve({
          success: false,
          error: errorOutput || 'Ripgrep search failed'
        });
        return;
      }

      try {
        const results = parseRipgrepJson(output, workspacePath);
        resolve({
          success: true,
          results: results.matches,
          totalMatches: results.totalMatches
        });
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to parse ripgrep output: ${err.message}`
        });
      }
    });

    rg.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to execute ripgrep: ${error.message}`
      });
    });
  });
}

/**
 * Parse ripgrep JSON output
 */
function parseRipgrepJson(output, workspacePath) {
  const lines = output.trim().split('\n').filter(line => line);
  const fileMatches = {};
  let totalMatches = 0;

  lines.forEach(line => {
    try {
      const data = JSON.parse(line);

      if (data.type === 'match') {
        const filePath = data.data.path.text;
        const relativePath = path.relative(workspacePath, filePath);
        const lineNum = data.data.line_number;
        const lineText = data.data.lines.text;

        if (!fileMatches[relativePath]) {
          fileMatches[relativePath] = {
            file: relativePath,
            filePath: filePath,
            matches: []
          };
        }

        // Extract match positions
        const matches = data.data.submatches.map(sub => ({
          start: sub.start,
          end: sub.end
        }));

        fileMatches[relativePath].matches.push({
          line: lineNum,
          column: data.data.submatches[0]?.start || 0,
          lineText: lineText.trimEnd(),
          matchPositions: matches
        });

        totalMatches++;
      }
    } catch (err) {
      // Skip invalid JSON lines
      console.warn('Failed to parse ripgrep line:', err);
    }
  });

  return {
    matches: Object.values(fileMatches),
    totalMatches
  };
}

/**
 * Search using grep (fallback)
 */
function searchWithGrep(workspacePath, query, options) {
  return new Promise((resolve) => {
    const args = [
      '-r',
      '-n',
      '--exclude-dir=node_modules',
      '--exclude-dir=.git',
      '--exclude-dir=dist',
      '--exclude-dir=build'
    ];

    // Case sensitivity
    if (!options.matchCase) {
      args.push('-i');
    }

    // Whole word matching
    if (options.matchWholeWord) {
      args.push('-w');
    }

    // Regex mode (grep uses regex by default)
    if (!options.useRegex) {
      args.push('-F');
    }

    // Include pattern (basic support)
    if (options.includePattern) {
      args.push('--include', options.includePattern);
    }

    args.push(query, workspacePath);

    const grep = spawn('grep', args);
    let output = '';
    let errorOutput = '';

    grep.stdout.on('data', (data) => {
      output += data.toString();
    });

    grep.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    grep.on('close', (code) => {
      // Exit code 1 means no matches found
      if (code !== 0 && code !== 1) {
        resolve({
          success: false,
          error: errorOutput || 'Grep search failed'
        });
        return;
      }

      try {
        const results = parseGrepOutput(output, workspacePath);
        resolve({
          success: true,
          results: results.matches,
          totalMatches: results.totalMatches
        });
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to parse grep output: ${err.message}`
        });
      }
    });

    grep.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to execute grep: ${error.message}`
      });
    });
  });
}

/**
 * Parse grep output
 */
function parseGrepOutput(output, workspacePath) {
  const lines = output.trim().split('\n').filter(line => line);
  const fileMatches = {};
  let totalMatches = 0;

  lines.forEach(line => {
    // Format: filepath:linenum:linetext
    const match = line.match(/^([^:]+):(\d+):(.*)$/);
    if (match) {
      const [, filePath, lineNum, lineText] = match;
      const relativePath = path.relative(workspacePath, filePath);

      if (!fileMatches[relativePath]) {
        fileMatches[relativePath] = {
          file: relativePath,
          filePath: filePath,
          matches: []
        };
      }

      fileMatches[relativePath].matches.push({
        line: parseInt(lineNum, 10),
        column: 0,
        lineText: lineText.trimEnd(),
        matchPositions: []
      });

      totalMatches++;
    }
  });

  return {
    matches: Object.values(fileMatches),
    totalMatches
  };
}

module.exports = {
  searchFiles
};
