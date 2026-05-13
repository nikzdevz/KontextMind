# API Reference

Complete reference for all KontextMind HTTP API endpoints.

## Base URL

```
http://localhost:7331
```

## Response Format

All endpoints return JSON. Successful responses include the requested data. Errors include an `error` field with a description.

## Authentication

Currently no authentication required. The API is designed for local access. CORS is restricted to localhost.

---

## Health & Status

### GET /health

Server health check.

**Response:**

```json
{
  "ok": true,
  "service": "kontextmind",
  "phase": 6,
  "version": "0.1.0"
}
```

### GET /status

Project status.

**Response:**

```json
{
  "initialized": true,
  "project": "my-project",
  "mode": "readonly",
  "phase": 1,
  "server": {
    "running": true,
    "host": "127.0.0.1",
    "port": 7331,
    "startedAt": "2026-05-13T10:00:00Z"
  }
}
```

### GET /audit

Audit summary.

**Response:**

```json
{
  "project": {
    "initialized": true,
    "root": "/path/to/project"
  },
  "logs": {
    "apiEventsLog": true,
    "summaryLog": true,
    "qnaLog": true
  },
  "server": { ... },
  "timestamp": "2026-05-13T10:30:00Z"
}
```

---

## Ask Endpoints

### POST /:name/ask

Ask a question about a project.

**Parameters:**

- `name` (path) — Project name

**Request Body:**

