# KontextMind API Server - Enhancement Proposal

## Architecture Overview

```
Production App → Frontend (Widget) → KontextMind Container (API)
                                          ├── Project Management
                                          ├── LLM Configuration
                                          └── Cloned Repos (Read-Only)
```

**Security Model:** KontextMind operates in isolated containers with read-only access to cloned repositories. Even if compromised via prompt injection, production code remains protected.

---

## Current API Server

### Technology
- **Framework:** Pure Node.js HTTP server (no Express/Fastify)
- **Port:** 7331 (configurable)
- **Host:** 127.0.0.1 (localhost)

### Existing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/status` | Server status |
| `POST` | `/ask` | Ask a question |
| `POST` | `/sessions` | Create session |
| `GET` | `/sessions` | List sessions |
| `GET` | `/sessions/:id` | Get session |
| `DELETE` | `/sessions/:id` | Delete session |
| `GET` | `/sessions/:id/context` | Conversation context |
| `GET` | `/graph` | Knowledge graph stats |
| `GET` | `/file-summary` | File summary |
| `GET` | `/symbol` | Symbol search |
| `POST` | `/dataset/export` | Export dataset |
| `GET` | `/dataset/stats` | Dataset stats |
| `GET` | `/dataset/versions` | Dataset versions |
| `GET` | `/audit` | Audit info |
| `POST` | `/kb/build` | KB rebuild |

### Current Limitations
- No authentication
- Hardcoded CORS (localhost only)
- No streaming
- Basic error responses
- No progress tracking

---

## Proposed Enhancements

### Priority Matrix

| Priority | Feature | Benefit |
|----------|---------|---------|
| P0 | API Key Authentication | Multi-tenant security |
| P0 | Project Management APIs | Git-based onboarding |
| P0 | LLM Provider APIs | Per-project AI config |
| P1 | Progress Tracking | Setup transparency |
| P1 | Real-time Streaming (SSE) | UX improvement |
| P2 | OpenAPI Documentation | Developer experience |
| P2 | Webhooks | External integrations |
| P3 | SDK Libraries | Integration speed |

**Note:** Rate limiting has been intentionally removed - the tool is free and open to all users.

---

## 1. Authentication & Security

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Tenant login |
| `POST` | `/auth/token` | Get API token |
| `POST` | `/auth/refresh` | Refresh JWT |
| `POST` | `/auth/verify` | Verify API key |

### Features
- API Key authentication via `X-API-Key` header
- JWT tokens for complex auth flows
- Configurable CORS origins (not hardcoded localhost)

### Security: Read-Only Mode
- All file write operations return `403 Forbidden`
- Git write operations blocked
- Audit log for all access

---

## 2. Project Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Register + clone project |
| `GET` | `/projects` | List tenant's projects |
| `GET` | `/projects/:id` | Project details |
| `DELETE` | `/projects/:id` | Remove project |
| `POST` | `/projects/:id/sync` | Sync from Git |
| `POST` | `/projects/:id/reset` | Reset container |
| `GET` | `/projects/:id/status` | Container health |
| `GET` | `/projects/:id/files/*` | Read file content |

### Register Project Request

```json
{
  "name": "my-production-app",
  "gitUrl": "https://github.com/org/my-app.git",
  "branch": "main",
  "llmProvider": {
    "provider": "anthropic",
    "apiKey": "sk-ant-xxxx",
    "model": "claude-sonnet-4-20250514"
  }
}
```

---

## 3. LLM Provider Configuration APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/providers` | List available providers |
| `GET` | `/providers/:name/models` | List models |
| `POST` | `/providers/test` | Test connection |
| `GET` | `/projects/:id/provider` | Get provider config |
| `POST` | `/projects/:id/provider` | Configure provider |
| `PATCH` | `/projects/:id/provider` | Update provider |

### Configure Provider Request

```json
{
  "provider": "openai",
  "apiKey": "sk-xxxx",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4-turbo",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

### Supported Providers
- **Anthropic** - Claude models (claude-sonnet-4, claude-opus-4)
- **OpenAI** - GPT models (gpt-4, gpt-4-turbo, gpt-3.5-turbo)
- **Ollama** - Local models (llama3, mistral, codellama)
- **Google** - Gemini models (gemini-pro, gemini-ultra)
- **Groq** - Fast inference (llama3-70b, mixtral-8x7b)
- **DeepSeek** - Cost-effective (deepseek-chat, deepseek-coder)
- **Qwen** - Alibaba models (qwen-turbo, qwen-max)

---

## 4. Pipeline & Progress Tracking APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/pipeline/status` | Overall status |
| `GET` | `/projects/:id/pipeline/steps` | Step details |
| `GET` | `/projects/:id/pipeline/stream` | Real-time SSE |
| `POST` | `/projects/:id/pipeline/trigger` | Start/pause/resume |
| `GET` | `/projects/:id/readiness` | Readiness check |

### Pipeline Flow

```
Register → Clone → Scan → Index → Summarize → KB Build
                              (hours for large repos)
```

### Pipeline Status Response

```json
{
  "projectId": "proj-abc123",
  "overallStatus": "in_progress",
  "percentComplete": 67,
  "estimatedSecondsRemaining": 1800,

  "steps": [
    { "name": "clone", "status": "completed" },
    { "name": "scan", "status": "completed" },
    { "name": "index", "status": "completed" },
    {
      "name": "summarize",
      "status": "in_progress",
      "currentFile": "src/services/auth.ts",
      "details": {
        "totalFiles": 892,
        "completedFiles": 340,
        "failedFiles": 2
      }
    },
    { "name": "kb_build", "status": "pending" }
  ],

  "canAnswerQuestions": false,
  "readinessMessage": "Summarization 38% complete. Ready in ~30 min."
}
```

