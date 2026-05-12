# KontextMind API Documentation

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Endpoints Reference](#endpoints-reference)
  - [Projects](#projects)
  - [Jobs](#jobs)
  - [Ask Questions](#ask-questions)
  - [Feedback](#feedback)
  - [Settings](#settings)
  - [Health](#health)
- [Webhooks & Callbacks](#webhooks--callbacks)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Client Libraries](#client-libraries)
- [Complete Integration Guide](#complete-integration-guide)

---

## Overview

KontextMind provides a REST API for managing project knowledge bases. Each project is stored in an isolated folder with its own file index, knowledge graph, and pre-computed summaries.

**Base URL:** `http://{host}:{port}` (default: `http://localhost:7331`)

### What KontextMind Does

1. **Clones** your Git repository
2. **Scans** all files and builds a file index
3. **Indexes** symbols, dependencies, and relationships
4. **Summarizes** files using LLM (optional)
5. **Builds** a knowledge base for fast Q&A

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                          │
│                  (React, Node, Python, etc.)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    KontextMind API Server                     │
│                           │                                   │
│    ┌──────────────┬──────────────┬──────────────┐          │
│    │   Projects   │     Jobs     │   Feedback   │          │
│    └──────────────┴──────────────┴──────────────┘          │
│                           │                                   │
│                           ▼                                   │
│    ┌──────────────────────────────────────────────────┐     │
│    │              Project Storage                      │     │
│    │        /kontextmind/projects/{name}/             │     │
│    │        ├── .kontextmind/  (config)                │     │
│    │        ├── .kg/           (file index)           │     │
│    │        ├── .summaries/    (LLM summaries)         │     │
│    │        └── .context/      (knowledge graph)       │     │
│    └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start the Server

```bash
# Using Docker
docker run -d --name kontextmind-api \
  -p 7331:7331 \
  -e GITHUB_TOKEN=<github-token> \
  -e LLM_API_KEY=<llm-api-key> \
  -e LLM_PROVIDER=openai-compatible \
  -e LLM_BASE_URL=https://api.openai.com/v1 \
  -e API_KEY=your-secret-key \
  kontextmind-api:latest

# Or using .env file
docker run -d --name kontextmind-api \
  -p 7331:7331 \
  --env-file .env \
  kontextmind-api:latest
```

### 2. Setup a Project

```bash
curl -X POST http://localhost:7331/projects/setup-with-github \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "git_url": "https://github.com/your-org/your-repo",
    "name": "my-project"
  }'
```

### 3. Poll for Completion

```bash
# Get job ID from setup response, then poll:
curl http://localhost:7331/jobs/job_abc123 \
  -H "X-API-Key: your-secret-key"
```

### 4. Ask Questions

```bash
curl -X POST http://localhost:7331/projects/my-project/ask \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{"question": "How does authentication work?"}'
```

---

## Authentication

All endpoints (except `/health/*`) require an API key passed via the `X-API-Key` header.

### Getting an API Key

**Option 1: Environment Variable (Recommended for containers)**

Set `API_KEY` when starting the server:

```bash
docker run -e API_KEY=<api-key> kontextmind-api:latest
```

**Option 2: Generate a Random Key**

```bash
# Generate a secure random key
openssl rand -hex 32
# Output: a1b2c3d4e5f6... (64 characters)
```

**Option 3: In Development Mode**

If no `API_KEY` is configured, all requests are allowed without authentication. This is useful for local development.

### Using the API Key

Include the API key in every request header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:7331/projects
```

For JavaScript/TypeScript clients:

```typescript
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': process.env.KONTEXTMIND_API_KEY,
};
```

---

## Endpoints Reference

### Projects

#### 1. Setup Project with GitHub

Clones a Git repository and initializes a complete knowledge base.

```http
POST /projects/setup-with-github
```

**Request Body:**

```json
{
  "git_url": "https://github.com/org/repo",
  "name": "my-project",
  "branch": "main",
  "callback_url": "https://api.example.com/webhooks/kontextmind"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `git_url` | string | Yes | HTTPS URL of the Git repository |
| `name` | string | Yes | Unique project identifier (lowercase, no spaces) |
| `branch` | string | No | Git branch to clone (default: `main`) |
| `callback_url` | string | No | URL to POST when initialization completes |

**Response (202 Accepted):**

```json
{
  "project_id": "my-project",
  "status": "initializing",
  "job_id": "job_abc123def456"
}
```

**Initialization Pipeline:**

The setup process runs asynchronously with these steps:

| Step | Description | Typical Duration |
|------|-------------|------------------|
| 1. Clone | Git clone using `GITHUB_TOKEN` | 5-30 seconds |
| 2. Init | Run `kontextmind init` | 1-2 seconds |
| 3. Scan | Index all files (757 files for beanav) | 1-5 seconds |
| 4. Index | Parse symbols and dependencies | 1-2 seconds |
| 5. Summarize | Generate LLM summaries (if configured) | 30-60+ minutes |
| 6. KB Build | Build knowledge base | 10-30 seconds |

---

#### 2. List Projects

```http
GET /projects
```

**Response:**

```json
{
  "projects": [
    {
      "name": "beanav-backend",
      "git_url": "https://github.com/org/beanav",
      "branch": "main",
      "status": "ready",
      "created_at": "2026-05-11T10:00:00Z",
      "last_asked": "2026-05-11T14:30:00Z",
      "qa_count": 45
    }
  ]
}
```

**Project Status Values:**

| Status | Description |
|--------|-------------|
| `initializing` | Setup in progress |
| `indexing` | Reindex in progress |
| `ready` | Fully initialized, ready for queries |
| `error` | Setup failed |

---

#### 3. Get Project Details

```http
GET /projects/{name}
```

**Response:**

```json
{
  "name": "beanav-backend",
  "git_url": "https://github.com/org/beanav",
  "branch": "main",
  "status": "ready",
  "created_at": "2026-05-11T10:00:00Z",
  "last_asked": "2026-05-11T14:30:00Z",
  "qa_count": 45,
  "files_indexed": 757,
  "kb_version": "1.0.0",
  "active_job": {
    "job_id": "job_xyz789",
    "status": "running",
    "progress_percent": 72,
    "current_step": "Generating summaries (127+ files)"
  }
}
```

---

#### 4. Delete Project

```http
DELETE /projects/{name}
```

**Response:**

```json
{
  "name": "my-project",
  "deleted": true
}
```

---

#### 5. Reindex Project

Triggers re-processing of the project. Use this after significant code changes.

```http
POST /projects/{name}/reindex
```

**Request Body:**

```json
{
  "full": true,
  "callback_url": "https://api.example.com/webhooks/reindex-complete"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `full` | boolean | No | Full reindex (scan + index + summarize). Default: `true` |
| `callback_url` | string | No | URL to POST when reindex completes |

**Response (202 Accepted):**

```json
{
  "project_id": "my-project",
  "status": "indexing",
  "job_id": "job_def456"
}
```

---

### Jobs

#### Get Job Status

Check the status of an async job (setup or reindex).

```http
GET /jobs/{job_id}
```

**Response:**

```json
{
  "job_id": "job_abc123def456",
  "project_id": "my-project",
  "type": "setup",
  "status": "running",
  "progress_percent": 72,
  "current_step": "Generating summaries (127+ files)",
  "created_at": "2026-05-12T10:27:27Z",
  "updated_at": "2026-05-12T10:43:28Z",
  "completed_at": null,
  "error": null
}
```

**Job Status Values:**

| Status | Description |
|--------|-------------|
| `pending` | Job queued, waiting to start |
| `running` | Job in progress |
| `completed` | Job finished successfully |
| `failed` | Job failed (check `error` field) |

**Progress Values:**

| Progress | Phase |
|----------|-------|
| 0-16% | Cloning repository |
| 17-33% | Initializing + scanning |
| 34-66% | Indexing symbols |
| 67-94% | Generating summaries |
| 95-99% | Building knowledge base |
| 100% | Complete |

---

### Ask Questions

#### Ask a Question

Sends a question to the knowledge base and returns an AI-generated answer.

```http
POST /projects/{name}/ask
```

**Request Body:**

```json
{
  "question": "How does authentication work?",
  "mode": "chatbot-readonly"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The question to ask |
| `mode` | string | No | `chatbot-readonly` (no code) or `readonly` (includes code snippets). Default: `chatbot-readonly` |

**Response:**

```json
{
  "qa_id": "qa_xyz789abc123",
  "answer": "The authentication system uses JWT tokens stored in httpOnly cookies. When a user logs in, the server generates a JWT containing the user ID and roles, signed with a secret key. The client stores this token and sends it in the Authorization header for subsequent requests.",
  "confidence": 0.85,
  "sources": [
    {
      "type": "llm-synthesis",
      "name": "pre-generated-summaries",
      "relevance": 0.85
    },
    {
      "type": "file_summary",
      "name": "backend/src/auth/jwt.rs",
      "relevance": 0.72
    }
  ],
  "tier": 5,
  "cached": false
}
```

**Tier Values:**

| Tier | Description |
|------|-------------|
| 0 | Exact match from Q&A history |
| 1 | Normalized string match |
| 2 | TF-IDF semantic match |
| 3 | Pre-computed pattern match |
| 4 | Keyword search |
| 5 | Fresh LLM synthesis |

**Confidence Score:**

| Score | Meaning |
|-------|---------|
| 0.9+ | High confidence, exact match |
| 0.7-0.9 | Good confidence, strong match |
| 0.5-0.7 | Moderate confidence |
| <0.5 | Low confidence, may need review |

**Error Responses:**

```json
// 404 - Project not found
{
  "error": "Project not found",
  "message": "Project 'xyz' does not exist or is not initialized"
}

// 503 - Project not ready
{
  "error": "Project not ready",
  "message": "Project 'xyz' is still initializing. Poll job status for completion."
}
```

---

### Feedback

#### Submit Feedback

Records user feedback for a Q&A pair.

```http
POST /feedback
```

**Request Body:**

```json
{
  "qa_id": "qa_xyz789abc123",
  "project": "my-project",
  "signal": "not_helpful",
  "reason": "The answer mentions the old API which was deprecated",
  "metadata": {
    "user_id": "u12345",
    "llm_model": "claude-sonnet-4-6"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `qa_id` | string | Yes | The Q&A ID from the ask response |
| `project` | string | Yes | Project name |
| `signal` | string | Yes | `helpful`, `not_helpful`, or `neutral` |
| `reason` | string | No | User's explanation |
| `metadata` | object | No | Additional context (user_id, session_id, etc.) |

**Response:**

```json
{
  "qa_id": "qa_xyz789abc123",
  "recorded": true
}
```

---

#### Export Feedback Dataset

Exports feedback data for analysis or model training.

```http
GET /feedback/export/{name}
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `json` | `json` or `jsonl` (newline-delimited JSON) |
| `since` | string | - | ISO date to filter records (e.g., `2026-05-01`) |

**Response:**

```json
{
  "project": "my-project",
  "exported_at": "2026-05-12T10:00:00Z",
  "total_records": 45,
  "format": "json",
  "data": [
    {
      "qa_id": "qa_xyz789",
      "question": "How does authentication work?",
      "answer": "The authentication system uses JWT tokens...",
      "feedback": {
        "signal": "not_helpful",
        "reason": "The answer mentions the old API",
        "timestamp": "2026-05-11T14:35:00Z",
        "user_id": "u12345"
      },
      "qa_metadata": {
        "confidence": 0.85,
        "tier": 5,
        "sources": ["llm-synthesis"],
        "llm_model": "claude-sonnet-4-6",
        "kb_version": "1.0.0"
      }
    }
  ]
}
```

---

#### Get Feedback Stats

```http
GET /feedback/stats/{name}
```

**Response:**

```json
{
  "project": "my-project",
  "stats": {
    "total": 45,
    "helpful": 30,
    "not_helpful": 10,
    "neutral": 5
  }
}
```

---

### Settings

#### Get Settings

```http
GET /settings
```

**Response:**

```json
{
  "llm_provider": "openai-compatible",
  "llm_model": "claude-opus-4-7",
  "llm_base_url": "https://api.opusmax.pro/v1",
  "github_token_configured": true,
  "projects_count": 3
}
```

---

#### Update Settings

```http
PUT /settings
```

**Request Body:**

```json
{
  "llm_provider": "openai-compatible",
  "llm_model": "gpt-4o",
    "llm_api_key": "<llm-api-key>",
  "llm_base_url": "https://api.openai.com/v1"
}
```

**Response:**

```json
{
  "updated": true,
  "llm_provider": "openai-compatible",
  "llm_model": "gpt-4o",
  "llm_base_url": "https://api.openai.com/v1"
}
```

---

### Health

#### Health Check (No Auth Required)

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 86400,
  "projects": {
    "total": 3,
    "ready": 2,
    "initializing": 1
  }
}
```

---

#### Liveness Probe (No Auth Required)

```http
GET /health/live
```

Returns `{ "ok": true }` - for Kubernetes liveness probes.

---

#### Readiness Probe (No Auth Required)

```http
GET /health/ready
```

Returns readiness status - for Kubernetes readiness probes.

---

## Webhooks & Callbacks

When you provide a `callback_url` during project setup or reindex, KontextMind sends a POST request when the operation completes.

### Callback Payload

```json
{
  "project_id": "my-project",
  "status": "ready",
  "job_id": "job_abc123",
  "result": {
    "files_indexed": 757,
    "symbols_indexed": 130,
    "summaries_generated": 757
  }
}
```

### Handling Callbacks

```typescript
// Express.js example
app.post('/webhooks/kontextmind', (req, res) => {
  const { project_id, status, job_id } = req.body;

  if (status === 'ready') {
    console.log(`Project ${project_id} is ready!`);
    // Update your database, notify users, etc.
  }

  res.status(200).send('OK');
});
```

### Polling Alternative

If you don't provide a callback URL, poll the job status:

```typescript
async function waitForJobCompletion(jobId: string, options = {}) {
  const { interval = 5000, timeout = 600000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const response = await fetch(`http://localhost:7331/jobs/${jobId}`, {
      headers: { 'X-API-Key': process.env.API_KEY }
    });
    const job = await response.json();

    if (job.status === 'completed') {
      return job;
    }
    if (job.status === 'failed') {
      throw new Error(`Job failed: ${job.error}`);
    }

    // Log progress for UX
    console.log(`Progress: ${job.progress_percent}% - ${job.current_step}`);

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Job wait timeout');
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "OPTIONAL_ERROR_CODE"
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `202` | Accepted (async operation started) |
| `400` | Bad request - invalid input |
| `401` | Unauthorized - missing or invalid API key |
| `404` | Not found - project/job not found |
| `409` | Conflict - project already exists |
| `429` | Too many requests - rate limit exceeded |
| `500` | Internal server error |
| `503` | Service unavailable - project not ready |

---

## Rate Limiting

The API limits requests to **100 requests per minute** per IP address.

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-05-12T11:01:00Z
```

---

## Client Libraries

### TypeScript / JavaScript

**Install the official client:**

```bash
npm install @kontextmind/client
```

**Basic Usage:**

```typescript
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  baseUrl: 'http://localhost:7331',
  apiKey: process.env.KONTMIND_API_KEY,
});

// Setup a project
const setup = await client.setupProject({
  gitUrl: 'https://github.com/org/repo',
  name: 'my-project',
  callbackUrl: 'https://api.example.com/webhook'
});

// Wait for completion (polls automatically)
const job = await client.waitForJob(setup.job_id, {
  interval: 5000,  // Poll every 5 seconds
  timeout: 600000  // 10 minute timeout
});
console.log(`Project ready: ${job.status}`);

// Ask a question
const answer = await client.ask('my-project', {
  question: 'How does authentication work?'
});
console.log(`Answer: ${answer.answer}`);
console.log(`Confidence: ${answer.confidence}`);

// Submit feedback
await client.submitFeedback({
  qa_id: answer.qa_id,
  project: 'my-project',
  signal: 'helpful'
});
```

**Complete Client Methods:**

```typescript
// Projects
client.setupProject(request)         // Setup with GitHub
client.listProjects()                 // List all projects
client.getProject(name)               // Get project details
client.deleteProject(name)            // Delete a project
client.reindexProject(name, options)  // Trigger reindex

// Jobs
client.getJobStatus(jobId)           // Get job status
client.waitForJob(jobId, options)    // Wait for completion

// Ask
client.ask(projectName, request)     // Ask a question

// Feedback
client.submitFeedback(request)      // Submit feedback
client.exportFeedback(project, opts)  // Export feedback data

// Settings
client.getSettings()                 // Get current settings
client.updateSettings(settings)      // Update settings

// Health
client.health()                      // Health check
```

---

### Python

**Install:**

```bash
pip install requests
```

**Basic Usage:**

```python
import os
import requests

API_BASE = 'http://localhost:7331'
API_KEY = os.environ["KONTEXTMIND_API_KEY"]

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
}

# Setup project
response = requests.post(
    f'{API_BASE}/projects/setup-with-github',
    headers=headers,
    json={
        'git_url': 'https://github.com/org/repo',
        'name': 'my-project'
    }
)
job_id = response.json()['job_id']

# Poll for completion
import time
while True:
    response = requests.get(f'{API_BASE}/jobs/{job_id}', headers=headers)
    job = response.json()

    if job['status'] == 'completed':
        print('Project ready!')
        break
    elif job['status'] == 'failed':
        print(f'Failed: {job["error"]}')
        break

    print(f"Progress: {job['progress_percent']}% - {job['current_step']}")
    time.sleep(5)

# Ask question
response = requests.post(
    f'{API_BASE}/projects/my-project/ask',
    headers=headers,
    json={'question': 'How does authentication work?'}
)
answer = response.json()
print(f"Answer: {answer['answer']}")
print(f"Confidence: {answer['confidence']}")

# Submit feedback
requests.post(
    f'{API_BASE}/feedback',
    headers=headers,
    json={
        'qa_id': answer['qa_id'],
        'project': 'my-project',
        'signal': 'helpful'
    }
)
```

---

## Complete Integration Guide

### Scenario: Adding a Chatbot to Your Project

You want to add a KontextMind-powered chatbot to your React application.

### Step 1: Configure the Server

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  kontextmind:
    image: kontextmind-api:latest
    ports:
      - "7331:7331"
    environment:
      - API_KEY=${KONTEXTMIND_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_PROVIDER=openai-compatible
      - LLM_BASE_URL=${LLM_BASE_URL}
      - LLM_MODEL=claude-opus-4-7
    volumes:
      - kontextmind-data:/kontextmind/projects

volumes:
  kontextmind-data:
```

### Step 2: Setup Your React Component

```typescript
// src/components/KontextChat.tsx
import React, { useState } from 'react';
import { KontextMindClient } from '@kontextmind/client';

const kontext = new KontextMindClient({
  baseUrl: import.meta.env.VITE_KONTEXTMIND_URL,
  apiKey: import.meta.env.VITE_KONTMIND_API_KEY,
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
  qa_id?: string;
}

export function KontextChat({ projectName }: { projectName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(question: string) {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const response = await kontext.ask(projectName, { question });

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        qa_id: response.qa_id,
      }]);
    } catch (error) {
      console.error('Failed to get answer:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(qa_id: string, signal: 'helpful' | 'not_helpful') {
    await kontext.submitFeedback({
      qa_id,
      project: projectName,
      signal,
    });
  }

  return (
    <div className="kontext-chat">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
            {msg.role === 'assistant' && msg.qa_id && (
              <div className="feedback-buttons">
                <button onClick={() => handleFeedback(msg.qa_id!, 'helpful')}>
                  👍 Helpful
                </button>
                <button onClick={() => handleFeedback(msg.qa_id!, 'not_helpful')}>
                  👎 Not Helpful
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.question as HTMLInputElement;
        handleSubmit(input.value);
        input.value = '';
      }}>
        <input name="question" placeholder="Ask about the codebase..." disabled={loading} />
        <button type="submit" disabled={loading}>
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
```

### Step 3: Admin Panel for Project Setup

```typescript
// src/components/ProjectSetup.tsx
import React, { useState, useEffect } from 'react';
import { KontextMindClient } from '@kontextmind/client';

const kontext = new KontextMindClient({
  baseUrl: import.meta.env.VITE_KONTEXTMIND_URL,
  apiKey: import.meta.env.VITE_KONTMIND_API_KEY,
});

export function ProjectSetup() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const response = await kontext.listProjects();
    setProjects(response.projects);
    setLoading(false);
  }

  async function handleSetup(gitUrl: string, name: string) {
    const result = await kontext.setupProject({
      gitUrl,
      name,
      callbackUrl: `${window.location.origin}/api/kontextmind-callback`,
    });

    // Poll for completion
    const job = await kontext.waitForJob(result.job_id);
    console.log(`Project ${name} is ready!`);
    await loadProjects();
  }

  if (loading) return <div>Loading projects...</div>;

  return (
    <div className="project-setup">
      <h2>Projects</h2>
      <ul>
        {projects.map(p => (
          <li key={p.name}>
            {p.name} - {p.status}
          </li>
        ))}
      </ul>

      <h3>Add New Project</h3>
      <form onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        handleSetup(
          (form.elements.gitUrl as HTMLInputElement).value,
          (form.elements.name as HTMLInputElement).value
        );
      }}>
        <input name="gitUrl" placeholder="GitHub URL" required />
        <input name="name" placeholder="Project name" required />
        <button type="submit">Setup Project</button>
      </form>
    </div>
  );
}
```

### Step 4: Environment Variables

Create a `.env` file (never commit this!):

```bash
# Server configuration
VITE_KONTEXTMIND_URL=http://localhost:7331
VITE_KONTMIND_API_KEY=<api-key>

# Server-side (.env for docker-compose)
KONTEXTMIND_API_KEY=<api-key>
GITHUB_TOKEN=<github-token>
LLM_API_KEY=<llm-api-key>
LLM_BASE_URL=https://api.openai.com/v1
```

### Step 5: Backend Webhook Handler

```typescript
// server/routes/kontextmind.ts
import express from 'express';

const router = express.Router();

// KontextMind callback webhook
router.post('/kontextmind-callback', async (req, res) => {
  const { project_id, status, job_id } = req.body;

  if (status === 'ready') {
    // Project is ready - update your database, send notifications, etc.
    await db.projects.update(project_id, { status: 'ready' });
    await sendEmail('admin@example.com', `Project ${project_id} is ready!`);
  }

  res.status(200).send('OK');
});

export default router;
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `7331` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `DATA_DIR` | No | `/kontextmind/projects` | Projects directory |
| `API_KEY` | No | - | API authentication key (strongly recommended for production) |
| `GITHUB_TOKEN` | Yes* | - | GitHub fine-grained PAT for cloning repos |
| `LLM_API_KEY` | Yes* | - | LLM provider API key |
| `LLM_PROVIDER` | No | `openai` | Provider type: `openai`, `anthropic`, `openai-compatible` |
| `LLM_MODEL` | No | provider default | Model name (e.g., `gpt-4o`, `claude-opus-4-7`) |
| `LLM_BASE_URL` | No | - | Custom endpoint for OpenAI-compatible providers |

*Required for project setup. `ask` operations require `LLM_API_KEY`.

---

## Troubleshooting

### Common Issues

**1. "Project not found" error**

- Ensure the project name matches exactly (case-sensitive)
- Check if the project initialization completed successfully

**2. "Project not ready" error (503)**

- The project is still initializing
- Poll the job status to wait for completion
- Summarization can take 30+ minutes for large projects

**3. "Unauthorized" error**

- Verify the `X-API-Key` header is set correctly
- Check that `API_KEY` environment variable is set on the server

**4. Clone failed**

- Ensure `GITHUB_TOKEN` is set and has read access to the repository
- For private repos, the token needs `repo` scope

**5. Ask returns low confidence**

- Wait for summarization to complete (check job status)
- Run `reindex` with `full: true` to regenerate summaries

---

## Support

- **GitHub Issues:** https://github.com/nikzdevz/kontextmind/issues
- **Documentation:** https://github.com/nikzdevz/kontextmind#readme

---

## Changelog

| Version | Changes |
|---------|---------|
| 0.1.0 | Initial API release with project setup, ask, feedback, and jobs endpoints |
