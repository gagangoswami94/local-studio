const { chatCompletion } = require('./anthropic');
const { v4: uuidv4 } = require('uuid');

/**
 * Plan Builder Service
 * Analyzes user requests and generates structured implementation plans
 */

/**
 * Build system prompt for plan generation
 */
function buildPlanSystemPrompt() {
  return `You are an expert software architect and implementation planner. Your role is to analyze user requests and create detailed, realistic implementation plans.

# Plan Structure

You MUST respond with ONLY a valid JSON object (no markdown, no extra text) with this EXACT structure:

\`\`\`json
{
  "plan_id": "unique-id",
  "complexity": "low|medium|high",
  "estimated_minutes": number,
  "steps": [
    {
      "type": "database|backend|frontend|test|config|deployment",
      "description": "What will be done in this step",
      "files": ["array", "of", "file", "paths"]
    }
  ],
  "files_to_change": [
    {
      "path": "relative/path/to/file.ext",
      "change_type": "create|modify|delete"
    }
  ],
  "migrations": [
    {
      "sql_forward": "SQL to apply change",
      "sql_reverse": "SQL to undo change"
    }
  ],
  "risks": ["Array of potential risks or breaking changes"],
  "dependencies": {
    "add": ["package@version"],
    "remove": ["package-to-remove"]
  }
}
\`\`\`

# Guidelines

## Complexity Assessment
- **low**: Simple changes, 1-2 files, < 30 minutes, no dependencies
- **medium**: Moderate changes, 3-7 files, 30-60 minutes, maybe 1-2 dependencies
- **high**: Complex changes, 8+ files, > 60 minutes, multiple dependencies, migrations

## Step Types
- **database**: Schema changes, migrations, data seeding
- **backend**: API endpoints, business logic, server code
- **frontend**: UI components, pages, client-side logic
- **test**: Unit tests, integration tests, e2e tests
- **config**: Configuration files, environment setup
- **deployment**: Build scripts, deployment configs, CI/CD

## File Paths
- Use relative paths from project root
- Be specific (e.g., "src/components/Button.jsx" not "button file")
- Include all files that will be touched

## Migrations
- ONLY include if database schema changes are needed
- Use empty array [] if no migrations
- Always provide both forward and reverse SQL

## Dependencies
- Be specific with versions when possible
- Consider peer dependencies
- Only include what's actually needed

## Risks
- Be honest about potential breaking changes
- Mention compatibility concerns
- Flag complex refactors
- Note performance implications

# Important Rules

1. Respond with ONLY the JSON object - no markdown code blocks, no explanations
2. All arrays must be present (use [] if empty)
3. Estimate time realistically
4. Be thorough but practical
5. Consider existing codebase patterns

# Examples

For "Add user authentication":
- complexity: high (auth is complex)
- steps: database (users table), backend (auth routes), frontend (login form), config (.env vars)
- migrations: CREATE TABLE users
- dependencies: bcrypt, jsonwebtoken
- risks: Session management, security considerations

For "Fix button color":
- complexity: low (simple CSS change)
- steps: frontend (modify CSS)
- files: 1-2 CSS/component files
- migrations: []
- dependencies: {add: [], remove: []}
- risks: Might affect other components using same class`;
}

/**
 * Build user prompt for plan generation
 */
