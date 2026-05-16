# KontextMind Developer Onboarding Guide

**Document Version:** 1.0
**Date:** 2026-05-16
**Audience:** Developers integrating KontextMind into their applications

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture Overview](#2-architecture-overview)
3. [Integration Guides](#3-integration-guides)
4. [API Reference](#4-api-reference)
5. [SDK Usage](#5-sdk-usage)
6. [Best Practices](#6-best-practices)
7. [Troubleshooting](#7-troubleshooting)
8. [Security Model](#8-security-model)

---

## 1. Quick Start

### 5-Minute Setup

#### Step 1: Get Your API Key

1. Sign up at kontextmind.io (or deploy self-hosted)
2. Create a project
3. Copy your API key

#### Step 2: Install the SDK

```bash
# JavaScript/TypeScript
npm install @kontextmind/client

# Python
pip install kontextmind

# Or use cURL directly
```

#### Step 3: Ask Your First Question

```javascript
// JavaScript
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  apiKey: 'sk-xxx',
  projectId: 'proj-abc123'
});

const response = await client.ask('How does authentication work?');
console.log(response.answer);
```

```python
# Python
from kontextmind import Client

client = Client(
    api_key='sk-xxx',
    project_id='proj-abc123'
)

response = client.ask('How does authentication work?')
print(response.answer)
```

```bash
# cURL
curl -X POST https://api.kontextmind.io/ask \
  -H "X-API-Key: sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"question":"How does auth work?"}'
```

### Your First Project

```javascript
// 1. Register a new project
const project = await client.projects.create({
  name: 'my-production-app',
  gitUrl: 'https://github.com/org/my-app.git',
  branch: 'main'
});

console.log('Project ID:', project.id);

// 2. Wait for setup to complete
let readiness;
do {
  readiness = await client.projects.checkReadiness(project.id);
  if (!readiness.ready) {
    console.log(`Setup: ${readiness.stages.summarize.progress || 0}% complete`);
    await sleep;
  }
} while (!readiness.ready);

console.log('Project ready! You can now ask questions.');

// 3. Start chatting
const answer = await client.ask('How does auth work?');
console.log(answer.answer);
```

---

## 2. Architecture Overview

### How KontextMind Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│                (React, Mobile, Desktop)                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    KontextMind Container                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 API Server (:7331)                     │ │
│  │   Auth • Projects • Conversations • Learning           │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Core Engine                                │ │
│  │   Ask Service • Indexing • Summarization                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Cloned Repos (Read-Only)                      │ │
│  │   /projects/proj-1/  /projects/proj-2/                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Project** | A Git repository cloned and indexed by KontextMind |
| **Conversation** | A multi-turn chat session with context |
| **User** | Anonymous user identified by auto-generated UUID |
| **Tenant** | Organization containing multiple users and projects |
| **Learning** | System that improves answers from feedback |

### Security Model

```
Q: Can KontextMind modify my code?
A: NO. All file write operations return 403 Forbidden.

Q: Is my code safe?
A: YES. Code is cloned into isolated containers.

Q: What if someone hacks KontextMind?
A: Production code never accessible.
   Read-only isolation protects you.

Q: Can users see each other's conversations?
A: NO. Anonymous user isolation ensures privacy.
```

---

## 3. Integration Guides

### JavaScript/TypeScript SDK

#### Installation

```bash
npm install @kontextmind/client
```

#### Basic Setup

```javascript
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  apiKey: process.env.KONTextMind_API_KEY,
  projectId: 'proj-abc123',
  baseUrl: 'https://api.kontextmind.io' // Optional, for self-hosted use localhost:7331
});
```

#### Configuration Options

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

  // User identification (for anonymous users)
  userId: 'usr_a1b2c3d4e5f6',

  // Streaming
  streamChunkSize: 64,

  // Custom headers
  headers: {
    'X-Customer-ID': 'customer-123'
  }
});
```

#### Environment Variables

```bash
# .env file
KONTextMind_API_KEY=sk-xxx
KONTextMind_PROJECT_ID=proj-abc123
KONTextMind_BASE_URL=https://api.kontextmind.io
```

---

### React Integration

#### Chat Widget Component

```jsx
import React, { useState, useEffect } from 'react';
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  apiKey: process.env.REACT_APP_KON_TEXTMind_API_KEY,
  projectId: process.env.REACT_APP_PROJECT_ID
});

function ChatWidget({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await client.conversations.addMessage(
        'current-conv-id',
        { role: 'user', content: input }
      );

      const assistantMessage = { role: 'assistant', content: response.data.content };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about your codebase..."
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

#### Setup Progress Component

```jsx
function SetupProgress({ projectId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/projects/${projectId}/pipeline/stream`
    );

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setStatus(prev => ({ ...prev, ...data }));
    });

    eventSource.addEventListener('pipeline_completed', () => {
      setStatus(prev => ({ ...prev, ready: true }));
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
    });

    return () => eventSource.close();
  }, [projectId]);

  if (status?.ready) {
    return <ChatWidget projectId={projectId} />;
  }

  return (
    <div className="setup-progress">
      <h3>Setting up your project...</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${status?.percentComplete || 0}%` }}
        />
      </div>
      <p>Step: {status?.step || 'Initializing...'}</p>
      {status?.currentFile && (
        <p className="current-file">Indexing: {status.currentFile}</p>
      )}
    </div>
  );
}
```

---

### Python Integration

#### Installation

```bash
pip install kontextmind
```

#### Basic Setup

```python
from kontextmind import Client
import os

client = Client(
    api_key=os.environ['KONTextMind_API_KEY'],
    project_id='proj-abc123',
    base_url='https://api.kontextmind.io'
)

# Ask a question
response = client.ask('How does authentication work?')
print(response.answer)
```

#### Flask Integration

```python
from flask import Flask, request, jsonify
from kontextmind import Client

app = Flask(__name__)

client = Client(
    api_key=os.environ['KONTextMind_API_KEY'],
    project_id='proj-abc123'
)

@app.route('/api/ask', methods=['POST'])
def ask():
    data = request.json
    question = data.get('question')

    if not question:
        return jsonify({'error': 'Question required'}), 400

    response = client.ask(question)
    return jsonify(response)
```

#### Django Integration

```python
# views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from kontextmind import Client
import os

client = Client(
    api_key=os.environ['KONTextMind_API_KEY'],
    project_id='proj-abc123'
)

@csrf_exempt
def ask_view(request):
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        question = data.get('question')

        if not question:
            return JsonResponse({'error': 'Question required'}, status=400)

        response = client.ask(question)
        return JsonResponse(response)

    return JsonResponse({'error': 'Method not allowed'}, status=405)
```

---

### Mobile App Integration

#### React Native

```javascript
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  apiKey: 'sk-xxx',
  projectId: 'proj-abc123'
});

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await client.conversations.addMessage('conv-id', {
        role: 'user',
        content: input
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.content
      }]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flex: 1 }}>
        {messages.map((msg, i) => (
          <View
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? '#007AFF' : '#E5E5EA',
              padding: 10,
              borderRadius: 10,
              marginVertical: 4
            }}
          >
            <Text>{msg.content}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your codebase..."
          style={{ flex: 1, borderWidth: 1, padding: 8, borderRadius: 20 }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={{ marginLeft: 8, backgroundColor: '#007AFF', padding: 12, borderRadius: 20 }}
        >
          <Text style={{ color: 'white' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

### Webhook Integration

#### Register a Webhook

```javascript
// Register webhook for pipeline completion
const webhook = await client.projects.webhooks.create(projectId, {
  url: 'https://your-app.com/webhooks/kontextmind',
  events: [
    'pipeline.completed',
    'feedback.received',
    'conversation.created'
  ],
  secret: 'whsec_xxxx'  // For signature verification
});
```

#### Verify Webhook Signature

```javascript
const crypto = require('crypto');

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

// Express handler
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
      console.log('Project ready:', data.projectId);
      break;
    case 'feedback.received':
      console.log('New feedback:', data);
      break;
  }

  res.status(200).send('OK');
});
```

---

## 4. API Reference

### Authentication

```http
# API Key Header
X-API-Key: sk-xxx

