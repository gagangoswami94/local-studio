const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;

/**
 * Relevance Scorer
 * AI-powered file relevance scoring for intelligent context selection
 */
class RelevanceScorer {
  constructor(options = {}) {
    this.options = {
      aiThreshold: options.aiThreshold || 5000, // Min tokens to use AI
      maxAICandidates: options.maxAICandidates || 50, // Files to send to AI
      topAIResults: options.topAIResults || 15, // Files AI returns
      heuristicWeight: options.heuristicWeight || 0.4,
      aiWeight: options.aiWeight || 0.6,
      ...options
    };

    // Initialize Anthropic client if API key available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  }

  /**
   * Score and rank files by relevance to request
   * @param {string} request - User request
   * @param {Array<Object>} files - Files to score
   * @param {number} tokenBudget - Available token budget
   * @returns {Array<Object>} Scored and ranked files
   */
  async scoreFiles(request, files, tokenBudget = 0) {
    // Pass 1: Heuristic scoring (always runs - free)
    const heuristicScored = files.map(file => ({
      ...file,
      heuristicScore: this.heuristicScore(request, file)
    }));

    // Sort by heuristic score
    heuristicScored.sort((a, b) => b.heuristicScore - a.heuristicScore);

    // Determine if we should use AI
    const useAI = this._shouldUseAI(tokenBudget, heuristicScored.length);

    if (useAI && this.anthropic) {
      // Pass 2: AI ranking
      try {
        const topCandidates = heuristicScored.slice(0, this.options.maxAICandidates);
        const aiRanks = await this.aiRankFiles(request, topCandidates);

        // Combine scores
        const combinedScored = heuristicScored.map(file => {
          const aiRank = aiRanks[file.path];
          const aiScore = aiRank !== undefined ? (15 - aiRank) / 15 * 10 : 0;

          return {
            ...file,
            aiScore,
            finalScore: (file.heuristicScore * this.options.heuristicWeight) +
                       (aiScore * this.options.aiWeight)
          };
        });

        // Sort by final score
        combinedScored.sort((a, b) => b.finalScore - a.finalScore);
        return combinedScored;
      } catch (error) {
        console.error('AI ranking failed, falling back to heuristic:', error.message);
        // Fall back to heuristic-only
        return heuristicScored.map(file => ({
          ...file,
          aiScore: 0,
          finalScore: file.heuristicScore
        }));
      }
    } else {
      // Heuristic-only scoring
      return heuristicScored.map(file => ({
        ...file,
        aiScore: 0,
        finalScore: file.heuristicScore
      }));
    }
  }

  /**
   * Calculate heuristic relevance score (0-10)
   * @param {string} request - User request
   * @param {Object} file - File metadata
   * @returns {number} Score from 0-10
   */
  heuristicScore(request, file) {
    let score = 0;
    const requestLower = request.toLowerCase();
    const pathLower = file.path.toLowerCase();
    const nameLower = file.name.toLowerCase();

    // 1. Keyword matching in file name (0-3 points)
    const keywords = this._extractKeywords(requestLower);
    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        keywordMatches++;
      }
    }
    score += Math.min(keywordMatches * 1.5, 3);

    // 2. Keyword matching in path (0-2 points)
    let pathMatches = 0;
    for (const keyword of keywords) {
      if (pathLower.includes(keyword)) {
        pathMatches++;
      }
    }
    score += Math.min(pathMatches * 0.5, 2);

    // 3. File type relevance (0-2 points)
    score += this._getFileTypeScore(file, requestLower);

    // 4. Configuration/entry point bonus (0-2 points)
    score += this._getSpecialFileBonus(file);

    // 5. File size preference (0-1 point)
    // Prefer medium-sized files (not too small, not too large)
    if (file.lines) {
      if (file.lines >= 50 && file.lines <= 300) {
        score += 1;
      } else if (file.lines >= 20 && file.lines <= 500) {
        score += 0.5;
      }
    }

    // 6. Recency bonus (0-0.5 points)
    if (file.modified) {
      const daysSinceModified = (Date.now() - new Date(file.modified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 7) {
        score += 0.5;
      } else if (daysSinceModified < 30) {
        score += 0.25;
      }
    }

    return Math.min(score, 10);
  }

