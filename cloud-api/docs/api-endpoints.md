# Cloud API Endpoints

## Overview

The Local Studio Cloud API provides endpoints for AI-powered code generation with validation, signing, and real-time progress tracking.

**Base URL:** `http://localhost:3001/api`
**WebSocket URL:** `ws://localhost:3001/events`

---

## Bundle Generation

### POST /bundle/generate

Generate a signed code bundle with full validation and approval workflow.

**Request:**
```json
{
  "message": "Add user authentication with JWT",
  "context": [
    {
      "path": "src/server.js",
      "content": "..."
    }
  ],
  "workspaceFiles": ["src/routes/users.js", "src/models/User.js"],
  "appSpec": {
    "stack": "node-express",
    "database": "postgresql",
    "features": ["auth", "api"]
  },
  "requireApproval": true
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "task_1234567890_abc123",
  "message": "Bundle generation started. Connect to WebSocket for progress updates."
}
```

**WebSocket Progress Events:**

Connect to `ws://localhost:3001/events?taskId=task_1234567890_abc123` to receive real-time progress:

```javascript
// Phase events
{ "type": "task_start", "taskId": "...", "data": {} }
{ "type": "phase_start", "taskId": "...", "data": { "phase": "analyzing" } }
{ "type": "code_analyzing", "taskId": "...", "data": { "status": "started" } }
{ "type": "code_analyzing", "taskId": "...", "data": { "status": "completed" } }
{ "type": "code_planning", "taskId": "...", "data": { "status": "started" } }
{ "type": "code_planning", "taskId": "...", "data": { "status": "completed" } }

// Approval (if required)
{
  "type": "approval_required",
  "taskId": "...",
  "data": {
    "plan": { ... },
    "riskAssessment": {
      "level": "medium",
      "requiresApproval": true,
      "reasons": ["Database migrations present"]
    },
    "filesAffected": 5,
    "migrations": 2
  }
}

// Validation checks
{ "type": "validation_check_start", "taskId": "...", "data": { "check": "SyntaxCheck" } }
{ "type": "validation_check_complete", "taskId": "...", "data": { "check": "SyntaxCheck", "passed": true } }

// Completion
{
  "type": "task_complete",
  "taskId": "...",
  "data": {
    "tokensUsed": 45000,
    "estimatedCost": 0.21,
    "timeMs": 12500
  }
}
```

---

### GET /bundle/:bundleId

Download a previously generated bundle.

**Example:**
```
GET /api/bundle/bundle_abc123
```

**Response:**
```json
{
  "success": true,
  "bundle": {
    "bundle_id": "bundle_abc123",
    "bundle_type": "full",
    "created_at": "2026-01-31T10:30:00Z",
    "files": [...],
    "tests": [...],
    "migrations": [...],
    "commands": [...],
    "signature": {
      "algorithm": "RSA-SHA256",
      "value": "...",
      "keyId": "signing-key-v1",
      "timestamp": "2026-01-31T10:30:00Z"
    }
  }
}
```

---

### GET /bundle/status/:taskId

Check the status of an in-progress or completed bundle generation task.

**Example:**
```
GET /api/bundle/status/task_1234567890_abc123
```

**Response (Running):**
```json
{
  "success": true,
  "taskId": "task_1234567890_abc123",
  "status": "running",
  "startTime": 1706698200000,
  "phase": "validating"
}
```

**Response (Completed):**
```json
{
  "success": true,
  "taskId": "task_1234567890_abc123",
  "status": "completed",
  "startTime": 1706698200000,
  "completedTime": 1706698212500,
  "result": {
    "success": true,
    "taskId": "task_1234567890_abc123",
    "mode": "bundle",
    "bundle": { ... },
    "validation": { ... },
    "metrics": { ... }
  }
}
```

**Response (Awaiting Approval):**
```json
{
  "success": true,
  "taskId": "task_1234567890_abc123",
  "status": "awaiting_approval",
  "startTime": 1706698200000,
  "phase": "approval"
}
```

