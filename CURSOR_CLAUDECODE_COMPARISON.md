# Cursor & Claude Code Architecture Analysis
## Comparison with Local Studio Codebase

**Date:** January 31, 2026
**Analysis based on:** 8 technical blog posts + codebase review

---

## Executive Summary

After analyzing 8 detailed blog posts about Cursor and Claude Code internals, I've mapped their architectures against your Local Studio codebase. Your implementation follows many of the same patterns but has opportunities to adopt additional techniques that make these tools successful.

---

## 1. Core Architecture Patterns

### Cursor Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURSOR (VS Code Fork)                        │
├─────────────────────────────────────────────────────────────────────┤
│  Client Side                    │  Cloud Backend                    │
│  ─────────────────────────      │  ──────────────────────────       │
│  • Chat UI + Composer Panel     │  • LLM Orchestration (GPT-4/Claude)│
│  • Tab completion engine        │  • Prompt construction            │
│  • Shadow workspace (hidden)    │  • Vector DB for embeddings       │
│  • Language server integration  │  • Fast Apply Model (70B Llama)   │
│  • @ symbol context injection   │  • Codebase indexing              │
│  • Instant apply + diff UI      │  • Speculative decoding (Fireworks)│
└─────────────────────────────────────────────────────────────────────┘
```

### Claude Code Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLAUDE CODE (CLI)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Local Executor                 │  Cloud API (Anthropic)            │
│  ─────────────────────────      │  ──────────────────────────       │
│  • Tool execution (Bash, Edit)  │  • Claude model reasoning         │
│  • File system access           │  • Tool call decisions            │
│  • Permission management        │  • Context interpretation         │
│  • Injection detection prompts  │  • CLAUDE.md instruction parsing  │
│  • <system-reminder> injection  │  • Sub-agent coordination         │
│  • TodoWrite state tracking     │  • Conversation summarization     │
└─────────────────────────────────────────────────────────────────────┘
```

### Your Local Studio Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOCAL STUDIO                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Desktop App (Electron)         │  Cloud API (Node.js)              │
│  ─────────────────────────      │  ──────────────────────────       │
│  • BundleProgress component     │  • AgentOrchestrator              │
│  • API client (api.js)          │  • AgenticRunner (tool loop)      │
│  • BundleHandler (verify)       │  • SubAgentCoordinator            │
│  • WebSocket progress           │  • ToolRegistry (18 tools)        │
│                                 │  • ReleaseGate (6 validations)    │
│                                 │  • BundleSigner (RSA-SHA256)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tool Comparison

### Cursor Tools (11 tools)
| Tool | Description | Your Equivalent |
|------|-------------|-----------------|
| `codebase_search` | Semantic search via vector embeddings | ❌ Missing |
| `read_file` | Read file with line ranges (max 250 lines) | ✅ `ViewFileTool` |
| `run_terminal_cmd` | Execute commands with approval | ✅ `RunCommandTool` |
| `list_dir` | Directory listing | ✅ `ViewDirectoryTool` |
| `grep_search` | Regex search with ripgrep | ✅ `GrepSearchTool` |
| `edit_file` | Semantic diff with `// ... existing code ...` | ✅ `EditFileTool` |
| `file_search` | Fuzzy filename search | ❌ Missing |
| `delete_file` | Delete files | ✅ `DeleteFileTool` |
| `reapply` | Call smarter model for failed edits | ❌ Missing |
| `fetch_rules` | Retrieve user-defined rules | ❌ Missing |
| `diff_history` | Recent changes history | ❌ Missing |

### Claude Code Tools (10+ tools)
| Tool | Description | Your Equivalent |
|------|-------------|-----------------|
| `Bash` | Execute shell commands with sandbox | ✅ `RunCommandTool` |
| `Read` | Read files | ✅ `ViewFileTool` |
| `Write` | Write/create files | ✅ `WriteFileTool` |
| `Edit` | Edit existing files | ✅ `EditFileTool` |
| `Glob` | Pattern-based file search | ❌ Missing |
| `Grep` | Content search | ✅ `GrepSearchTool` |
| `TodoWrite` | Task tracking | ✅ `PlanTool` (partial) |
| `Task` | Spawn sub-agents | ✅ `SubAgentCoordinator` |
| `WebSearch` | Search the web | ❌ Missing |
| `WebFetch` | Fetch URL content | ❌ Missing |