# Anonymous User Header (auto-generated)
X-User-ID: usr_a1b2c3d4e5f6

# Project Header
X-Project-ID: proj-abc
```

### Core Endpoints

#### Health Check

```bash
GET /health

# Response
{
  "status": "healthy",
  "version": "1.0.0",
  "projects": { "total": 5, "ready": 4 }
}
```

#### Ask a Question

```bash
POST /ask

{
  "question": "How does authentication work?",
  "mode": "chatbot-readonly"
}

# Response
{
  "success": true,
  "data": {
    "qa_id": "abc123",
    "answer": "Authentication in this codebase uses...",
    "confidence": 0.85,
    "sources": [...]
  },
  "meta": {
    "requestId": "req-xyz789",
    "processingTime": 1200
  }
}
```

#### Conversations

```bash
# Create conversation
POST /conversations
{ "title": "API Review", "userId": "usr_xxx" }

# List conversations
GET /conversations

# Get conversation
GET /conversations/:id

# Send message
POST /conversations/:id/messages
{ "role": "user", "content": "Your question" }

# Submit feedback
POST /conversations/:id/feedback
{ "rating": "positive", "comment": "Great answer!" }
```

### Streaming

```bash
# SSE streaming for responses
GET /stream/conversations/:id/events

# SSE events:
# - message_start
# - message_delta (token updates)
# - message_end
# - typing_start
# - typing_end
```

---

## 5. SDK Usage

### Initialize Client

```javascript
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  apiKey: process.env.KON_TEXTMind_API_KEY,
  projectId: 'proj-abc123'
});
```

### Ask Questions

```javascript
// Single question
const response = await client.ask('How does auth work?');
console.log(response.answer);