---

### POST /bundle/approval/:taskId

Submit approval or rejection for a high-risk plan.

**Request:**
```json
{
  "approved": true,
  "reason": null,
  "modifiedPlan": null
}
```

**Or reject:**
```json
{
  "approved": false,
  "reason": "Too risky - need more tests",
  "modifiedPlan": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Approval granted"
}
```

---

### POST /bundle/retry-validation/:taskId

Retry validation with different parameters (e.g., lower coverage threshold).

**Request:**
```json
{
  "coverageThreshold": 70,
  "skipChecks": []
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "passed": true,
    "blockers": [],
    "warnings": [],
    "suggestions": []
  }
}
```

---

### POST /bundle/regenerate/:taskId

Regenerate a bundle with fix instructions from validation failures.

**Request:**
```json
{
  "fixInstructions": [
    "Fix syntax errors in UserController.js",
    "Add missing import for bcrypt",
    "Increase test coverage to 80%"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "task_9876543210_xyz789",
  "message": "Bundle regeneration started"
}
```

*Note: Returns a new taskId. Use WebSocket to track progress.*

---

## Other Endpoints

### GET /

Get API information and available endpoints.

**Response:**
```json
{
  "name": "Local Studio Cloud API",
  "version": "1.0.0",
  "endpoints": {
    "chat": "POST /api/chat - Multi-mode chat (ask/plan/act)",
    "ask": "POST /api/chat/ask - Code explanations and debugging",
    "generate": "POST /api/generate - Full app generation",
    "plan": "POST /api/plan - Implementation planning",
    "bundle": { ... }
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here",
  "stack": "..." // Only in development mode
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (task/bundle doesn't exist)
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## WebSocket Connection

### Connect

```javascript
const ws = new WebSocket('ws://localhost:3001/events?taskId=task_1234567890_abc123');

ws.onopen = () => {
  console.log('Connected to progress stream');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Progress:', message.type, message.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

### Event Types

- `connected` - Initial connection confirmation
- `task_start` - Task started
- `phase_start` - New phase started
- `phase_progress` - Phase progress update
- `phase_complete` - Phase completed
- `code_analyzing` - Analysis phase updates
- `code_planning` - Planning phase updates
- `code_generating` - Generation phase updates
- `code_validating` - Validation phase updates
- `validation_check_start` - Validation check started
- `validation_check_complete` - Validation check completed
- `validation_summary` - All validation checks complete
- `approval_required` - User approval required
- `approval_received` - Approval submitted
- `plan_modified` - Plan was modified
- `task_complete` - Task completed successfully
- `task_error` - Task failed with error

---

## Rate Limits

- Bundle generation: 5 requests per minute per IP
- Status checks: 100 requests per minute per IP
- WebSocket connections: 10 concurrent connections per IP

---

## Authentication

Currently, the API is open for development. In production:

1. Obtain API key from dashboard
2. Include in requests:
   ```
   Authorization: Bearer YOUR_API_KEY
   ```

---

## Task Lifecycle

```
POST /bundle/generate
    ↓
Running (connect WebSocket)
    ↓
┌─→ Analyzing
│   ↓
│   Planning
│   ↓
│   [Approval Required?] → POST /bundle/approval/:taskId
│   ↓
│   Generating
│   ↓
│   Validating (6 checks)
│   ↓
│   [Validation Failed?] → POST /bundle/retry-validation/:taskId
│   │                       or POST /bundle/regenerate/:taskId
│   ↓
└── Complete (bundle ready)
    ↓
GET /bundle/:bundleId
```

---

## Best Practices

1. **Always use WebSocket** for real-time progress instead of polling status
2. **Handle approval timeouts** (5 minutes max)
3. **Verify bundle signatures** on client before applying
4. **Store taskId** to check status later if disconnected
5. **Implement retry logic** for network errors
6. **Show user approval UI** when `approval_required` event received

---

## Examples

See `/desktop-app/docs/bundle-handling.md` for complete integration examples.
