const fs = require('fs').promises;
const path = require('path');
const FileStructureAnalyzer = require('./FileStructureAnalyzer');
const PatternDetector = require('./PatternDetector');
const RelevanceScorer = require('./RelevanceScorer');

/**
 * Context Gatherer
 * Main coordinator for gathering workspace context for AI
 */
class ContextGatherer {
  constructor(workspacePath, options = {}) {
    this.workspacePath = workspacePath;
    this.options = {
      maxDepth: options.maxDepth || 5,
      tokenBudget: options.tokenBudget || 50000,
      priorityPatterns: options.priorityPatterns || [],
      useAIScoring: options.useAIScoring !== false, // Default true
      ...options
    };

    this.structureAnalyzer = new FileStructureAnalyzer(workspacePath, {
      maxDepth: this.options.maxDepth
    });

    this.patternDetector = new PatternDetector(workspacePath);

    this.relevanceScorer = new RelevanceScorer({
      aiThreshold: options.aiThreshold,
      maxAICandidates: options.maxAICandidates,
      topAIResults: options.topAIResults
    });
  }

  /**
   * Gather comprehensive context about workspace
   * @param {string} request - User's request to help prioritize relevant files
   * @param {number} tokenBudget - Maximum tokens to use
   * @returns {Object} Context object with all gathered info
   */
  async gather(request = '', tokenBudget = null) {
    const budget = tokenBudget || this.options.tokenBudget;
    const tokenTracker = {
      structure: 0,
      patterns: 0,
      dependencies: 0,
      files: 0,
      total: 0
    };

    try {
      // 1. Get file structure (lightweight)
      const structure = await this.structureAnalyzer.getStructure();
      tokenTracker.structure = this._estimateTokens(JSON.stringify(structure));

      // 2. Detect patterns (lightweight)
      const patterns = await this.patternDetector.detectAll();
      tokenTracker.patterns = this._estimateTokens(JSON.stringify(patterns));

      // 3. Get dependencies
      const dependencies = await this._getDependencies();
      tokenTracker.dependencies = this._estimateTokens(JSON.stringify(dependencies));

      // 4. Calculate remaining budget for file contents
      const usedTokens = tokenTracker.structure + tokenTracker.patterns + tokenTracker.dependencies;
      const remainingBudget = budget - usedTokens;

      // 5. Load relevant files based on request and budget
      const files = await this._loadRelevantFiles(request, remainingBudget, structure);
      tokenTracker.files = files.reduce((sum, f) => sum + f.tokens, 0);
      tokenTracker.total = usedTokens + tokenTracker.files;

      // 6. Build final context object
      return {
        structure: this._summarizeStructure(structure),
        patterns,
        dependencies,
        files,
        tokenUsage: tokenTracker,
        summary: this._generateContextSummary(structure, patterns, dependencies, files)
      };
    } catch (error) {
      throw new Error(`Failed to gather context: ${error.message}`);
    }
  }

