# Context Gathering System

> Analyzes workspace structure, patterns, and content to provide AI with relevant context

## Overview

The Context Gathering System intelligently analyzes a codebase to provide relevant context to AI models. It respects token budgets and prioritizes files based on relevance to user requests.

## Components

### 1. FileStructureAnalyzer

Analyzes file structure and generates metadata.

```javascript
const { FileStructureAnalyzer } = require('./context');

const analyzer = new FileStructureAnalyzer('/path/to/workspace', {
  maxDepth: 5,
  ignorePatterns: ['node_modules', '.git', 'dist']
});

// Get file tree
const structure = await analyzer.getStructure();
console.log(`Found ${structure.stats.totalFiles} files`);

// Get flat file list
const files = await analyzer.getFileList();

// Find specific files
const apiFiles = await analyzer.findFiles('api');
const jsFiles = await analyzer.getFilesByLanguage('javascript');
```

**Features:**
- Recursive directory traversal with depth control
- File metadata (size, modified date, language detection)
- Language breakdown statistics
- Pattern matching for file search
- Ignores common build/dependency directories

### 2. PatternDetector

Detects frameworks, state management, API patterns, and tooling.

```javascript
const { PatternDetector } = require('./context');

const detector = new PatternDetector('/path/to/workspace');

// Detect all patterns
const patterns = await detector.detectAll();
console.log('Summary:', patterns.summary);

// Detect specific patterns
const frameworks = await detector.detectFrameworks();
const stateManagement = await detector.detectStateManagement();
const apiPatterns = await detector.detectAPIPatterns();
const buildTools = await detector.detectBuildTools();
const testingFrameworks = await detector.detectTestingFrameworks();
```

**Detects:**
- **Frontend:** React, Vue, Angular, Svelte
- **Backend:** Express, Fastify, Koa, NestJS, Django, Flask, FastAPI
- **Fullstack:** Next.js, Nuxt, Gatsby
- **State Management:** Redux, Zustand, MobX, Recoil, Jotai, Valtio, TanStack Query, SWR, Context API
- **API Patterns:** REST, GraphQL, tRPC, gRPC, WebSockets
- **Build Tools:** Webpack, Vite, Rollup, Parcel, esbuild, Turbopack
- **Testing:** Jest, Vitest, Mocha, React Testing Library, Cypress, Playwright

### 3. ContextGatherer

Main coordinator that orchestrates context gathering with token budget management.

```javascript
const { ContextGatherer } = require('./context');

const gatherer = new ContextGatherer('/path/to/workspace', {
  maxDepth: 5,
  tokenBudget: 50000
});

// Gather context with request-based prioritization
const context = await gatherer.gather('Add user authentication', 50000);

console.log('Context Summary:', context.summary);
console.log('Token Usage:', context.tokenUsage);
console.log('Files Loaded:', context.files.length);

// Access specific context parts
console.log('Patterns:', context.patterns.summary);
console.log('Dependencies:', context.dependencies.count);
console.log('Structure:', context.structure.stats);
```

## Context Object Structure

```javascript
{
  structure: {
    root: '/path/to/workspace',
    stats: {
      totalFiles: 150,
      totalDirectories: 30,
      totalSize: 2048576,
      languageBreakdown: {
        javascript: 85,
        typescript: 45,
        json: 20
      },
      largestFiles: [...]
    }
  },

  patterns: {
    frameworks: {
      frontend: [{ name: 'React', version: '^18.0.0', type: 'ui-library' }],
      backend: [{ name: 'Express', version: '^4.18.0', type: 'framework' }],
      fullstack: []
    },
    stateManagement: [
      { name: 'Zustand', version: '^4.0.0', type: 'lightweight' }
    ],
    apiPatterns: {
      rest: true,
      graphql: false,
      trpc: false,
      details: [...]
    },
    buildTools: [{ name: 'Vite', version: '^5.0.0' }],
    testingFrameworks: [{ name: 'Jest', version: '^29.0.0', type: 'unit' }],
    summary: 'Frontend: React | Backend: Express | State: Zustand | API: REST'
  },

  dependencies: {
    production: { react: '^18.0.0', ... },
    development: { jest: '^29.0.0', ... },
    count: { production: 15, development: 8 }
  },

  files: [
    {
      path: 'src/index.js',
      language: 'javascript',
      lines: 120,
      size: 4096,
      content: '...',
      loadStrategy: 'full',
      tokens: 1024
    },
    ...
  ],

  tokenUsage: {
    structure: 2456,
    patterns: 96,
    dependencies: 57,
    files: 7316,
    total: 9925
  },

  summary: 'Workspace: /path/to/workspace\nFiles: 150 | Directories: 30\n...'
}
```

