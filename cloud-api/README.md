# Local Studio Cloud API

Backend API server for Local Studio - AI-powered code generation and assistance.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```env
PORT=3001
ANTHROPIC_API_KEY=sk-ant-api03-xxx  # Get from https://console.anthropic.com/
JWT_SECRET=your-secret-key-here
```

### 3. Start Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on `http://localhost:3001`

## API Endpoints

### Health Check
```bash
GET /health
```

Returns: `{"status":"ok"}`

### API Info
```bash
GET /api
```

Returns list of available endpoints.

### Chat (AI Assistant) - Multi-mode
```bash
POST /api/chat
```

**Request body:**
```json
{
  "message": "User message",
  "mode": "ask|plan|act",
  "context": [
    {"path": "src/App.js", "content": "..."}
  ],
  "conversationHistory": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "plan": { /* optional, for act mode */ }
}
```

**Modes:**

- **ask**: Answer questions, explain concepts (returns markdown)
- **plan**: Generate implementation plans (returns JSON plan)
- **act**: Generate code changes (returns JSON with diffs)

### ASK Endpoint - Code Explanations & Debugging
```bash
POST /api/chat/ask
```

**Dedicated endpoint for code explanations, debugging help, and Q&A.**

**Request body:**
```json
{
  "message": "What does this function do?",
  "context": [
    {"path": "src/utils/helper.js", "content": "function code..."}
  ]
}
```

**Response:**
```json
{
  "response": "Markdown explanation with [file:line] references",
  "analysis": {
    "fileReferences": [
      {"file": "src/App.jsx", "line": 42, "description": "...", "raw": "[src/App.jsx:42]"}
    ],
    "codeBlocks": [
      {"language": "javascript", "lineCount": 10}
    ],
    "hasCode": true,
    "hasFileReferences": true
  },
  "usage": {"inputTokens": 150, "outputTokens": 300, "totalTokens": 450},
  "model": "claude-sonnet-4-5-20250929",
  "timestamp": "2026-01-27T09:00:00.000Z"
}
```

**Features:**
- Parses file references: `[filename:line]`, `` `filename:line` ``
- Extracts code blocks with language tags
- Detects error patterns
- 500KB context limit
- Input validation (400 on bad input)

**Example - ASK mode:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Explain React hooks",
    "mode": "ask"
  }'
```

**Example - PLAN mode:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Add dark mode toggle",
    "mode": "plan",
    "context": [
      {
        "path": "src/App.jsx",
        "content": "import React from '\''react'\'';\n\nfunction App() {\n  return <div>Hello</div>;\n}"
      }
    ]
  }'
```

**Example - ACT mode:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Implement the dark mode toggle",
    "mode": "act",
    "context": [
      {
        "path": "src/App.jsx",
        "content": "import React from '\''react'\'';\n\nfunction App() {\n  return <div>Hello</div>;\n}"
      }
    ]
  }'
```

### Generate (Full App Generation)
```bash
POST /api/generate
```

**Request body:**
```json
{
  "prompt": "Create a blog with authentication",
  "stack": "react-node",
  "database": "sqlite",
  "features": ["auth", "posts", "comments"]
}
```

**Supported stacks:**
- `react-node`
- `vue-express`
- `nextjs`
- `python-fastapi`
- `django`
- `rails`

### Plan (Implementation Planning)
```bash
POST /api/plan
```

**Request body:**
```json
{
  "request": "Add user authentication",
  "context": {
    "workspacePath": "/path/to/project",
    "stack": "react-node",
    "currentFiles": [
      {"path": "src/App.js", "content": "..."}
    ]
  }
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "mode": "ask|plan|act",
    "response": "...",
    "usage": {
      "inputTokens": 150,
      "outputTokens": 300,
      "totalTokens": 450
    },
    "model": "claude-sonnet-4-5-20250929",
    "timestamp": "2026-01-27T09:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Fallback Response (when API key not configured)
```json
{
  "success": false,
  "error": "Anthropic API key not configured...",
  "fallback": true,
  "data": {
    "mode": "ask",
    "response": "[ASK Mode - Mock Response] ...",
    "timestamp": "2026-01-27T09:00:00.000Z"
  }
}
```

## Error Handling

The API includes:
- **Automatic retries** (3x) for rate limits and server errors
- **Exponential backoff** for retry delays
- **Context truncation** for files > 20k tokens
- **File summarization** for very large files (> 2000 lines)

## Testing

### Without API Key
The server will return mock responses with `fallback: true` when no API key is configured.

### With API Key
1. Get an API key from https://console.anthropic.com/
2. Add it to `.env` file
3. Test with curl commands above

### Test ASK Mode (Multi-mode endpoint)
```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What are React hooks?","mode":"ask"}'
```

Expected: Markdown explanation of React hooks with usage token counts.

### Test ASK Endpoint (Dedicated)
```bash
curl -X POST http://localhost:3001/api/chat/ask \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Explain what this function does and identify any bugs",
    "context": [
      {
        "path": "src/utils/calculator.js",
        "content": "function calculateTotal(items) {\n  let total = 0;\n  for (let i = 0; i <= items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}"
      }
    ]
  }'
```

Expected:
- Detailed explanation of the function
- Identification of the off-by-one error with file reference `[src/utils/calculator.js:3]`
- Code examples showing the fix
- Analysis object with file references parsed

### Test PLAN Mode
```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Add a login form",
    "mode": "plan",
    "context": [{"path": "src/App.jsx", "content": "// existing code"}]
  }'
```

Expected: JSON plan with steps, files affected, risks, and estimates.

### Test ACT Mode
```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Create a Button component",
    "mode": "act"
  }'
```

Expected: JSON with file diffs and code changes.

## Architecture

```
src/
├── index.js              # Main server setup
├── routes/
│   ├── index.js         # Route registry
│   ├── chat.js          # Chat endpoint
│   ├── generate.js      # App generation endpoint
│   └── plan.js          # Planning endpoint
└── services/
    ├── anthropic.js     # Anthropic API client
    └── promptBuilder.js # Prompt construction
```

## Features

- ✅ Three AI modes: Ask, Plan, Act
- ✅ Context-aware responses (include file contents)
- ✅ Conversation history support
- ✅ Automatic retry with exponential backoff
- ✅ Rate limit handling
- ✅ Token usage tracking
- ✅ Large file truncation and summarization
- ✅ JSON validation for plan/act responses
- ✅ Graceful fallback when API key not configured

## Next Steps

1. **Set up Anthropic API key** in `.env`
2. **Test all three modes** with real API
3. **Integrate with desktop app** chat panel
4. **Add authentication** (JWT tokens)
5. **Implement rate limiting** per user
6. **Add response streaming** for real-time updates

## Notes

- Default model: `claude-sonnet-4-5-20250929`
- ASK mode: temp=0.7, max_tokens=4096
- ACT mode: temp=0.3, max_tokens=8192 (more precise, more tokens)
- Context limit: 20,000 tokens per request
- Files > 2000 lines are automatically summarized