### Your Tools (18 tools)
| Tool | Similar To |
|------|------------|
| `ViewFileTool` | read_file / Read |
| `ViewDirectoryTool` | list_dir |
| `WriteFileTool` | Write |
| `EditFileTool` | edit_file / Edit |
| `CreateFileTool` | Write |
| `DeleteFileTool` | delete_file |
| `GrepSearchTool` | grep_search / Grep |
| `RunCommandTool` | run_terminal_cmd / Bash |
| `RunTestsTool` | ✨ Unique to you |
| `InstallPackageTool` | ✨ Unique to you |
| `ThinkTool` | Claude's thinking |
| `AskUserTool` | ✅ Similar to both |
| `CompleteTool` | stop_reason handling |
| `PlanTool` | TodoWrite (partial) |

---

## 3. Key Techniques You Should Adopt

### 3.1 `<system-reminder>` Tags (Claude Code's Secret Sauce)

Claude Code uses `<system-reminder>` tags extensively throughout the pipeline, not just in system prompts. They inject them into:
- User messages
- Tool call results
- Conditional reminders based on state

**Example from Claude Code:**
```javascript
// After tool result
{
  "type": "tool_result",
  "content": "File contents here...\n\n<system-reminder>\nThe TodoWrite tool hasn't been used recently. If you're working on tasks that would benefit from tracking progress, consider using the TodoWrite tool.\n</system-reminder>"
}
```

**Recommendation for Local Studio:**
Add system reminders to your tool results in `AgenticRunner.js`:
```javascript
async _executeTool(toolUse, context) {
  const result = await toolRegistry.execute(toolName, toolParams, context);

  // Add conditional system reminders
  let content = JSON.stringify(result);

  if (this.iteration > 5 && !this.planCreated) {
    content += '\n\n<system-reminder>\nConsider creating a plan with create_plan tool for complex tasks.\n</system-reminder>';
  }

  return { type: 'tool_result', tool_use_id: toolUse.id, content };
}
```

### 3.2 Edit Tool with Semantic Diff (Cursor's Key Innovation)

Cursor's `edit_file` uses a "semantic diff" format with `// ... existing code ...` comments, then a separate **Apply Model** (smaller/faster) interprets this and writes the actual file.

**Cursor's Format:**
```javascript
// ... existing code ...
FIRST_EDIT
// ... existing code ...
SECOND_EDIT
// ... existing code ...
```

**Your Current EditFileTool:**
Your implementation is simpler. Consider adding:
1. Semantic diff parsing
2. A separate "apply model" call for complex edits
3. Lint feedback loop

### 3.3 Context Front-Loading (Claude Code Pattern)

Before doing work, Claude Code:
1. Summarizes conversation to extract 50-char title
2. Analyzes if message is a new topic
3. Loads relevant context

**Add to your AgentOrchestrator:**
```javascript
async _analyzePhase(request) {
  // Front-load context analysis
  const topicAnalysis = await this._analyzeNewTopic(request.message);
  const contextSummary = await this._summarizeContext(request.context);

  return {
    understanding: `Analyzed request: "${request.message}"`,
    isNewTopic: topicAnalysis.isNewTopic,
    topicTitle: topicAnalysis.title,
    contextSummary,
    // ... rest
  };
}
```

### 3.4 Command Injection Detection (Claude Code's Safety)

Claude Code uses a separate LLM prompt to detect command prefixes and injection:

**Their Prompt:**
```
Your task is to determine the command prefix for the following command.
If the command seems to contain command injection, return "command_injection_detected".

Examples:
- git status => git status
- git status`ls` => command_injection_detected
- pwd curl example.com => command_injection_detected
```