// With options
const response = await client.ask('Explain the user service', {
  mode: 'chatbot-readonly',
  conversationId: 'conv-123'
});
```

### Manage Conversations

```javascript
// Create conversation
const conv = await client.conversations.create({
  title: 'API Documentation Review'
});

// Send message
await client.conversations.addMessage(conv.id, {
  role: 'user',
  content: 'How do I implement auth?'
});

// Stream response (real-time)
const stream = await client.conversations.streamMessage(conv.id, {
  role: 'user',
  content: 'What about JWT tokens?'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

### Check Project Readiness

```javascript
const readiness = await client.projects.checkReadiness(projectId);

if (!readiness.ready) {
  // Show setup progress
  console.log(`Progress: ${readiness.stages.summarize.progress}%`);
} else {
  // Enable chat interface
  console.log('Ready to chat!');
}
```

### Submit Feedback

```javascript
await client.conversations.submitFeedback(conv.id, {
  rating: 'positive',
  feedbackType: 'rating',
  comment: 'This was very helpful!',
  tags: ['auth', 'clear', 'concise']
});
```

### Configure Learning

```javascript
// Get learning config
const config = await client.learning.getConfig();

// Update learning settings
await client.learning.updateConfig({
  enabled: true,
  triggers: {
    autoSync: true,
    syncIntervalMinutes: 30
  }
});

// Get learning stats
const stats = await client.learning.getStats();
console.log(`Success rate: ${stats.outcomes.successRate}%`);
```

### User Profile

```javascript
// Get user profile
const profile = await client.users.getProfile();
console.log(`Visits: ${profile.visitCount}`);

// Update preferences
await client.users.updatePreferences({
  theme: 'dark',
  language: 'en'
});

// Reset user (new ID)
const newUserId = await client.users.reset();
console.log(`New user ID: ${newUserId}`);
```

---

## 6. Best Practices

### Error Handling

```javascript
try {
  const response = await client.ask('How does auth work?');
} catch (error) {
  if (error.code === 'PROJECT_NOT_READY') {
    // Show setup progress
    showSetupProgress(error.details);
  } else if (error.code === 'AUTH001') {
    // Invalid API key - check configuration
    console.error('Invalid API key');
  } else {
    // Unknown error - log and show generic message
    console.error('Unexpected error:', error);
  }
}
```

### Retry Logic

```javascript
const client = new KontextMindClient({
  apiKey: 'sk-xxx',
  projectId: 'proj-abc123',
  retries: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true  // Prevent thundering herd
  }
});
```

### Anonymous User Management

```javascript
// Client-side: Get or create user ID
function getUserId() {
  const STORAGE_KEY = 'kontextmind_user_id';

  let userId = localStorage.getItem(STORAGE_KEY);

  if (!userId) {
    userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    localStorage.setItem(STORAGE_KEY, userId);
    document.cookie = `km_uid=${userId};path=/;max-age=31536000`;
  }

  return userId;
}

// Use in client initialization
const client = new KontextMindClient({
  apiKey: 'sk-xxx',
  projectId: 'proj-abc123',
  userId: getUserId()
});
```

### Performance Tips

```javascript
// 1. Use conversation context for follow-up questions
const conversation = await client.conversations.create({
  title: 'API Review'
});

// Ask multiple questions in the same conversation
const q1 = await client.conversations.addMessage(conversation.id, {
  role: 'user',
  content: 'How does auth work?'
});

const q2 = await client.conversations.addMessage(conversation.id, {
  role: 'user',
  content: 'What about token refresh?'
});

// 2. Enable caching when possible
const response = await client.ask('Common question', {
  useCache: true
});

// 3. Use streaming for better UX
const stream = await client.conversations.streamMessage(conv.id, {
  role: 'user',
  content: 'Explain the entire auth flow'
});

for await (const chunk of stream) {
  appendToDisplay(chunk.text);
}
```

### Security Best Practices

```javascript
// 1. Never expose API key in frontend code
// Use environment variables
const client = new KontextMindClient({
  apiKey: process.env.REACT_APP_KON_TEXTMind_API_KEY,
  projectId: process.env.REACT_APP_PROJECT_ID
});

// 2. For production, proxy through your backend
// Frontend -> Your Backend -> KontextMind API
// This hides the API key and allows rate limiting

// 3. Validate webhook signatures
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
```

---

## 7. Troubleshooting

### Common Errors

| Error Code | Message | Solution |
|------------|---------|----------|
| `AUTH001` | Invalid API key | Check your API key is correct |
| `PRJ001` | Project not found | Verify project ID |
| `PRJ002` | Project not ready | Wait for setup to complete |
| `AUTH003` | Missing auth header | Include X-API-Key header |
| `VAL001` | Invalid Git URL | Check repository URL format |

### Debug Mode

```javascript
const client = new KontextMindClient({
  apiKey: 'sk-xxx',
  projectId: 'proj-abc123',
  debug: true  // Enable debug logging
});
```

### Check Server Health

```bash
curl https://api.kontextmind.io/health

# Response
{
  "status": "healthy",
  "version": "1.0.0",
  "projects": { "total": 5, "ready": 5 }
}
```

### Verify API Key

```bash
curl -X POST https://api.kontextmind.io/auth/verify \
  -H "X-API-Key: sk-xxx"

# Response
{
  "success": true,
  "data": {
    "valid": true,
    "tenantId": "tenant-abc",
    "permissions": ["*"]
  }
}
```

### Check Project Readiness

```bash
curl https://api.kontextmind.io/projects/proj-abc/readiness \
  -H "X-API-Key: sk-xxx"

# Response
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
    "totalSummaries": 892
  }
}
```

---

## 8. Security Model

### Container Security

```
┌─────────────────────────────────────────────────────────────┐
│                 KontextMind Container                        │
│                                                              │
│  API Server (port 7331)                                      │
│  ├── Accepts requests                                        │
│  ├── Validates authentication                                │
│  └── Routes to appropriate handlers                          │
│                                                              │
│  Core Engine                                                 │
│  ├── Processes questions                                     │
│  ├── Generates answers from context                         │
│  └── Never writes to file system                             │
│                                                              │
│  File System (Read-Only)                                     │
│  ├── Contains cloned repositories                            │
│  ├── No write permissions                                    │
│  └── Even root can't modify                                  │
└─────────────────────────────────────────────────────────────┘
```

### What KontextMind CAN Do

| Action | Description |
|--------|-------------|
| Clone repositories | Git clone for analysis |
| Read code files | Generate context for AI |
| Answer questions | Use code context to respond |
| Index & summarize | Build searchable knowledge base |
| Learn from feedback | Improve answer quality |

### What KontextMind CANNOT Do

| Action | Why Blocked |
|--------|-------------|
| Write to files | Returns 403 Forbidden |
| Modify git history | Read-only access |
| Execute code | Sandboxed container |
| Access production DB | Network isolation |
| Modify settings | Read-only mode enforced |

### Data Privacy

| Data Type | Storage | Retention |
|-----------|---------|-----------|
| API Keys | Encrypted | Until revoked |
| Conversations | Per-project | Until deleted |
| User IDs | Anonymized | 90 days inactive |
| Feedback | Permanent | Never auto-deleted |

---

## Integration Checklist

Before going to production, verify:

- [ ] API key configured correctly
- [ ] Project is in ready state
- [ ] Anonymous user isolation working
- [ ] Error handling implemented
- [ ] Loading states shown to users
- [ ] Feedback submission available
- [ ] Streaming works for real-time UX
- [ ] Webhooks configured (if needed)
- [ ] Security best practices followed

---

## Dataset API

### Export Training Data

```javascript
// Export Q&A training data
const dataset = await client.dataset.export({
  format: 'sharegpt',
  minConfidence: 0.5
});

// Export summaries as training data
const summariesDataset = await client.dataset.exportSummaries({
  format: 'jsonl',
  types: ['file', 'function', 'module'],
  minConfidence: 0.3
});
```

### Dataset Statistics

```javascript
// Get Q&A dataset stats
const qaStats = await client.dataset.stats();

// Get summary dataset stats
const summaryStats = await client.dataset.statsSummaries();
```

### Dataset Formats

| Format | Use Case |
|--------|----------|
| `jsonl` | Line-delimited JSON for streaming training |
| `json` | Full JSON array for inspection |
| `sharegpt` | ShareGPT format for multi-turn training |
| `chatml` | ChatML format for instruction tuning |

### Summary Dataset Types

| Type | Description | Example Question |
|------|-------------|------------------|
| `file` | File purpose and exports | "What does auth/middleware.ts do?" |
| `function` | Function documentation | "What does validateToken() do?" |
| `module` | Directory summaries | "What's in the utils folder?" |
| `api` | API documentation | "What does the /api/users endpoint do?" |
| `decision` | Architecture decisions | "Why was this pattern chosen?" |

### Programmatic Dataset Collection

```javascript
// Collect all training data programmatically
import {
  collectData,
  collectSummaryTrainingData,
  mergeToTrainingRecords,
  filterRecords
} from '@kontextmind/core';

// Q&A data
const data = collectData(projectRoot, {
  sources: ['qna-events', 'sessions']
});
const records = mergeToTrainingRecords(data, {
  minConfidence: 0.5,
  maxAgeDays: 90
});

// Summary data
const summaryRecords = collectSummaryTrainingData(projectRoot, {
  types: ['file', 'function'],
  minConfidence: 0.3
});
```

---

## Resources

| Resource | Link |
|----------|------|
| API Documentation | [docs.kontextmind.io](https://docs.kontextmind.io) |
| SDK Reference | [sdk.kontextmind.io](https://sdk.kontextmind.io) |
| GitHub Repository | [github.com/kontextmind/kontextmind](https://github.com/kontextmind/kontextmind) |
| Example Projects | [github.com/kontextmind/examples](https://github.com/kontextmind/examples) |
| Support | support@kontextmind.io |

---

## Document Info

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Date | 2026-05-16 |
| Authors | KontextMind Team |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-05-16 | Initial developer onboarding guide |
| 2026-05-16 | Added JavaScript, Python, React, React Native examples |
| 2026-05-16 | Added webhook integration guide |
| 2026-05-16 | Added security model documentation |