  /**
   * Use AI to rank files by relevance
   * @param {string} request - User request
   * @param {Array<Object>} fileList - Files to rank
   * @returns {Object} Map of file path to rank (0 = most relevant)
   */
  async aiRankFiles(request, fileList) {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    // Build file list for AI
    const fileDescriptions = fileList.map((file, idx) => {
      return `${idx + 1}. ${file.path} (${file.language}, ${file.lines || '?'} lines)`;
    }).join('\n');

    const prompt = `Given this user request: "${request}"

Rank these files by relevance to the request (most relevant first).
Return ONLY the top ${this.options.topAIResults} file paths, one per line, in order of relevance.
Do NOT include numbers or any other text - just the file paths.

Files:
${fileDescriptions}

Top ${this.options.topAIResults} most relevant files:`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const rankedPaths = response.content[0].text
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Create rank map
      const rankMap = {};
      rankedPaths.forEach((path, rank) => {
        rankMap[path] = rank;
      });

      return rankMap;
    } catch (error) {
      throw new Error(`AI ranking failed: ${error.message}`);
    }
  }

  /**
   * Analyze import relationships to find connected files
   * @param {string} filePath - File to analyze
   * @param {Array<Object>} allFiles - All files in workspace
   * @returns {Array<string>} Related file paths
   */
  async analyzeImports(filePath, allFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const imports = this._extractImports(content);

      const relatedFiles = [];
      for (const importPath of imports) {
        // Find matching files
        const matches = allFiles.filter(f =>
          f.path.includes(importPath) || importPath.includes(f.name)
        );
        relatedFiles.push(...matches.map(f => f.path));
      }

      return [...new Set(relatedFiles)]; // Deduplicate
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract keywords from request
   * @private
   */
  _extractKeywords(request) {
    // Remove common words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'add', 'create',
      'update', 'delete', 'make', 'implement', 'build', 'fix', 'change'
    ]);

    const words = request
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)]; // Deduplicate
  }

  /**
   * Get file type relevance score
   * @private
   */
  _getFileTypeScore(file, request) {
    let score = 0;

    // Check for request-specific patterns
    if (request.includes('test') && (file.path.includes('test') || file.path.includes('spec'))) {
      score += 2;
    }

    if (request.includes('api') && (file.path.includes('api') || file.path.includes('route'))) {
      score += 2;
    }

    if (request.includes('component') && file.path.includes('component')) {
      score += 2;
    }

    if (request.includes('style') && (file.language === 'css' || file.language === 'scss')) {
      score += 2;
    }

    if (request.includes('config') && file.name.includes('config')) {
      score += 2;
    }

    // Database-related
    if ((request.includes('database') || request.includes('model') || request.includes('schema')) &&
        (file.path.includes('model') || file.path.includes('schema') || file.path.includes('database'))) {
      score += 2;
    }

    // Authentication/Authorization
    if ((request.includes('auth') || request.includes('login') || request.includes('user')) &&
        (file.path.includes('auth') || file.path.includes('user') || file.path.includes('login'))) {
      score += 2;
    }

    return Math.min(score, 2);
  }

  /**
   * Get bonus for special files
   * @private
   */
  _getSpecialFileBonus(file) {
    let bonus = 0;

    // Configuration files
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config',
      'webpack.config',
      'next.config',
      'tailwind.config',
      '.env'
    ];

    if (configFiles.some(cf => file.name.includes(cf))) {
      bonus += 1;
    }

    // Entry points
    const entryPoints = [
      'index',
      'main',
      'app',
      'server',
      'entry'
    ];

    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    if (entryPoints.includes(nameWithoutExt.toLowerCase())) {
      bonus += 1;
    }

    return Math.min(bonus, 2);
  }

  /**
   * Extract import statements from file content
   * @private
   */
  _extractImports(content) {
    const imports = [];

    // JavaScript/TypeScript imports
    const jsImportRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    let match;
    while ((match = jsImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Require statements
    const requireRegex = /require\(['"](.+?)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Python imports
    const pythonImportRegex = /(?:from|import)\s+([\w.]+)/g;
    while ((match = pythonImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Determine if AI should be used based on budget and file count
   * @private
   */
  _shouldUseAI(tokenBudget, fileCount) {
    // Don't use AI if budget is too low
    if (tokenBudget < this.options.aiThreshold) {
      return false;
    }

    // Don't use AI if we have very few files (heuristic is enough)
    if (fileCount < 10) {
      return false;
    }

    // Use AI for better ranking
    return true;
  }

  /**
   * Get scoring statistics for debugging
   * @param {Array<Object>} scoredFiles - Files with scores
   * @returns {Object} Statistics
   */
  getScoreStats(scoredFiles) {
    const stats = {
      total: scoredFiles.length,
      avgHeuristic: 0,
      avgAI: 0,
      avgFinal: 0,
      top10: [],
      bottom10: []
    };

    if (scoredFiles.length === 0) return stats;

    stats.avgHeuristic = scoredFiles.reduce((sum, f) => sum + (f.heuristicScore || 0), 0) / scoredFiles.length;
    stats.avgAI = scoredFiles.reduce((sum, f) => sum + (f.aiScore || 0), 0) / scoredFiles.length;
    stats.avgFinal = scoredFiles.reduce((sum, f) => sum + (f.finalScore || 0), 0) / scoredFiles.length;

    stats.top10 = scoredFiles.slice(0, 10).map(f => ({
      path: f.path,
      heuristic: f.heuristicScore?.toFixed(2),
      ai: f.aiScore?.toFixed(2),
      final: f.finalScore?.toFixed(2)
    }));

    stats.bottom10 = scoredFiles.slice(-10).map(f => ({
      path: f.path,
      heuristic: f.heuristicScore?.toFixed(2),
      ai: f.aiScore?.toFixed(2),
      final: f.finalScore?.toFixed(2)
    }));

    return stats;
  }
}

module.exports = RelevanceScorer;