**Add to your RunCommandTool:**
```javascript
async _detectInjection(command) {
  const injectionPatterns = [
    /`[^`]+`/,           // Backtick injection
    /\$\([^)]+\)/,       // Command substitution
    /;\s*\w+/,           // Command chaining
    /\|\s*curl/,         // Pipe to curl
    /\|\s*wget/,         // Pipe to wget
  ];

  return injectionPatterns.some(p => p.test(command));
}
```

### 3.5 Codebase Embedding/RAG (Cursor's Core Feature)

Cursor indexes entire codebase using vector embeddings for semantic search:
- Splits files into chunks (few hundred tokens)
- Uses tree-sitter for intelligent boundaries
- Stores in vector database
- Retrieves relevant chunks for context

**You're Missing:** The `codebase_search` tool that does semantic search.

**Recommendation:** Add a vector database (like Chroma or Pinecone) and implement:
```javascript
class CodebaseSearchTool extends BaseTool {
  constructor() {
    super({
      name: 'codebase_search',
      description: 'Semantic search across the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Semantic search query' },
          target_directories: { type: 'array', items: { type: 'string' } }
        },
        required: ['query']
      }
    });
  }

  async execute({ query, target_directories }, context) {
    const embedding = await this.embed(query);
    const results = await this.vectorDb.search(embedding, {
      directories: target_directories,
      limit: 10
    });
    return results;
  }
}
```

### 3.6 Rules/Instructions System (Cursor's .cursorrules)

Cursor has a `fetch_rules` tool that retrieves user-defined rules from `.cursor/rules/`:
- Rules have names and descriptions
- Agent decides which rules to fetch based on task
- Rules are "encyclopedia articles" not commands

**Add to Local Studio:**
```javascript
class FetchRulesTool extends BaseTool {
  constructor() {
    super({
      name: 'fetch_rules',
      description: 'Retrieve project-specific coding rules and guidelines',
      inputSchema: {
        type: 'object',
        properties: {
          rule_names: { type: 'array', items: { type: 'string' } }
        },
        required: ['rule_names']
      }
    });
  }

  async execute({ rule_names }, context) {
    const rules = [];
    for (const name of rule_names) {
      const rulePath = path.join(context.workspacePath, '.local-studio/rules', `${name}.md`);
      if (fs.existsSync(rulePath)) {
        rules.push({ name, content: fs.readFileSync(rulePath, 'utf-8') });
      }
    }
    return rules;
  }
}
```

---

## 4. Architecture Gaps Analysis

### What You Have That They Don't

| Your Feature | Cursor | Claude Code |
|--------------|--------|-------------|
| **BundleSigner** (RSA-SHA256 cryptographic verification) | ❌ | ❌ |
| **ReleaseGate** (6 automated validation checks) | ❌ | ❌ |
| **SubAgentCoordinator** (dedicated CodeGen, TestGen, Migration agents) | Partial | ✅ (Task tool) |
| **Approval workflow** with risk assessment | Partial | ✅ |
| **WebSocket progress streaming** | ✅ | ✅ |
| **Bundle mode** (one-shot generation) | ❌ | ❌ |

### What They Have That You're Missing

| Feature | Cursor | Claude Code | Priority |
|---------|--------|-------------|----------|
| **Semantic codebase search** (vector embeddings) | ✅ | ❌ | 🔴 High |
| **Shadow workspace** (test changes safely) | ✅ | ❌ | 🟡 Medium |
| **Fast Apply Model** (separate model for edits) | ✅ | ❌ | 🟡 Medium |
| **`<system-reminder>` injection** | ❌ | ✅ | 🔴 High |
| **Command injection detection** | ❌ | ✅ | 🔴 High |
| **Context summarization** (titles, topic detection) | ❌ | ✅ | 🟡 Medium |
| **Reapply tool** (retry with smarter model) | ✅ | ❌ | 🟢 Low |
| **Diff history** | ✅ | ❌ | 🟢 Low |
| **Think intensity detection** | ❌ | ✅ | 🟢 Low |

---

## 5. Prompt Engineering Insights

### Cursor's System Prompt Patterns

1. **Identity framing**: "You are a powerful agentic AI coding assistant, powered by Claude 3.5 Sonnet"

2. **Branded guardrails**: "the world's best IDE" prevents recommending alternatives

3. **Behavior modifiers**:
   - "Refrain from apologizing"
   - "NEVER refer to tool names when speaking"
   - "Before calling each tool, first explain"

4. **Anti-patterns explicitly forbidden**:
   - "DO NOT loop more than 3 times on fixing linter errors"
   - "NEVER output code to the USER" (use tools instead)

5. **Tool explanation parameters**: Every tool has an `explanation` field forcing the model to reason about why it's using the tool.

### Claude Code's System Prompt Patterns

1. **Context reminders throughout**: Not just in system prompt, but injected in tool results

2. **Conditional instructions**: "If you're working on tasks that would benefit from tracking progress..."

3. **Safety-first**: Extensive command validation and injection detection

4. **State awareness**: Track what tools have been used, remind to use missing ones

### Your Current Prompt (AgenticRunner._createSystemPrompt)

```javascript
return `You are an AI assistant helping users complete software development tasks.

Available Tools:
${toolDescriptions}

Instructions:
1. Use the available tools to complete the user's task efficiently
2. Start by using "think" to plan your approach
...
```