```json
{
  "question": "What is this project about?",
  "mode": "chatbot-readonly",
  "sessionId": "optional-session-id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The question to ask |
| `mode` | string | No | Response mode: `readonly`, `chatbot-readonly` |
| `sessionId` | string | No | Session ID for multi-turn conversation |

**Response:**

```json
{
  "qa_id": "abc123",
  "answer": "This project is a...",
  "confidence": 0.85,
  "sources": [
    {
      "type": "qa",
      "name": "What is this project?",
      "relevance": 0.9
    }
  ],
  "tier": 3,
  "cached": false,
  "feedback_supported": true,
  "sessionId": "abc-123-xyz",
  "conversationTurn": 1
}
```

### POST /:name/sessions/:sessionId/ask

Ask a question in a specific session.

**Parameters:**

- `name` (path) — Project name
- `sessionId` (path) — Session ID

**Request Body:**

```json
{
  "question": "How does auth work?",
  "mode": "chatbot-readonly"
}
```

**Response:**

```json
{
  "qa_id": "def456",
  "answer": "Authentication is handled by...",
  "confidence": 0.78,
  "sources": [...],
  "tier": 4,
  "cached": false,
  "feedback_supported": true,
  "sessionId": "abc-123-xyz",
  "conversationTurn": 2
}
```

---

## Session Endpoints

### POST /:name/sessions

Create a new session.

**Parameters:**

- `name` (path) — Project name

**Request Body (optional):**

```json
{
  "projectName": "my-project"
}
```

**Response:**

```json
{
  "session": {
    "id": "abc-123-xyz",
    "projectName": "my-project",
    "projectRoot": "/path/to/project",
    "createdAt": "2026-05-13T10:00:00Z",
    "updatedAt": "2026-05-13T10:00:00Z",
    "messages": [],
    "context": {
      "topics": [],
      "entities": [],
      "intentHistory": []
    },
    "metadata": {
      "messageCount": 0,
      "userMessageCount": 0,
      "assistantMessageCount": 0,
      "totalTokens": 0,
      "averageConfidence": 0,
      "sourcesUsed": [],
      "startedAt": "2026-05-13T10:00:00Z",
      "lastActivityAt": "2026-05-13T10:00:00Z"
    }
  }
}
```

### GET /:name/sessions

List all sessions for a project.

**Parameters:**

- `name` (path) — Project name

**Response:**

```json
{
  "sessions": [
    {
      "id": "abc-123-xyz",
      "projectName": "my-project",
      "createdAt": "2026-05-13T10:00:00Z",
      "lastActivityAt": "2026-05-13T10:30:00Z",
      "messageCount": 5,
      "topics": ["authentication", "user management"],
      "preview": "How does authentication work?"
    }
  ]
}
```

### GET /:name/sessions/:sessionId

Get a specific session.

**Parameters:**

- `name` (path) — Project name
- `sessionId` (path) — Session ID

**Response:**

```json
{
  "session": {
    "id": "abc-123-xyz",
    "projectName": "my-project",
    "createdAt": "2026-05-13T10:00:00Z",
    "updatedAt": "2026-05-13T10:30:00Z",
    "messages": [
      {
        "id": "msg-1",
        "role": "user",
        "content": "How does authentication work?",
        "timestamp": "2026-05-13T10:00:00Z",
        "responseId": "response-1"
      },
      {
        "id": "msg-2",
        "role": "assistant",
        "content": "Authentication uses JWT tokens...",
        "timestamp": "2026-05-13T10:00:05Z",
        "responseId": "response-1"
      }
    ],
    "context": {
      "topics": ["authentication"],
      "entities": [
        { "id": "auth", "name": "auth.ts", "type": "file", "referenceCount": 2 }
      ],
      "intentHistory": ["How does authentication work?"]
    },
    "metadata": { ... }
  }
}
```

### GET /:name/sessions/:sessionId/context

Get conversation context for a session.

**Parameters:**

- `name` (path) — Project name
- `sessionId` (path) — Session ID
- `maxTurns` (query) — Maximum turns to include (optional)

**Response:**

```json
{
  "turns": [
    {
      "userMessage": "How does auth work?",
      "assistantMessage": "Authentication uses JWT tokens...",
      "responseId": "abc123",
      "timestamp": "2026-05-13T10:00:00Z"
    }
  ],
  "context": {
    "topics": ["authentication"],
    "entities": [
      { "id": "auth", "name": "auth.ts", "type": "file", "referenceCount": 1 }
    ]
  }
}
```

### GET /:name/sessions/:sessionId/stats

Get session statistics.

**Parameters:**

- `name` (path) — Project name
- `sessionId` (path) — Session ID

**Response:**

```json
{
  "messageCount": 10,
  "userMessageCount": 5,
  "assistantMessageCount": 5,
  "totalTokens": 15000,
  "averageConfidence": 0.82,
  "sourcesUsed": ["qa", "file_summary", "llm-synthesis"],
  "startedAt": "2026-05-13T10:00:00Z",
  "lastActivityAt": "2026-05-13T11:30:00Z"
}
```

### DELETE /:name/sessions/:sessionId

Delete a session.

**Parameters:**

- `name` (path) — Project name
- `sessionId` (path) — Session ID

**Response:**

```json
{
  "deleted": true
}
```

### POST /:name/sessions/:sessionId/messages

Add a message to a session.

**Parameters:**

- `name` (path) — Project name
- `sessionId` (path) — Session ID

**Request Body:**

```json
{
  "role": "user",
  "content": "Hello, how are you?"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | Message role: `user`, `assistant`, `system` |
| `content` | string | Yes | Message content |

**Response:**

```json
{
  "message": {
    "id": "msg-new",
    "role": "user",
    "content": "Hello, how are you?",
    "timestamp": "2026-05-13T10:30:00Z"
  }
}
```

---

## Feedback Endpoints

### POST /:name/feedback

Record feedback for a response.

**Parameters:**

- `name` (path) — Project name

**Request Body:**

```json
{
  "qa_id": "abc123",
  "signal": "helpful",
  "reason": "Clear explanation",
  "metadata": {
    "user_id": "user-123"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `qa_id` | string | Yes | Response ID |
| `signal` | string | Yes | Feedback signal: `helpful`, `not_helpful`, `neutral` |
| `reason` | string | No | Reason for feedback |
| `metadata` | object | No | Additional metadata |

**Response:**

```json
{
  "qa_id": "abc123",
  "recorded": true
}
```

### GET /:name/feedback/stats

Get feedback statistics.

**Parameters:**

- `name` (path) — Project name

**Response:**

```json
{
  "total": 100,
  "helpful": 45,
  "not_helpful": 15,
  "neutral": 40,
  "code_requests": 10,
  "code_request_dislikes": 8
}
```

### GET /:name/feedback/export

Export feedback data.

**Parameters:**

- `name` (path) — Project name
- `format` (query) — Format: `jsonl`, `json` (optional)
- `since` (query) — Filter by date (optional)

**Response:**

```json
{
  "project": "my-project",
  "exported_at": "2026-05-13T10:30:00Z",
  "total_records": 100,
  "format": "json",
  "data": [
    {
      "qa_id": "abc123",
      "question": "How does auth work?",
      "answer": "Authentication uses...",
      "feedback": {
        "signal": "helpful",
        "reason": "Clear explanation",
        "timestamp": "2026-05-13T10:00:00Z"
      },
      "qa_metadata": {
        "confidence": 0.85,
        "tier": 3,
        "sources": ["qa", "file_summary"],
        "llm_model": "gpt-4",
        "kb_version": "1.0.0",
        "code_request": false
      }
    }
  ]
}
```

---

## Dataset Endpoints

### POST /:name/dataset/export

Export training dataset.

**Parameters:**

- `name` (path) — Project name

**Request Body:**

```json
{
  "format": "jsonl",
  "minConfidence": 0.5,
  "includeCodeRequests": false,
  "apiOnly": false,
  "outputPath": "./data/training.jsonl"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | No | Output format: `jsonl`, `json`, `chatml`, `sharegpt` |
| `minConfidence` | number | No | Minimum confidence threshold (default: 0.5) |
| `includeCodeRequests` | boolean | No | Include code request responses (default: false) |
| `apiOnly` | boolean | No | Only include API-sourced data (default: false) |
| `outputPath` | string | No | Output file path |
| `since` | string | No | Export records since date |

**Response:**

```json
{
  "success": true,
  "path": "./data/training.jsonl",
  "recordCount": 150,
  "version": "1.0.0"
}
```

### GET /:name/dataset/stats

Get dataset statistics.

**Parameters:**

- `name` (path) — Project name
- `version` (query) — Specific version to get stats for (optional)

**Response:**

```json
{
  "totalRecords": 150,
  "filteredRecords": 120,
  "statistics": {
    "bySource": {
      "api": 80,
      "cli": 50,
      "mcp": 20
    },
    "byTier": {
      "0": 100,
      "1": 30,
      "2": 20
    },
    "byFeedback": {
      "helpful": 45,
      "neutral": 80,
      "not_helpful": 25
    },
    "averageQuality": 0.78,
    "sessionBased": 60,
    "conversationTurns": [1, 2, 3, 1, 2, 4],
    "codeRequests": 10,
    "codeRequestDislikes": 8
  },
  "latestVersion": "1.2.0",
  "versions": ["1.0.0", "1.1.0", "1.2.0"]
}
```

### GET /:name/dataset/versions

List dataset versions.

**Parameters:**

- `name` (path) — Project name

**Response:**

```json
{
  "versions": [
    {
      "version": "1.2.0",
      "createdAt": "2026-05-13T10:00:00Z",
      "recordCount": 150,
      "checksum": "abc123...",
      "parentVersion": "1.1.0",
      "changes": {
        "added": 20,
        "removed": 5,
        "modified": 10
      },
      "statistics": { ... }
    }
  ]
}
```

### POST /:name/dataset/validate

Validate dataset quality.

**Parameters:**

- `name` (path) — Project name

**Request Body:**

```json
{
  "minQuality": 0.6
}
```

**Response:**

```json
{
  "valid": true,
  "issues": [],
  "statistics": { ... }
}
```

**Validation Issues:**

```json
{
  "valid": false,
  "issues": [
    "Average quality (0.55) below threshold (0.6)",
    "High ratio of disliked code requests - consider filtering"
  ],
  "statistics": { ... }
}
```

---

## Graph Endpoints

### GET /graph

Get knowledge graph summary.

**Response:**

```json
{
  "nodes": 150,
  "edges": 200,
  "nodes_by_type": {
    "file": 80,
    "symbol": 50,
    "dependency": 20
  }
}
```

### GET /file-summary

Get file summary.

**Parameters:**

- `path` (query) — File path

**Response:**

```json
{
  "filePath": "src/auth/login.ts",
  "purpose": "Handles user authentication and login",
  "status": "generated",
  "note": "Summary requires @kontextmind/core"
}
```

### GET /symbol

Get symbol information.

**Parameters:**

- `name` (query) — Symbol name

**Response:**

```json
{
  "name": "authenticateUser",
  "note": "Full symbol search requires @kontextmind/core"
}
```

---

## KB Endpoints

### POST /kb/build

Build knowledge base.

**Request Body (optional):**

```json
{
  "mode": "chatbot",
  "mock": true
}
```

**Response:**

```json
{
  "success": true,
  "filesCreated": ["project-overview.md", "architecture.md"],
  "note": "Full KB build requires @kontextmind/core"
}
```

---

## Client Examples

### cURL

```bash
# Create session
curl -X POST http://localhost:7331/my-project/sessions \
  -H "Content-Type: application/json"

# Ask question
curl -X POST http://localhost:7331/my-project/sessions/abc-123-xyz/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How does auth work?"}'

# Record feedback
curl -X POST http://localhost:7331/my-project/feedback \
  -H "Content-Type: application/json" \
  -d '{"qa_id": "abc123", "signal": "helpful"}'

# Export dataset
curl -X POST http://localhost:7331/my-project/dataset/export \
  -H "Content-Type: application/json" \
  -d '{"format": "jsonl", "minConfidence": 0.5}'
```

### JavaScript

```javascript
const API_BASE = 'http://localhost:7331';

// Create session
async function createSession(projectName) {
  const res = await fetch(`${API_BASE}/${projectName}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}

// Ask question in session
async function askInSession(projectName, sessionId, question) {
  const res = await fetch(`${API_BASE}/${projectName}/sessions/${sessionId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, mode: 'chatbot-readonly' })
  });
  return res.json();
}

// Record feedback
async function recordFeedback(projectName, qaId, signal) {
  const res = await fetch(`${API_BASE}/${projectName}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qa_id: qaId, signal })
  });
  return res.json();
}