  /**
   * Get dependencies from package.json
   * @private
   */
  async _getDependencies() {
    try {
      const packagePath = path.join(this.workspacePath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(content);

      return {
        production: packageJson.dependencies || {},
        development: packageJson.devDependencies || {},
        count: {
          production: Object.keys(packageJson.dependencies || {}).length,
          development: Object.keys(packageJson.devDependencies || {}).length
        }
      };
    } catch (error) {
      return {
        production: {},
        development: {},
        count: { production: 0, development: 0 }
      };
    }
  }

  /**
   * Load relevant files based on request and token budget
   * @private
   */
  async _loadRelevantFiles(request, tokenBudget, structure) {
    // Get all files from structure
    const allFiles = await this.structureAnalyzer.getFileList();

    // Use AI-powered relevance scoring if enabled
    const prioritized = this.options.useAIScoring
      ? await this.relevanceScorer.scoreFiles(request, allFiles, tokenBudget)
      : this._prioritizeFiles(allFiles, request);

    const loadedFiles = [];
    let tokensUsed = 0;

    for (const file of prioritized) {
      // Check if we've exceeded budget
      if (tokensUsed >= tokenBudget) {
        break;
      }

      // Determine how to load this file
      const loadStrategy = this._determineLoadStrategy(file);

      try {
        let content, tokens;

        if (loadStrategy === 'full') {
          content = await fs.readFile(file.fullPath, 'utf8');
          tokens = this._estimateTokens(content);
        } else if (loadStrategy === 'outline') {
          content = await this._generateOutline(file.fullPath, file.language);
          tokens = this._estimateTokens(content);
        } else {
          // Skip binary or irrelevant files
          continue;
        }

        // Check if adding this file would exceed budget
        if (tokensUsed + tokens > tokenBudget) {
          // Try outline instead if we loaded full
          if (loadStrategy === 'full') {
            content = await this._generateOutline(file.fullPath, file.language);
            tokens = this._estimateTokens(content);

            if (tokensUsed + tokens > tokenBudget) {
              break; // Still too large, stop here
            }
          } else {
            break;
          }
        }

        loadedFiles.push({
          path: file.path,
          language: file.language,
          lines: file.lines,
          size: file.size,
          content,
          loadStrategy,
          tokens,
          relevanceScore: file.finalScore || file.heuristicScore || 0
        });

        tokensUsed += tokens;
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return loadedFiles;
  }

  /**
   * Prioritize files based on relevance to request
   * @private
   */
  _prioritizeFiles(files, request) {
    const requestLower = request.toLowerCase();

    return files.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // 1. Configuration files (highest priority)
      const configFiles = ['package.json', 'tsconfig.json', 'vite.config', 'webpack.config', '.env'];
      if (configFiles.some(cf => a.name.includes(cf))) scoreA += 1000;
      if (configFiles.some(cf => b.name.includes(cf))) scoreB += 1000;

      // 2. Entry points
      const entryPoints = ['index', 'main', 'app', 'server'];
      if (entryPoints.some(ep => a.name.toLowerCase().includes(ep))) scoreA += 500;
      if (entryPoints.some(ep => b.name.toLowerCase().includes(ep))) scoreB += 500;

      // 3. Match request keywords
      if (requestLower) {
        const keywords = requestLower.split(/\s+/);
        for (const keyword of keywords) {
          if (a.path.toLowerCase().includes(keyword)) scoreA += 300;
          if (b.path.toLowerCase().includes(keyword)) scoreB += 300;
        }
      }

      // 4. Prefer smaller files (easier to fit in budget)
      if (a.size < 10000) scoreA += 100;
      if (b.size < 10000) scoreB += 100;

      // 5. Prefer source files over tests
      if (!a.path.includes('test') && !a.path.includes('spec')) scoreA += 50;
      if (!b.path.includes('test') && !b.path.includes('spec')) scoreB += 50;

      return scoreB - scoreA;
    });
  }

  /**
   * Determine how to load a file (full, outline, or skip)
   * @private
   */
  _determineLoadStrategy(file) {
    // Skip binary files
    if (file.language === 'unknown' || !file.lines) {
      return 'skip';
    }

    // Skip very large files
    if (file.size > 1024 * 1024) { // > 1MB
      return 'skip';
    }

    // Full content for small files
    if (file.lines && file.lines < 200) {
      return 'full';
    }

    // Outline for medium files
    if (file.lines && file.lines < 500) {
      return 'outline';
    }

    // Outline for large files
    return 'outline';
  }

  /**
   * Generate outline/summary of a file
   * @private
   */
  async _generateOutline(filePath, language) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    const outline = [];
    outline.push(`// File: ${path.basename(filePath)}`);
    outline.push(`// Lines: ${lines.length}`);
    outline.push(`// Language: ${language}`);
    outline.push('');

    // Extract important lines based on language
    if (['javascript', 'typescript'].includes(language)) {
      // Extract imports, exports, function/class declarations
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.startsWith('import ') ||
          line.startsWith('export ') ||
          line.includes('function ') ||
          line.includes('class ') ||
          line.includes('const ') ||
          line.includes('interface ') ||
          line.includes('type ')
        ) {
          outline.push(`${i + 1}: ${line}`);
        }
      }
    } else if (language === 'python') {
      // Extract imports, class/function definitions
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.startsWith('import ') ||
          line.startsWith('from ') ||
          line.startsWith('def ') ||
          line.startsWith('class ') ||
          line.startsWith('@')
        ) {
          outline.push(`${i + 1}: ${line}`);
        }
      }
    } else {
      // Generic outline: first 10 and last 10 lines
      outline.push('// First 10 lines:');
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        outline.push(`${i + 1}: ${lines[i]}`);
      }

      if (lines.length > 20) {
        outline.push('');
        outline.push('// ... middle content omitted ...');
        outline.push('');
        outline.push('// Last 10 lines:');
        for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
          outline.push(`${i + 1}: ${lines[i]}`);
        }
      }
    }

    return outline.join('\n');
  }

  /**
   * Summarize file structure for context
   * @private
   */
  _summarizeStructure(structure) {
    return {
      root: structure.root,
      stats: structure.stats,
      // Don't include full tree to save tokens
      // Tree can be retrieved separately if needed
    };
  }

  /**
   * Generate context summary
   * @private
   */
  _generateContextSummary(structure, patterns, dependencies, files) {
    const summary = [];

    summary.push(`Workspace: ${structure.root}`);
    summary.push(`Files: ${structure.stats.totalFiles} | Directories: ${structure.stats.totalDirectories}`);

    if (patterns.summary) {
      summary.push(`Stack: ${patterns.summary}`);
    }

    summary.push(`Dependencies: ${dependencies.count.production} prod, ${dependencies.count.development} dev`);
    summary.push(`Context files loaded: ${files.length}`);

    return summary.join('\n');
  }

  /**
   * Estimate token count for content
   * Rough estimation: 1 token ≈ 4 characters
   * @private
   */
  _estimateTokens(content) {
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }
    return Math.ceil(content.length / 4);
  }

  /**
   * Get detailed file tree (separate method to avoid always including in context)
   * @returns {Object} Full file tree
   */
  async getDetailedTree() {
    return await this.structureAnalyzer.getStructure();
  }

  /**
   * Find specific files matching pattern
   * @param {string|RegExp} pattern - Pattern to match
   * @returns {Array<Object>} Matching files
   */
  async findFiles(pattern) {
    return await this.structureAnalyzer.findFiles(pattern);
  }

  /**
   * Get files by language
   * @param {string} language - Programming language
   * @returns {Array<Object>} Files of that language
   */
  async getFilesByLanguage(language) {
    return await this.structureAnalyzer.getFilesByLanguage(language);
  }
}

module.exports = ContextGatherer;