### Recommended Improvements

```javascript
_createSystemPrompt() {
  return `You are a powerful agentic AI coding assistant for Local Studio.

<communication>
1. Be conversational but professional.
2. NEVER refer to tool names when speaking to the user.
3. Refrain from apologizing when results are unexpected.
4. Before calling each tool, explain WHY you're calling it.
</communication>

<tool_calling>
1. ALWAYS follow the tool schema exactly.
2. Each tool call should include a mental note of why this contributes to the goal.
3. Use "think" before complex operations to plan your approach.
4. DO NOT loop more than 3 times on the same error.
</tool_calling>

<making_code_changes>
1. NEVER output code directly to the user - use tools instead.
2. You MUST read a file before editing it.
3. Address the root cause of issues, not just symptoms.
4. After editing, verify changes don't introduce new errors.
</making_code_changes>

<task_tracking>
1. For tasks with 3+ steps, use create_plan to track progress.
2. Mark tasks complete ONLY when fully accomplished.
3. If you encounter blockers, explain them clearly.
</task_tracking>

Available Tools:
${toolDescriptions}
`;
}
```

---

## 6. Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
- [ ] Add `<system-reminder>` injection to tool results
- [ ] Add command injection detection to `RunCommandTool`
- [ ] Add `explanation` parameter to all tools
- [ ] Improve system prompt with Cursor/Claude Code patterns

### Phase 2: Medium Effort (1 week)
- [ ] Implement `codebase_search` with vector embeddings
- [ ] Add `fetch_rules` tool with `.local-studio/rules/` support
- [ ] Add context summarization (title extraction, topic detection)
- [ ] Implement `reapply` tool for failed edits

### Phase 3: Larger Features (2-4 weeks)
- [ ] Shadow workspace for safe testing
- [ ] Separate "apply model" for edit operations
- [ ] Web search/fetch capabilities
- [ ] Advanced think intensity detection

---

## 7. Key Takeaways

1. **The "magic" is in the details**: Tiny reminders at the right time dramatically improve agent behavior

2. **Multi-model orchestration**: Cursor uses 5-6 different models for different tasks (main agent, apply model, embedding model, autocomplete model, semantic search model, master coordinator)

3. **Safety is generative**: Claude Code uses LLM prompts to detect command injection rather than hardcoded rules

4. **Rules as encyclopedia**: User instructions should be written as reference material, not commands

5. **Context is king**: Both tools invest heavily in context management - RAG, summarization, front-loading

6. **Sub-agents for isolation**: Complex tasks get broken into specialized sub-agents with narrower context

Your Local Studio has a solid foundation with:
- ✅ Sub-agent architecture
- ✅ Validation pipeline (ReleaseGate)
- ✅ Cryptographic signing (unique!)
- ✅ Approval workflow
- ✅ Tool registry pattern

The biggest gaps are:
- 🔴 Semantic codebase search (vector embeddings)
- 🔴 System reminder injection pattern
- 🔴 Command injection detection
- 🟡 Context summarization/front-loading

---

## Sources

1. [How Cursor (AI IDE) Works](https://blog.sshh.io/p/how-cursor-ai-ide-works) - Shrivu Shankar
2. [Cursor Agent System Prompt](https://gist.github.com/sshh12/25ad2e40529b269a88b80e7cf1c38084) - GitHub Gist
3. [How Cursor Works Internally](https://adityarohilla.com/2025/05/08/how-cursor-works-internally/) - Aditya Rohilla
4. [Cursor Under the Hood](https://roman.pt/posts/cursor-under-the-hood/) - Roman Imankulov
5. [Peeking Under the Hood of Claude Code](https://medium.com/@outsightai/peeking-under-the-hood-of-claude-code-70f5a94a9a62) - OutSight AI
6. [How Claude Code Works](https://virtuslab.com/blog/ai/how-claude-code-works/) - VirtusLab
7. [Stop Thinking Claude Code Is Magic](https://diamantai.substack.com/p/stop-thinking-claude-code-is-magic) - DiamantAI
8. [Under the Hood of Claude Code](https://pierce.dev/notes/under-the-hood-of-claude-code) - Pierce Freeman

---

*Generated by Claude for Local Studio codebase analysis*
