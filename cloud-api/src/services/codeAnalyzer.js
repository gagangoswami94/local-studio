/**
 * Code analyzer service
 * Parses AI responses for file references and code-related information
 */

/**
 * Parse file references from AI response
 * Looks for patterns like: filename:line, [filename:line], `filename:line`
 *
 * @param {string} response - AI response text
 * @returns {Array} Array of {file, line, description}
 */
function parseFileReferences(response) {
  const references = [];

  // Pattern 1: [filename:line] - bracketed reference
  const bracketPattern = /\[([^\]]+):(\d+)\]/g;
  let match;

  while ((match = bracketPattern.exec(response)) !== null) {
    const file = match[1].trim();
    const line = parseInt(match[2], 10);

    // Try to extract surrounding context as description
    const startPos = Math.max(0, match.index - 100);
    const endPos = Math.min(response.length, match.index + match[0].length + 100);
    const context = response.substring(startPos, endPos);

    // Extract sentence containing the reference
    const sentences = context.split(/[.!?]\s+/);
    const description = sentences.find(s => s.includes(match[0])) || '';

    references.push({
      file,
      line,
      description: description.trim(),
      raw: match[0]
    });
  }

  // Pattern 2: `filename:line` - backtick reference
  const backtickPattern = /`([^`]+):(\d+)`/g;

  while ((match = backtickPattern.exec(response)) !== null) {
    const file = match[1].trim();
    const line = parseInt(match[2], 10);

    // Skip if already captured by bracket pattern
    if (references.some(ref => ref.file === file && ref.line === line)) {
      continue;
    }

    // Extract context
    const startPos = Math.max(0, match.index - 100);
    const endPos = Math.min(response.length, match.index + match[0].length + 100);
    const context = response.substring(startPos, endPos);

    const sentences = context.split(/[.!?]\s+/);
    const description = sentences.find(s => s.includes(match[0])) || '';

    references.push({
      file,
      line,
      description: description.trim(),
      raw: match[0]
    });
  }

  // Pattern 3: Plain filename:line (not in brackets or backticks)
  // Only match if preceded by whitespace or start of line
  const plainPattern = /(?:^|\s)([a-zA-Z0-9_\-/.]+\.[a-zA-Z]+):(\d+)(?:\s|$)/g;

  while ((match = plainPattern.exec(response)) !== null) {
    const file = match[1].trim();
    const line = parseInt(match[2], 10);

    // Skip if already captured
    if (references.some(ref => ref.file === file && ref.line === line)) {
      continue;
    }

    // Skip common false positives
    if (file.includes('http') || file.includes('://')) {
      continue;
    }

    // Extract context
    const startPos = Math.max(0, match.index - 100);
    const endPos = Math.min(response.length, match.index + match[0].length + 100);
    const context = response.substring(startPos, endPos);

    const sentences = context.split(/[.!?]\s+/);
    const description = sentences.find(s => s.includes(`${file}:${line}`)) || '';

    references.push({
      file,
      line,
      description: description.trim(),
      raw: `${file}:${line}`
    });
  }

  return references;
}

/**
 * Extract code blocks from markdown response
 * @param {string} response - AI response text
 * @returns {Array} Array of {language, code}
 */
function extractCodeBlocks(response) {
  const codeBlocks = [];
  const pattern = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = pattern.exec(response)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }

  return codeBlocks;
}

/**
 * Detect error patterns in code or messages
 * @param {string} text - Text to analyze
 * @returns {Array} Array of detected errors
 */
function detectErrorPatterns(text) {
  const errors = [];

  // Common error patterns
  const patterns = [
    {
      regex: /(\w+Error): (.+)/g,
      type: 'javascript'
    },
    {
      regex: /Traceback \(most recent call last\):/,
      type: 'python'
    },
    {
      regex: /Fatal error: (.+)/g,
      type: 'php'
    },
    {
      regex: /panic: (.+)/g,
      type: 'go'
    }
  ];

  patterns.forEach(({ regex, type }) => {
    let match;
    const re = new RegExp(regex);

    while ((match = re.exec(text)) !== null) {
      errors.push({
        type,
        message: match[1] || match[0],
        context: text.substring(Math.max(0, match.index - 50), Math.min(text.length, match.index + 200))
      });
    }
  });

  return errors;
}

/**
 * Analyze response for actionable items
 * @param {string} response - AI response text
 * @returns {Object} Analysis results
 */
function analyzeResponse(response) {
  return {
    fileReferences: parseFileReferences(response),
    codeBlocks: extractCodeBlocks(response),
    errors: detectErrorPatterns(response),
    hasCode: /```/.test(response),
    hasFileReferences: /\[[^\]]+:\d+\]/.test(response) || /`[^`]+:\d+`/.test(response),
    wordCount: response.split(/\s+/).length
  };
}

/**
 * Format response with enhanced file references
 * Converts file:line to clickable format for UI
 * @param {string} response - AI response text
 * @returns {string} Formatted response
 */
function formatResponse(response) {
  // Already formatted - just return as is
  // UI will handle parsing and making references clickable
  return response;
}

module.exports = {
  parseFileReferences,
  extractCodeBlocks,
  detectErrorPatterns,
  analyzeResponse,
  formatResponse
};