## Smart File Loading

The system intelligently decides how to load files based on size and relevance:

### Loading Strategies

1. **Full Content** - Files < 200 lines
   - Complete file contents included
   - Best for small utility files, configs

2. **Outline** - Files 200-500 lines
   - Extracts imports, exports, function/class declarations
   - Provides structure without full content
   - Significantly reduces token usage

3. **Skip** - Files > 500 lines or binary files
   - Not included in context
   - Can be requested separately if needed

### Prioritization

Files are prioritized based on:

1. **Configuration files** (package.json, tsconfig.json) - Highest priority
2. **Entry points** (index, main, app, server) - High priority
3. **Request keyword matching** - Files matching user request terms
4. **File size** - Smaller files preferred (easier to fit in budget)
5. **Source over tests** - Main code over test files

## Token Budget Management

The system respects token budgets and stops loading files when budget is reached:

```javascript
// With strict budget
const context = await gatherer.gather('authentication', 10000);
// Will load highest priority files until 10000 tokens reached

// Check token usage
console.log(`Used ${context.tokenUsage.total} of 10000 tokens`);
console.log(`Files loaded: ${context.files.length}`);
```

Token estimation: ~1 token ≈ 4 characters (rough approximation)

## Usage Examples

### Example 1: Basic Context for Code Generation

```javascript
const { ContextGatherer } = require('./context');

const gatherer = new ContextGatherer('/workspace');
const context = await gatherer.gather('Add user login feature', 30000);

// Pass context to AI
const prompt = `
Workspace Context:
${context.summary}

Patterns:
${context.patterns.summary}

Request: Add user login feature

Based on the workspace context, generate code for user login.
`;
```

### Example 2: Find Specific Files

```javascript
const gatherer = new ContextGatherer('/workspace');

// Find all authentication-related files
const authFiles = await gatherer.findFiles(/auth.*\.(js|ts)$/);

// Find all React components
const components = await gatherer.findFiles('components');

// Get all TypeScript files
const tsFiles = await gatherer.getFilesByLanguage('typescript');
```

### Example 3: Get Detailed Structure

```javascript
const gatherer = new ContextGatherer('/workspace', { maxDepth: 3 });

// Get full file tree (separate from main context)
const tree = await gatherer.getDetailedTree();

console.log('Directory structure:', JSON.stringify(tree, null, 2));
```

## Integration with AgentOrchestrator

The Context Gatherer is designed to work seamlessly with the Agent Orchestrator:

```javascript
const { AgentOrchestrator } = require('../AgentOrchestrator');
const { ContextGatherer } = require('../context');

// In your agent workflow
const gatherer = new ContextGatherer(workspacePath);
const context = await gatherer.gather(userRequest, 50000);

// Pass context to orchestrator
const result = await orchestrator.executeAgenticMode(userRequest, {
  workspaceContext: context,
  tokenBudget: 100000
});
```

## Testing

Run the comprehensive test suite:

```bash
node tests/context/test-context-system.js
```

Tests cover:
- File structure analysis
- Pattern detection
- Context gathering
- Token budget management
- File prioritization

## Performance

- **File scanning:** ~100-500ms for typical project (< 1000 files)
- **Pattern detection:** ~50-200ms
- **Context gathering:** ~200-1000ms depending on file count and token budget
- **Memory usage:** Minimal - files loaded on-demand

## Configuration Options

```javascript
const gatherer = new ContextGatherer(workspacePath, {
  // Maximum directory depth to traverse
  maxDepth: 5,

  // Maximum tokens for context
  tokenBudget: 50000,

  // Custom ignore patterns
  ignorePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    // ... add more
  ],

  // Priority patterns for file matching
  priorityPatterns: [
    'auth',
    'user',
    'api'
  ]
});
```

## Best Practices

1. **Set appropriate token budgets** - Match your AI model's context window
2. **Use request keywords** - Helps prioritize relevant files
3. **Cache context** - Reuse context for related requests
4. **Adjust maxDepth** - Deeper = more files, but slower
5. **Monitor token usage** - Check `context.tokenUsage.total`

## Future Enhancements

- [ ] Cache file metadata to speed up repeated analysis
- [ ] Incremental updates based on file changes
- [ ] Advanced relevance scoring using embeddings
- [ ] Support for more languages and frameworks
- [ ] Custom pattern detection rules
- [ ] Integration with Git for change tracking