### Readiness Check Response

```json
{
  "ready": true,
  "canAnswerQuestions": true,
  "stages": {
    "clone": { "complete": true },
    "scan": { "complete": true },
    "index": { "complete": true },
    "summarize": { "complete": true, "files": 892 },
    "kb_build": { "complete": true }
  },
  "stats": {
    "totalFiles": 892,
    "totalSymbols": 4521,
    "totalSummaries": 892,
    "knowledgeBaseSize": "12mb"
  }
}
```

### SSE Progress Stream

```javascript
GET /projects/:id/pipeline/stream

event: progress
data: {"step": "summarize", "percent": 38, "currentFile": "src/auth.ts"}

event: file_completed
data: {"file": "src/services/auth.ts", "status": "success"}

event: pipeline_completed
data: {"message": "Project ready for questions!"}
```

---

## 5. Auto Learn Configuration APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/learning/config` | Get learning config |
| `PUT` | `/projects/:id/learning/config` | Update learning config |
| `POST` | `/projects/:id/learning/trigger` | Manual sync |
| `GET` | `/projects/:id/learning/stats` | Learning statistics |
| `GET` | `/projects/:id/learning/patterns` | Learned patterns |

### Learning Configuration Request

```json
{
  "enabled": true,

  "triggers": {
    "autoSync": true,
    "syncIntervalMinutes": 30,
    "syncOnConversationEnd": true,
    "syncOnFeedbackReceived": true
  },

  "sources": {
    "conversations": true,
    "feedback": true,
    "codeChanges": false,
    "taskCompletions": true,
    "searchQueries": false
  },

  "thresholds": {
    "minConfidenceToLearn": 0.7,
    "minOccurrencesBeforePattern": 3,
    "failureThresholdToAlert": 5
  },

  "retention": {
    "learnedPatternsDays": 90,
    "conversationHistoryDays": 30,
    "feedbackHistoryDays": 60
  },

  "feedbackLoop": {
    "enabled": true,
    "collectFrom": {
      "explicitRatings": true,
      "implicitSignals": true,
      "conversationOutcome": true
    },
    "learnFrom": {
      "cacheHits": true,
      "cacheMisses": true,
      "fallbacks": true
    }
  }
}
```

### Learning Stats Response

```json
{
  "enabled": true,
  "lastSync": "2026-05-16T10:30:00Z",
  "patternsLearned": 45,

  "outcomes": {
    "total": 128,
    "successful": 98,
    "failed": 30,
    "successRate": 76.5
  },

  "patterns": [
    { "pattern": "code_write", "frequency": 45, "successRate": 82 }
  ],

  "antiPatterns": [
    { "pattern": "avoid_complex_nesting", "occurrences": 12 }
  ],

  "suggestions": [
    {
      "category": "approach",
      "title": "Use incremental commits",
      "priority": "high",
      "confidence": 0.88
    }
  ]
}
```

---

## 6. Conversation APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/conversations` | Create conversation |
| `GET` | `/conversations` | List conversations |
| `GET` | `/conversations/:id` | Get conversation |
| `DELETE` | `/conversations/:id` | Delete conversation |
| `PATCH` | `/conversations/:id` | Update metadata |
| `GET` | `/conversations/:id/messages` | Paginated messages |
| `POST` | `/conversations/:id/messages` | Send message |
| `POST` | `/conversations/:id/feedback` | Submit feedback |
| `GET` | `/conversations/:id/summary` | AI summary |
| `GET` | `/conversations/:id/stream` | SSE for streaming |

---

## 7. Streaming & Real-time

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/stream/ask` | Streaming response |
| `GET` | `/stream/conversations/:id/events` | SSE events |

### SSE Events
- `message_start` - Message begins
- `message_delta` - Token-by-token updates
- `message_end` - Message complete
- `typing_start` - Agent typing
- `typing_end` - Agent finished

---

## 8. Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/webhooks` | List webhooks |
| `POST` | `/projects/:id/webhooks` | Register webhook |
| `DELETE` | `/projects/:id/webhooks/:wid` | Remove webhook |

### Webhook Events

```
project.cloned, project.synced, project.indexed, project.error
conversation.created, conversation.updated, conversation.deleted
feedback.received, learning.pattern_learned, learning.quality_degraded
```

---

## 9. Multi-Tenant Support

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tenants` | Create tenant |
| `GET` | `/tenants/:id` | Get tenant |
| `GET` | `/tenants/:id/usage` | Usage stats |
| `GET` | `/tenants/:id/limits` | Resource limits |

---

## 10. Git Operations APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/:id/clone` | Trigger clone |
| `POST` | `/projects/:id/pull` | Pull latest |
| `GET` | `/projects/:id/git/status` | Git status |
| `GET` | `/projects/:id/git/log` | Commit history |
| `POST` | `/projects/:id/git/webhook` | Register Git webhook |
| `GET` | `/projects/:id/diff` | See changes |

---

## 11. Standardized Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req-abc123",
    "projectId": "proj-abc123",
    "timestamp": "2026-05-16T...",
    "processingTime": 150
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUESTION",
    "message": "Question must be non-empty",
    "field": "question",
    "suggestion": "Provide a clear, specific question"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-05-16T..."
  }
}
```

---

## 12. Complete Endpoint Structure

```
/auth
  POST /auth/login
  POST /auth/token
  POST /auth/refresh
  POST /auth/verify