function buildPlanPrompt(message, context, workspaceFiles = []) {
  let prompt = `# User Request\n\n${message}\n\n`;

  // Add context files
  if (context && context.length > 0) {
    prompt += `# Current Code Context\n\n`;
    prompt += `${context.length} file(s) provided for context:\n\n`;

    context.forEach(({ path, content }) => {
      const lines = content.split('\n');
      const preview = lines.slice(0, 50).join('\n');
      const truncated = lines.length > 50 ? `\n... (${lines.length - 50} more lines)` : '';

      prompt += `## ${path}\n\`\`\`\n${preview}${truncated}\n\`\`\`\n\n`;
    });
  }

  // Add workspace file list if provided
  if (workspaceFiles && workspaceFiles.length > 0) {
    prompt += `# Existing Workspace Files\n\n`;
    prompt += `The workspace contains ${workspaceFiles.length} files:\n`;

    // Group by directory
    const filesByDir = {};
    workspaceFiles.forEach(file => {
      const dir = file.split('/').slice(0, -1).join('/') || 'root';
      if (!filesByDir[dir]) filesByDir[dir] = [];
      filesByDir[dir].push(file);
    });

    Object.keys(filesByDir).sort().forEach(dir => {
      if (filesByDir[dir].length > 0) {
        prompt += `\n**${dir}/**\n`;
        filesByDir[dir].slice(0, 10).forEach(file => {
          prompt += `- ${file}\n`;
        });
        if (filesByDir[dir].length > 10) {
          prompt += `... and ${filesByDir[dir].length - 10} more\n`;
        }
      }
    });

    prompt += '\n';
  }

  prompt += `# Task\n\nAnalyze this request and create a detailed implementation plan. Respond with ONLY the JSON object as specified in the system prompt. No markdown code blocks, no extra text.`;

  return prompt;
}

/**
 * Analyze request and determine if it's a new app or modification
 */
function analyzeRequestType(message, context) {
  const lowerMessage = message.toLowerCase();

  // Keywords suggesting new app
  const newAppKeywords = [
    'create a new',
    'build a',
    'make a new',
    'generate a',
    'scaffold',
    'from scratch'
  ];

  // Keywords suggesting modification
  const modificationKeywords = [
    'add',
    'update',
    'modify',
    'fix',
    'change',
    'refactor',
    'improve',
    'remove'
  ];

  const isNewApp = newAppKeywords.some(keyword => lowerMessage.includes(keyword));
  const isModification = modificationKeywords.some(keyword => lowerMessage.includes(keyword));

  // If context provided, it's likely a modification
  if (context && context.length > 0) {
    return 'modification';
  }

  // Check keywords
  if (isNewApp && !isModification) {
    return 'new_app';
  }

  if (isModification) {
    return 'modification';
  }

  // Default to modification if uncertain
  return 'modification';
}

/**
 * Generate implementation plan using Anthropic
 */
async function generatePlan(message, context = [], workspaceFiles = []) {
  const requestType = analyzeRequestType(message, context);

  // Build prompts
  const systemPrompt = buildPlanSystemPrompt();
  const userPrompt = buildPlanPrompt(message, context, workspaceFiles);

  // Call Anthropic
  const result = await chatCompletion(
    [{ role: 'user', content: userPrompt }],
    {
      system: systemPrompt,
      temperature: 0.3, // Lower temperature for more structured output
      maxTokens: 4096
    }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to generate plan');
  }

  // Parse JSON from response
  let planData;
  try {
    // Try to extract JSON if wrapped in markdown or extra text
    const content = result.content.trim();

    // Remove markdown code blocks if present
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    planData = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('Failed to parse plan JSON:', parseError);
    console.error('Raw response:', result.content);
    throw new Error(`Failed to parse plan: ${parseError.message}`);
  }

  // Add generated plan_id if missing
  if (!planData.plan_id) {
    planData.plan_id = uuidv4();
  }

  // Add metadata
  planData.request_type = requestType;
  planData.generated_at = new Date().toISOString();
  planData.model = result.model;
  planData.usage = result.usage;

  return planData;
}

/**
 * Estimate complexity based on plan characteristics
 */
function estimateComplexity(filesCount, hasMigrations, hasNewDependencies) {
  if (filesCount >= 8 || hasMigrations || hasNewDependencies > 2) {
    return 'high';
  }

  if (filesCount >= 3 || hasNewDependencies > 0) {
    return 'medium';
  }

  return 'low';
}

module.exports = {
  generatePlan,
  analyzeRequestType,
  buildPlanSystemPrompt,
  buildPlanPrompt,
  estimateComplexity
};