// Export dataset
async function exportDataset(projectName, options) {
  const res = await fetch(`${API_BASE}/${projectName}/dataset/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  return res.json();
}

// Usage
const { session } = await createSession('my-project');
const result = await askInSession('my-project', session.id, 'How does auth work?');
await recordFeedback('my-project', result.qa_id, 'helpful');
```

### Python

```python
import requests

API_BASE = 'http://localhost:7331'

def create_session(project_name):
    response = requests.post(f'{API_BASE}/{project_name}/sessions')
    return response.json()

def ask_in_session(project_name, session_id, question):
    response = requests.post(
        f'{API_BASE}/{project_name}/sessions/{session_id}/ask',
        json={'question': question, 'mode': 'chatbot-readonly'}
    )
    return response.json()

def record_feedback(project_name, qa_id, signal):
    response = requests.post(
        f'{API_BASE}/{project_name}/feedback',
        json={'qa_id': qa_id, 'signal': signal}
    )
    return response.json()

def export_dataset(project_name, format='jsonl', min_confidence=0.5):
    response = requests.post(
        f'{API_BASE}/{project_name}/dataset/export',
        json={'format': format, 'minConfidence': min_confidence}
    )
    return response.json()

# Usage
session = create_session('my-project')
result = ask_in_session('my-project', session['session']['id'], 'How does auth work?')
record_feedback('my-project', result['qa_id'], 'helpful')
```

---

## Error Responses

All errors return a JSON object with an `error` field:

```json
{
  "error": "Project not found",
  "message": "Detailed error message"
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid request body or parameters |
| 404 | Not Found | Project, session, or resource not found |
| 403 | Forbidden | CORS not allowed |
| 500 | Internal Server Error | Server error |

---

## WebSocket (Future)

WebSocket support is planned for future releases to enable real-time updates and streaming responses.