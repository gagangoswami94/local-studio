const { estimateTokens } = require('./anthropic');

/**
 * Prompt builder for Local Studio AI assistant
 * Constructs prompts for different modes: Ask, Plan, Act
 */

const MAX_CONTEXT_TOKENS = 20000;
const FILE_SUMMARY_THRESHOLD = 2000; // Lines threshold for summarization

/**
 * Build base system prompt
 * @returns {string} System prompt
 */
function buildSystemPrompt() {
  return `You are an AI code generation assistant for Local Studio, a desktop IDE that helps developers create full-stack applications from natural language prompts.

# Your Capabilities

- Explain code concepts and answer technical questions (ASK mode)
- Create detailed implementation plans for features (PLAN mode)
- Generate, modify, and refactor code (ACT mode)
- Work with multiple tech stacks: React+Node, Vue+Express, Next.js, Python+FastAPI, Django, Ruby on Rails
- Understand and respect existing codebase patterns and conventions

# Your Limitations

- You cannot access external APIs or databases directly
- You cannot execute code or preview results
- You work with file contents provided in context only
- You should ask for clarification when requirements are ambiguous

# Output Format Requirements

**ASK Mode**: Respond with clear, well-structured markdown explanations. Use code examples when helpful.

**PLAN Mode**: Respond with a JSON object containing:
\`\`\`json
{
  "title": "Brief plan title",
  "steps": [
    {
      "step": 1,
      "description": "What will be done",
      "filesAffected": ["path/to/file.js"],
      "changes": "Summary of changes"
    }
  ],
  "filesChanged": 3,
  "linesAdded": 67,
  "linesRemoved": 12,
  "risks": ["Potential issue or breaking change"],
  "estimatedTime": "15 minutes"
}
\`\`\`

**ACT Mode**: Respond with a JSON object containing:
\`\`\`json
{
  "title": "What was done",
  "files": [
    {
      "path": "src/components/Button.jsx",
      "action": "created|modified|deleted",
      "diff": "unified diff format or full content for new files"
    }
  ],
  "summary": "Brief summary of changes made",
  "filesCreated": 1,
  "filesModified": 2,
  "filesDeleted": 0,
  "testingNotes": "How to test these changes"
}
\`\`\`

# Code Quality Standards

- Follow existing code style and patterns in the codebase
- Write clean, readable, well-commented code
- Include error handling where appropriate
- Consider edge cases and security implications
- Suggest tests when modifying critical functionality

# Important Notes

- Always respect the user's existing code structure
- When uncertain, ask for clarification rather than making assumptions
- Be concise but thorough in explanations
- Prioritize maintainability and best practices`;
}

/**
 * Build ASK mode prompt
 * @param {string} userMessage - User's question
 * @param {Array} contextFiles - Array of {path, content}
 * @returns {string} Formatted prompt
 */
function buildAskPrompt(userMessage, contextFiles = []) {
  let prompt = `User Question: ${userMessage}\n\n`;

  // Add context files if provided
  if (contextFiles.length > 0) {
    prompt += `# Context Files\n\n`;
    const { files, truncated } = prepareContextFiles(contextFiles);

    files.forEach(({ path, content }) => {
      prompt += `## File: ${path}\n\`\`\`\n${content}\n\`\`\`\n\n`;
    });

    if (truncated) {
      prompt += `Note: Some files were truncated or summarized due to length.\n\n`;
    }
  }

  prompt += `Please provide a clear, helpful answer. Use code examples if relevant.`;

  return prompt;
}

/**
 * Build PLAN mode prompt
 * @param {string} userMessage - User's request
 * @param {Array} contextFiles - Array of {path, content}
 * @returns {string} Formatted prompt
 */
function buildPlanPrompt(userMessage, contextFiles = []) {
  let prompt = `User Request: ${userMessage}\n\n`;

  // Add context files
  if (contextFiles.length > 0) {
    prompt += `# Current Codebase\n\n`;
    const { files, truncated } = prepareContextFiles(contextFiles);

    files.forEach(({ path, content }) => {
      prompt += `## File: ${path}\n\`\`\`\n${content}\n\`\`\`\n\n`;
    });

    if (truncated) {
      prompt += `Note: Some files were truncated or summarized due to length.\n\n`;
    }
  } else {
    prompt += `Note: No context files provided. This appears to be a new feature or component.\n\n`;
  }

  prompt += `Create a detailed implementation plan in JSON format as specified in the system prompt. Consider:
- What files need to be created or modified
- Step-by-step implementation approach
- Potential risks or breaking changes
- Estimated effort

Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

/**
 * Build ACT mode prompt
 * @param {string} userMessage - User's request
 * @param {Array} contextFiles - Array of {path, content}
 * @param {Object} plan - Optional approved plan from PLAN mode
 * @returns {string} Formatted prompt
 */
function buildActPrompt(userMessage, contextFiles = [], plan = null) {
  let prompt = `User Request: ${userMessage}\n\n`;

  // Add approved plan if provided
  if (plan) {
    prompt += `# Approved Implementation Plan\n\n`;
    prompt += `${JSON.stringify(plan, null, 2)}\n\n`;
    prompt += `Follow this plan to implement the changes.\n\n`;
  }

  // Add context files
  if (contextFiles.length > 0) {
    prompt += `# Current Files\n\n`;
    const { files, truncated } = prepareContextFiles(contextFiles);

    files.forEach(({ path, content }) => {
      prompt += `## File: ${path}\n\`\`\`\n${content}\n\`\`\`\n\n`;
    });

    if (truncated) {
      prompt += `Note: Some files were truncated due to length. Focus on the most relevant sections.\n\n`;
    }
  }

  prompt += `Generate the code changes in JSON format as specified in the system prompt. Include:
- Complete unified diffs for modified files
- Full content for new files
- Clear indication of which files are being created, modified, or deleted

Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

/**
 * Prepare context files with truncation and summarization
 * @param {Array} contextFiles - Array of {path, content}
 * @returns {Object} {files: Array, truncated: boolean}
 */
function prepareContextFiles(contextFiles) {
  let totalTokens = 0;
  let truncated = false;
  const processedFiles = [];

  for (const file of contextFiles) {
    const fileTokens = estimateTokens(file.content);

    // Check if we're approaching token limit
    if (totalTokens + fileTokens > MAX_CONTEXT_TOKENS) {
      truncated = true;
      break;
    }

    // Summarize very large files
    if (file.content.split('\n').length > FILE_SUMMARY_THRESHOLD) {
      const lines = file.content.split('\n');
      const summarized = [
        ...lines.slice(0, 100), // First 100 lines
        '\n... [content truncated] ...\n',
        `// File has ${lines.length} total lines`,
        ...lines.slice(-50) // Last 50 lines
      ].join('\n');

      processedFiles.push({
        path: file.path,
        content: summarized
      });

      totalTokens += estimateTokens(summarized);
      truncated = true;
    } else {
      processedFiles.push(file);
      totalTokens += fileTokens;
    }
  }

  return {
    files: processedFiles,
    truncated
  };
}

/**
 * Build conversation history for API
 * @param {Array} history - Array of {role, content}
 * @param {string} newMessage - New user message
 * @returns {Array} Formatted messages for API
 */
function buildConversationHistory(history = [], newMessage) {
  const messages = [];

  // Add previous messages
  history.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  // Add new message
  messages.push({
    role: 'user',
    content: newMessage
  });

  return messages;
}

module.exports = {
  buildSystemPrompt,
  buildAskPrompt,
  buildPlanPrompt,
  buildActPrompt,
  buildConversationHistory,
  prepareContextFiles
};