/health
  GET /health

/tenants
  POST /tenants
  GET /tenants/:id
  GET /tenants/:id/usage

/providers
  GET /providers
  GET /providers/:name/models
  POST /providers/test

/projects
  POST /projects
  GET /projects
  GET /projects/:id
  DELETE /projects/:id
  POST /projects/:id/sync
  POST /projects/:id/reset
  GET /projects/:id/status
  GET /projects/:id/files/*

/projects/:id/provider
  GET /projects/:id/provider
  POST /projects/:id/provider
  PATCH /projects/:id/provider

/projects/:id/pipeline
  GET /projects/:id/pipeline/status
  GET /projects/:id/pipeline/steps
  GET /projects/:id/pipeline/stream
  POST /projects/:id/pipeline/trigger

/projects/:id/readiness
  GET /readiness

/projects/:id/learning
  GET /projects/:id/learning/config
  PUT /projects/:id/learning/config
  POST /projects/:id/learning/trigger
  GET /projects/:id/learning/stats
  GET /projects/:id/learning/patterns

/projects/:id/git
  GET /projects/:id/git/status
  GET /projects/:id/git/log
  POST /projects/:id/git/webhook

/projects/:id/webhooks
  GET /projects/:id/webhooks
  POST /projects/:id/webhooks
  DELETE /projects/:id/webhooks/:wid

/projects/:id/audit
  GET /projects/:id/audit-log

/conversations
  POST /conversations
  GET /conversations
  GET /conversations/:id
  DELETE /conversations/:id
  PATCH /conversations/:id
  GET /conversations/:id/messages
  POST /conversations/:id/messages
  POST /conversations/:id/feedback
  GET /conversations/:id/summary
  GET /conversations/:id/stream

/ask
  POST /ask

/stream
  POST /stream/ask
  GET /stream/conversations/:id/events

/docs
  GET /docs
```

---

## 13. Container Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   KontextMind Container                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                API Server (:7331)                         │   │
│  │  • Auth          • Project Management                     │   │
│  │  • Webhooks       • Multi-Tenant                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              KontextMind Core                             │   │
│  │  • Ask Service    • Learning Engine                        │   │
│  │  • Indexing       • Summarization                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                Cloned Repos (Read-Only)                   │   │
│  │  /projects/proj-1/                                        │   │
│  │  /projects/proj-2/                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. UI Integration Example

```javascript
// React setup progress component
function ProjectSetupProgress({ projectId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/projects/${projectId}/pipeline/stream`);

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setStatus(prev => ({ ...prev, ...data }));
    });

    eventSource.addEventListener('pipeline_completed', () => {
      setStatus(prev => ({ ...prev, ready: true }));
    });

    return () => eventSource.close();
  }, [projectId]);

  if (status?.ready) {
    return <ChatWidget projectId={projectId} />;
  }

  return (
    <div className="setup-progress">
      <h3>Setting up... {status?.percentComplete}%</h3>
      <Steps current={status?.currentStep}>
        <Step name="Clone" done={status.steps.clone.complete} />
        <Step name="Scan" done={status.steps.scan.complete} />
        <Step name="Index" done={status.steps.index.complete} />
        <Step name="Summarize" progress={status.steps.summarize.progress} />
        <Step name="Build KB" pending />
      </Steps>
    </div>
  );
}
```

---

## Implementation Priority

| Phase | Features |
|-------|----------|
| **Phase 1** | API Key Auth, Project Registration, LLM Config |
| **Phase 2** | Pipeline Progress, Readiness Check, SSE |
| **Phase 3** | Auto Learn Config, Webhooks |
| **Phase 4** | OpenAPI Docs, SDK Libraries, Multi-Tenant |

---

## 15. Client Integration Guide

### SDK Installation

```bash
# JavaScript/TypeScript
npm install @kontextmind/client

# Python
pip install kontextmind

# Go
go get github.com/kontextmind/client-go

# Ruby
gem install kontextmind
```

### Basic Connection

```javascript
// JavaScript - Connect to hosted service
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  apiKey: process.env.KONtextmind_API_KEY,
  baseUrl: 'https://api.kontextmind.io', // SaaS version
  projectId: 'proj-abc123'
});

// Or connect to self-hosted
const client = new KontextMindClient({
  apiKey: process.env.KONtextmind_API_KEY,
  baseUrl: 'http://localhost:7331', // Local dev
  projectId: 'proj-abc123'
});
```

```python
# Python - Connect to hosted service
from kontextmind import Client

client = Client(
    api_key=os.environ['KONtextmind_API_KEY'],
    base_url='https://api.kontextmind.io',
    project_id='proj-abc123'
)
```

### Client Configuration Options

```javascript
const client = new KontextMindClient({
  // Required
  apiKey: 'sk-xxx',
  projectId: 'proj-abc123',

  // Optional
  baseUrl: 'https://api.kontextmind.io',
  timeout: 30000,           // Request timeout in ms
  retries: 3,              // Auto-retry on failure
  retryDelay: 1000,        // Delay between retries
  debug: false,             // Enable debug logging

  // Streaming options
  streamChunkSize: 64,     // Chunk size for streaming

  // Headers (for custom metadata)
  headers: {
    'X-Customer-ID': 'customer-123'
  }
});
```

### Environment Configuration

```bash
# .env file
KONtextmind_API_KEY=sk-xxx
KONtextmind_PROJECT_ID=proj-abc123
KONtextmind_BASE_URL=https://api.kontextmind.io

# Or for local development
KONtextmind_BASE_URL=http://localhost:7331
```

---

## 16. SDK Usage Examples

### Ask a Question

```javascript
// Single question
const response = await client.ask('How does authentication work?');
console.log(response.answer);

// With options
const response = await client.ask('Explain the user service', {
  mode: 'chatbot-readonly',
  noCode: false,
  conversationId: 'conv-123'
});
```

### Conversation Flow

```javascript
// Start a conversation
const conversation = await client.conversations.create({
  title: 'API Documentation Review'
});

// Send messages
await client.conversations.addMessage(conversation.id, {
  role: 'user',
  content: 'How do I implement auth?'
});

await client.conversations.addMessage(conversation.id, {
  role: 'user',
  content: 'Can you show me the code?'
});

// Stream response (real-time)
const stream = await client.conversations.streamMessage(conversation.id, {
  role: 'user',
  content: 'What about JWT tokens?'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

### Check Project Readiness

```javascript
// Before allowing users to ask questions
const readiness = await client.projects.checkReadiness(projectId);

if (!readiness.ready) {
  showSetupProgress(readiness.stages);
} else {
  enableChatInterface();
}
```

---

## 17. Anonymous User Isolation

### Problem Statement

```
10 users on the same website
  → Each needs their OWN conversation history
  → NO login/signup required
  → Auto-generated unique ID per user
  → Server-side isolation
```

### Solution: Anonymous User IDs

```javascript
// Client-side: Generate or retrieve user ID
function getUserId() {
  const STORAGE_KEY = 'kontextmind_user_id';

  let userId = localStorage.getItem(STORAGE_KEY);

  if (!userId) {
    userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    localStorage.setItem(STORAGE_KEY, userId);
    // Backup in cookie for cross-tab support
    document.cookie = `km_uid=${userId};path=/;max-age=31536000`;
  }

  return userId;
}

// SDK automatically includes user ID
const client = new KontextMindClient({
  apiKey: 'sk-xxx',
  projectId: 'proj-abc',
  userId: getUserId()  // Auto-scoped to this user
});

// All conversations auto-filtered by user
const convs = await client.conversations.list();
// Returns ONLY this user's conversations
```

### Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Request                         │
│                                                              │
│  headers: {                                                  │
│    'X-API-Key': 'sk-xxx',                                    │
│    'X-User-ID': 'usr_a1b2c3d4e5f6',  ← Auto-set             │
│    'X-Project-ID': 'proj-abc'                                │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Server                              │
│                                                              │
│  1. Extract X-User-ID header                                │
│  2. Validate API key                                         │
│  3. Query: WHERE project_id = X AND user_id = Y            │
└─────────────────────────────────────────────────────────────┘
```

### User-Scoped Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/users/:uid/conversations` | User's conversations |
| `GET` | `/projects/:id/users/:uid/stats` | User's usage stats |
| `GET` | `/projects/:id/users/:uid/profile` | User profile |
| `DELETE` | `/projects/:id/users/:uid` | Clear user data |
| `POST` | `/projects/:id/users/:uid/reset` | Reset user preferences |

### Alternative: Header-Based Isolation (Preferred)

```http
GET /conversations HTTP/1.1
X-API-Key: sk-xxx
X-User-ID: usr_a1b2c3d4e5f6
X-Project-ID: proj-abc

# Server automatically filters by X-User-ID when present
```

### User Profile

```json
GET /projects/:id/users/:uid/profile

{
  "userId": "usr_a1b2c3d4e5f6",
  "projectId": "proj-abc",

  "createdAt": "2026-05-16T10:00:00Z",
  "lastSeen": "2026-05-16T14:30:00Z",
  "visitCount": 12,

  "preferences": {
    "theme": "light",
    "language": "en"
  },

  "stats": {
    "conversationsCreated": 5,
    "questionsAsked": 34,
    "feedbackGiven": 12
  }
}
```

### Widget Integration

```javascript
// Chat widget with anonymous user isolation
const KontextMindWidget = {
  init: function(config) {
    // Auto-generate user ID if not exists
    let userId = localStorage.getItem('km_uid');
    if (!userId) {
      userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
      localStorage.setItem('km_uid', userId);
    }

    this.client = new KontextMindClient({
      apiKey: config.apiKey,
      projectId: config.projectId,
      userId: userId  // Automatic user scoping
    });
  },

  async sendMessage(content) {
    // All messages scoped to this user
    return this.client.conversations.addMessage(this.convId, {
      role: 'user',
      content
    });
  },

  clearHistory() {
    // Clear only this user's data
    return this.client.users.clearMyData({
      deleteConversations: true,
      generateNewId: true
    });
  }
};
```

### Data Privacy

| Data Type | Retention | Auto-Delete |
|-----------|-----------|-------------|
| User ID | Until manual delete | 90 days inactive |
| Conversations | Until manual delete | 30 days inactive |
| Preferences | Until manual delete | Never |
| Feedback | Permanent | No |

---

## 18. Multi-Tenant Architecture

### Use Cases

```
Scenario 1: SaaS Platform
├── Multiple companies using your platform
├── Each company = one tenant
├── Company admins manage their users
└── Data never crosses tenant boundaries

Scenario 2: Agency / Reseller
├── You host KontextMind for multiple clients
├── Each client = one tenant
├── You manage billing centrally
└── Clients see only their data

Scenario 3: Enterprise Internal
├── Multiple departments in same company
├── Department = tenant
├── IT admin manages all
└── Department heads manage their tenant
```

### Tenant Hierarchy

```
Platform
  └── Tenant A (Company A)
        ├── User 1 (Admin)
        ├── User 2 (Member)
        ├── User 3 (Member)
        └── Project A1, Project A2
  └── Tenant B (Company B)
        ├── User 4 (Admin)
        ├── User 5 (Member)
        └── Project B1
```

### Tenant Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tenants` | Create tenant |
| `GET` | `/tenants` | List all tenants (platform) |
| `GET` | `/tenants/:id` | Get tenant details |
| `PATCH` | `/tenants/:id` | Update tenant |
| `DELETE` | `/tenants/:id` | Delete tenant |
| `POST` | `/tenants/:id/suspend` | Suspend tenant |
| `POST` | `/tenants/:id/resume` | Resume tenant |

### Create Tenant

```json
POST /tenants

{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "plan": "business",

  "settings": {
    "maxUsers": 50,
    "maxProjects": 10,
    "allowUserSignups": true,
    "requireEmailVerification": false
  },

  "billing": {
    "email": "billing@acme.com",
    "paymentMethod": "card"
  },

  "metadata": {
    "industry": "technology",
    "size": "50-200"
  }
}
```

### Tenant Response

```json
{
  "id": "tenant-abc123",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "plan": "business",

  "status": "active",
  "createdAt": "2026-01-15T10:00:00Z",
  "suspendedAt": null,

  "settings": {
    "maxUsers": 50,
    "maxProjects": 10,
    "currentUsers": 12,
    "currentProjects": 3
  },

  "billing": {
    "status": "paid",
    "nextBillingDate": "2026-06-15",
    "monthlyAmount": 299
  },

  "usage": {
    "requestsThisMonth": 45234,
    "storageMb": 2048,
    "apiCalls": 125000
  }
}
```

### Tenant Usage & Billing

```json
GET /tenants/:id/usage

{
  "tenantId": "tenant-abc123",
  "period": "2026-05",

  "usage": {
    "apiCalls": {
      "used": 125000,
      "included": 50000,
      "overage": 75000
    },
    "storage": {
      "usedMb": 2048,
      "includedMb": 5120,
      "overageMb": 0
    },
    "users": {
      "active": 12,
      "max": 50
    },
    "projects": {
      "active": 3,
      "max": 10
    }
  },

  "billing": {
    "baseAmount": 299,
    "overageCharges": {
      "apiCalls": 75,
      "storage": 0
    },
    "totalDue": 374,
    "dueDate": "2026-06-15"
  }
}
```

### Tenant Isolation (Security)

```javascript
// Every request validates tenant ownership
function validateTenantAccess(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  const apiKey = req.headers['x-api-key'];

  // 1. Validate API key exists
  const key = getApiKey(apiKey);
  if (!key) return res.status(401).send('Invalid API key');

  // 2. Verify API key belongs to this tenant
  if (key.tenantId !== tenantId) {
    return res.status(403).send('Access denied');
  }

  // 3. Set tenant context
  req.tenant = getTenant(tenantId);
  req.user = key.user;

  // 4. All queries automatically scoped to tenant
  next();
}

// Example: User can only see THEIR tenant's data
GET /projects  // Automatically filters to tenant-abc123
```

### Multi-Tenant vs Single-Tenant Deployment

| Aspect | Multi-Tenant | Single-Tenant |
|--------|-------------|---------------|
| Cost | Lower (shared infra) | Higher (dedicated) |
| Isolation | Logical separation | Physical separation |
| Scaling | Shared resources | Dedicated resources |
| Compliance | Data encrypted | Maximum isolation |
| Complexity | Higher | Lower |
| Best For | SaaS, Agencies | Enterprise, Healthcare |

---

## 19. Feedback & Analytics APIs

### Purpose

```
User Feedback → Learning System → Better Answers
                  ↓
              Dataset Collection
                  ↓
              Model Improvement
                  ↓
              KontextMind Evolution
```

### Feedback Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/conversations/:id/feedback` | Submit feedback |
| `GET` | `/conversations/:id/feedback` | Get conversation feedback |
| `POST` | `/ask/feedback` | Direct feedback on answer |
| `GET` | `/projects/:id/feedback` | Project feedback list |
| `GET` | `/projects/:id/feedback/analytics` | Feedback analytics |

### Submit Feedback

```json
POST /conversations/:id/feedback

{
  "rating": "positive",
  "feedbackType": "rating",
  "comment": "This was very helpful!",

  "responseId": "resp-abc123",
  "question": "How does auth work?",
  "answer": "Authentication in this codebase...",

  "metadata": {
    "responseTime": 1200,
    "sourcesUsed": ["src/auth/service.ts"],
    "confidence": 0.85
  },

  "tags": ["auth", "helpful", "clear"]
}
```

### Feedback Types

| Type | Description | Use Case |
|------|-------------|----------|
| `rating` | Thumbs up/down | Quick satisfaction |
| `stars` | 1-5 star rating | Detailed feedback |
| `correction` | User provides correct answer | Improve accuracy |
| `follow-up` | User asked follow-up question | Detect confusion |
| `resolution` | Was the question answered? | Track effectiveness |

### Feedback Request Variations

```json
// Thumbs up/down
{
  "rating": "positive",
  "feedbackType": "rating"
}

// Star rating
{
  "rating": 4,
  "feedbackType": "stars",
  "comment": "Good answer but missing some details"
}

// Correct answer provided
{
  "feedbackType": "correction",
  "originalAnswer": "Authentication uses JWT tokens",
  "correctAnswer": "Authentication uses OAuth 2.0 with JWT",
  "comment": "The auth actually uses OAuth, not just JWT"
}

// Follow-up detection
{
  "feedbackType": "follow-up",
  "originalQuestion": "How do I login?",
  "followUpQuestion": "But how do I handle token refresh?",
  "resolved": true
}

// Resolution check
{
  "feedbackType": "resolution",
  "question": "How does auth work?",
  "resolved": true,
  "additionalHelpNeeded": false
}
```

### Feedback Analytics

```json
GET /projects/:id/feedback/analytics

{
  "period": "2026-05-01 to 2026-05-16",

  "summary": {
    "totalFeedback": 234,
    "positive": 178,
    "negative": 28,
    "neutral": 28,
    "satisfactionRate": 76.1
  },

  "byConversation": [
    {
      "conversationId": "conv-123",
      "questionsAsked": 12,
      "avgRating": 4.2,
      "followUpCount": 2,
      "resolvedRate": 0.85
    }
  ],

  "byTopic": [
    {
      "topic": "authentication",
      "questionCount": 45,
      "avgRating": 4.5,
      "feedbackCount": 38
    },
    {
      "topic": "api-endpoints",
      "questionCount": 30,
      "avgRating": 3.8,
      "feedbackCount": 25
    }
  ],

  "negativePatterns": [
    {
      "question": "How do I deploy?",
      "negativeCount": 5,
      "reason": "Answer was outdated",
      "suggestedFix": "Update deployment docs"
    }
  ],

  "improvementSuggestions": [
    {
      "type": "summarize",
      "file": "src/deploy.ts",
      "reason": "5 negative feedbacks on deploy questions",
      "priority": "high"
    },
    {
      "type": "learn",
      "pattern": "authentication",
      "reason": "20% of questions about auth, current answers incomplete",
      "priority": "medium"
    }
  ]
}
```

---

## 20. Project Lifecycle

### States

| State | Description | Allow Questions? |
|-------|-------------|------------------|
| `initializing` | Being created/cloned | No |
| `cloning` | Git clone in progress | No |
| `indexing` | Running indexing | No |
| `summarizing` | Generating summaries | No |
| `kb_building` | Building knowledge base | No |
| `ready` | Fully configured | Yes |
| `error` | Failed state | No |
| `reindexing` | Re-running pipeline | No |

### Project Response

```json
{
  "id": "proj-abc123",
  "name": "my-production-app",
  "state": "ready",
  "gitUrl": "https://github.com/org/my-app",
  "branch": "main",

  "createdAt": "2026-05-01T10:00:00Z",
  "lastAsked": "2026-05-16T14:30:00Z",
  "qaCount": 234,

  "llmProvider": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },

  "stats": {
    "filesIndexed": 892,
    "symbolsIndexed": 4521,
    "summariesGenerated": 892,
    "kbVersion": "v1.2.0"
  }
}
```

---

## 21. Error Code Reference

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `409` | Conflict |
| `422` | Unprocessable |
| `500` | Internal Error |
| `502` | Bad Gateway |
| `503` | Service Unavailable |

### API Error Codes

```json
// Authentication errors
AUTH001: "INVALID_API_KEY"
AUTH002: "EXPIRED_TOKEN"
AUTH003: "MISSING_AUTH_HEADER"
AUTH004: "INSUFFICIENT_PERMISSIONS"

// Project errors
PRJ001: "PROJECT_NOT_FOUND"
PRJ002: "PROJECT_NOT_READY"
PRJ003: "PROJECT_PAUSED"
PRJ004: "PROJECT_ARCHIVED"
PRJ005: "PROJECT_DELETED"
PRJ006: "GIT_CLONE_FAILED"
PRJ007: "GIT_SYNC_CONFLICT"

// LLM errors
LLM001: "INVALID_PROVIDER_CONFIG"
LLM002: "PROVIDER_CONNECTION_FAILED"
LLM003: "MODEL_NOT_FOUND"
LLM004: "RATE_LIMIT_EXCEEDED"
LLM005: "CONTENT_TOO_LARGE"
LLM006: "INVALID_RESPONSE"

// Pipeline errors
PIP001: "PIPELINE_IN_PROGRESS"
PIP002: "PIPELINE_FAILED"
PIP003: "STEP_DEPENDS_ON_FAILED"

// Validation errors
VAL001: "INVALID_GIT_URL"
VAL002: "INVALID_MODEL_NAME"
VAL003: "MISSING_REQUIRED_FIELD"
VAL004: "FIELD_TOO_LONG"

// User quota
USER001: "USER_QUOTA_EXCEEDED"
USER002: "USER_NOT_FOUND"
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found",
    "field": null,
    "suggestion": "Check the project ID and try again"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-05-16T14:30:00Z"
  }
}
```

---

## 22. Migration Guide (v1 → v2)

### Endpoint Changes

| Old Endpoint | New Endpoint | Notes |
|--------------|--------------|-------|
| `POST /sessions` | `POST /conversations` | Renamed |
| `GET /sessions` | `GET /conversations` | Renamed |
| `GET /sessions/:id` | `GET /conversations/:id` | Renamed |
| `DELETE /sessions/:id` | `DELETE /conversations/:id` | Renamed |
| `GET /sessions/:id/context` | `GET /conversations/:id/messages` | Enhanced |

### Request Format Changes

```javascript
// Old (v1)
POST /ask
{
  "question": "How does auth work?",
  "sessionId": "sess-123"  // Optional
}

// New (v2)
POST /ask
{
  "question": "How does auth work?",
  "conversationId": "conv-abc123",  // Renamed from sessionId
  "mode": "chatbot-readonly",
  "stream": false  // New option
}
```

### Response Format Changes

```javascript
// Old (v1) - Flat structure
{
  "qa_id": "abc123",
  "answer": "...",
  "confidence": 0.85
}

// New (v2) - Standardized wrapper
{
  "success": true,
  "data": {
    "qa_id": "abc123",
    "answer": "...",
    "confidence": 0.85
  },
  "meta": {
    "requestId": "req-xyz789",
    "processingTime": 1200
  }
}
```

---

## 23. Testing & Mocking

### Sandbox Mode

```javascript
// Enable sandbox for testing
const client = new KontextMindClient({
  apiKey: 'test-key',
  projectId: 'proj-test',
  sandbox: true  // Returns mock responses
});

// All requests go to mock responses
const response = await client.ask('How does auth work?');
// Returns: { answer: "Mock response", confidence: 1.0, ... }
```

### Mock Project

```json
GET /projects/sandbox

{
  "id": "proj-sandbox",
  "name": "Sandbox Project",
  "state": "ready",
  "gitUrl": "mock://sandbox",
  "purpose": "Testing only"
}
```

---

## 24. WebSocket vs SSE Decision Guide

### When to Use SSE (Server-Sent Events)

| Use Case | Reason |
|----------|--------|
| Chat widget streaming | Simple, unidirectional, good browser support |
| Progress updates | One-way server push |
| Typing indicators | Real-time but not critical |
| Status notifications | Simple state updates |
| Mobile apps | Battery efficient, works in background |

```javascript
// SSE Example - Progress updates
const eventSource = new EventSource(
  `/api/projects/${projectId}/pipeline/stream`
);

eventSource.addEventListener('progress', (e) => {
  const data = JSON.parse(e.data);
  updateProgressBar(data.percent);
});

eventSource.addEventListener('pipeline_completed', () => {
  enableChatInterface();
});
```

### When to Use WebSocket

| Use Case | Reason |
|----------|--------|
| Multi-user collaboration | Bidirectional, low latency |
| Real-time cursors | Instant position updates |
| Complex gaming | High-frequency updates |
| Video sync | Tight synchronization needed |

### Comparison

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Browser Support | Excellent | Excellent |
| Firewall Friendly | Yes (HTTP) | Sometimes blocked |
| Reconnection | Built-in | Manual implementation |
| Complexity | Low | Medium |
| Bidirectional | No | Yes |
| Binary Data | Base64 | Native |
| Best For | Chat streaming | Real-time collaboration |

---

## 25. Pagination & Filtering

### Pagination

```json
GET /conversations?limit=20&offset=0&sort=lastActivity

{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true,
    "nextOffset": 20
  }
}
```

### Cursor-based Pagination

```json
GET /conversations?cursor=eyJpZCI6ImNvbnYxMjMifQ&limit=20

{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6ImNvbnYxNDMifQ",
    "hasMore": true
  }
}
```

### Filtering

```json
GET /conversations?status=active&createdAfter=2026-05-01

GET /projects/:id/audit-log?action=ask&userId=user-123&from=2026-05-01&to=2026-05-16
```

---

## 26. Health Check Patterns

### Container Health Endpoints

```json
GET /health

{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "projects": {
    "total": 5,
    "ready": 4,
    "initializing": 1
  }
}

GET /health/ready

{
  "ready": true,
  "checks": {
    "llm_provider": "pass",
    "projects_loaded": 4
  }
}
```

### Kubernetes Probes

```yaml
# livenessProbe - Is the container alive?
livenessProbe:
  httpGet:
    path: /health/live
    port: 7331
  initialDelaySeconds: 10
  periodSeconds: 15

# readinessProbe - Can it accept traffic?
readinessProbe:
  httpGet:
    path: /health/ready
    port: 7331
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

---

## 27. Complete API Reference Examples

### Register Project (Full Flow)

```javascript
// 1. Register new project
const project = await client.projects.create({
  name: 'my-production-app',
  gitUrl: 'https://github.com/org/my-app.git',
  branch: 'main',
  llmProvider: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY
  }
});

console.log('Project ID:', project.id);

// 2. Wait for readiness
let readiness;
do {
  readiness = await client.projects.checkReadiness(project.id);
  if (!readiness.ready) {
    console.log(`Progress: ${readiness.stages.summarize.progress}%`);
    await sleep;
  }
} while (!readiness.ready);

console.log('Project ready!');

// 3. Start conversations
const conv = await client.conversations.create({
  title: 'API Documentation Review'
});

const answer = await client.conversations.addMessage(conv.id, {
  role: 'user',
  content: 'How do I implement authentication?'
});

console.log(answer);
```

### Webhook Setup (Full Flow)

```javascript
// 1. Register webhook
const webhook = await client.projects.webhooks.create(projectId, {
  url: 'https://your-app.com/webhooks/kontextmind',
  events: [
    'pipeline.completed',
    'conversation.created',
    'feedback.received'
  ],
  secret: 'whsec_xxxx'  // For signature verification
});

// 2. Verify webhook signature
function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}

// 3. Handle webhook
app.post('/webhooks/kontextmind', (req, res) => {
  const signature = req.headers['x-kontextmind-signature'];
  const isValid = verifyWebhook(
    JSON.stringify(req.body),
    signature,
    webhook.secret
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;

  switch (event) {
    case 'pipeline.completed':
      enableChatInterface(data.projectId);
      break;
    case 'feedback.received':
      logFeedback(data);
      break;
  }

  res.status(200).send('OK');
});
```

---

## 28. Architecture Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Production Layer                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Your Application                               │    │
│  │               (React App, Mobile, Desktop)                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    │ HTTPS                               │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      KontextMind Cloud                             │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │                   API Gateway                                │   │    │
│  │  │  • Auth          • CORS           • Logging                  │   │    │
│  │  │  • Validation    • Metrics       • Security                  │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│              ┌─────────────────────┼─────────────────────┐                │
│              │                     │                     │                │
│              ▼                     ▼                     ▼                │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │  Project Service  │  │  Conversation    │  │  Learning Engine  │   │
│  │  • Git clone       │  │  Service         │  │  • Pattern detect │   │
│  │  • Pipeline       │  │  • Ask            │  │  • Feedback loop  │   │
│  │  • Indexing       │  │  • Messages      │  │  • Auto-tune      │   │
│  │  • Summarization  │  │  • Streaming     │  │  • Stats          │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     LLM Provider Layer                             │   │
│  │     ┌──────────┐    ┌──────────┐    ┌──────────┐                 │   │
│  │     │Anthropic│    │  OpenAI  │    │  Ollama  │                 │   │
│  │     │ Claude  │    │  GPT-4   │    │ Local    │                 │   │
│  │     └──────────┘    └──────────┘    └──────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

Or Self-Hosted:

┌─────────────────────────────────────────────────────────────────────────┐
│                      Self-Hosted KontextMind                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Docker Container                               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │    │
│  │  │  API Server │  │   Core      │  │   LLM       │               │    │
│  │  │  :7331      │  │   Engine    │  │   Provider  │               │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │    │
│  │         │                │                │                       │    │
│  │         └────────────────┼────────────────┘                       │    │
│  │                          ▼                                        │    │
│  │  ┌─────────────────────────────────────────────────────────┐     │    │
│  │  │            Project Storage (Read-Only Clones)            │     │    │
│  │  │  /projects/proj-1/  /projects/proj-2/  /projects/proj-3/│     │    │
│  │  └─────────────────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 29. Quick Reference Card

### Common Operations

```javascript
// Initialize
const client = new KontextMindClient({ apiKey, projectId });

// Check health
await client.health.check();

// Check readiness
const ready = await client.projects.checkReadiness(projectId);

// Create conversation
const conv = await client.conversations.create();

// Send message
const response = await client.conversations.addMessage(conv.id, {
  role: 'user',
  content: 'Your question here'
});

// Stream response
const stream = await client.conversations.streamMessage(conv.id, {
  role: 'user',
  content: 'Your question here'
});

// Submit feedback
await client.conversations.submitFeedback(conv.id, {
  rating: 'positive',
  comment: 'Great answer!'
});

// Get learning stats
const stats = await client.learning.getStats();

// Trigger manual sync
await client.learning.triggerSync();
```

### cURL Examples

```bash
# Health check
curl https://api.kontextmind.io/health \
  -H "X-API-Key: sk-xxx"

# Create project
curl -X POST https://api.kontextmind.io/projects \
  -H "X-API-Key: sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","gitUrl":"https://github.com/org/my-app"}'

# Check readiness
curl https://api.kontextmind.io/projects/proj-abc/readiness \
  -H "X-API-Key: sk-xxx"

# Ask question
curl -X POST https://api.kontextmind.io/ask \
  -H "X-API-Key: sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"question":"How does auth work?","stream":false}'

# Create conversation
curl -X POST https://api.kontextmind.io/conversations \
  -H "X-API-Key: sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj-abc","title":"My Session"}'

# Submit feedback
curl -X POST https://api.kontextmind.io/conversations/conv-123/feedback \
  -H "X-API-Key: sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"rating":"positive","comment":"Very helpful!"}'
```

---

## 30. Complete Feature Summary

### All API Categories

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| **Auth** | 4 | Login, token, verify, refresh |
| **Projects** | 8 | CRUD, sync, reset, status |
| **Provider** | 6 | LLM config, test, models |
| **Pipeline** | 4 | Status, steps, stream, trigger |
| **Conversations** | 10 | Full chat lifecycle |
| **Learning** | 5 | Config, stats, patterns, sync |
| **Feedback** | 5 | Submit, analytics, alerts |
| **Users** | 6 | Profile, quota, isolation |
| **Tenants** | 8 | Multi-tenant management |
| **Webhooks** | 3 | Register, list, delete |
| **Git** | 6 | Clone, pull, status, log |
| **Health** | 3 | Health, live, ready |

### Total: 70+ Endpoints

### Feature Matrix

| Feature | API | SDK | Widget | Status |
|---------|-----|-----|--------|--------|
| Basic Ask | ✅ | ✅ | ✅ | Ready |
| Streaming | ✅ | ✅ | ✅ | Ready |
| Conversations | ✅ | ✅ | ✅ | Ready |
| User Isolation | ✅ | ✅ | ✅ | Ready |
| Multi-Tenant | ✅ | - | - | Ready |
| Feedback | ✅ | - | - | Ready |
| Learning Config | ✅ | - | - | Ready |
| Progress Tracking | ✅ | ✅ | ✅ | Ready |
| Webhooks | ✅ | - | - | Ready |
| Error Codes | ✅ | ✅ | ✅ | Ready |

---

## Document Info

| Field | Value |
|-------|-------|
| Version | 2.0 |
| Last Updated | 2026-05-16 |
| Status | Production |
| Authors | KontextMind Team |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-05-16 | Initial API server enhancement proposal |
| 2026-05-16 | Added all 30 sections covering API structure |
| 2026-05-16 | Added user isolation section |
| 2026-05-16 | Added multi-tenant architecture |
| 2026-05-16 | Added feedback & analytics APIs |
| 2026-05-16 | **Removed rate limiting** - tool is free and open |