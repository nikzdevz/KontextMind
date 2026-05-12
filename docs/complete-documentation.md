# KontextMind - Complete Technical Documentation

## Table of Contents

1. [What is KontextMind?](#what-is-kontextmind)
2. [Why Was It Created?](#why-was-it-created)
3. [Core Features](#core-features)
4. [Architecture Overview](#architecture-overview)
5. [How It Differs From Other Tools](#how-it-differs-from-other-tools)
6. [MCP Server Integration](#mcp-server-integration)
7. [Project Management](#project-management)
8. [Task & Session Management](#task--session-management)
9. [LLM/Agent Interaction](#llmagent-interaction)
10. [External Project Integration](#external-project-integration)
11. [Technical Deep Dive](#technical-deep-dive)
12. [Implementation Status](#implementation-status)
13. [Roadmap & Future Work](#roadmap--future-work)

---

## What is KontextMind?

KontextMind is a **local-first project brain** for AI coding agents. It stores project context, knowledge graphs, summaries, and agent instructions directly within your project repository.

### Core Definition

```
KontextMind = Project Memory + Knowledge Graph + Chatbot + Agent Instructions + MCP Server
```

### What It Does

1. **Stores Project Context** - Architecture, decisions, conventions, ongoing work
2. **Builds Knowledge Graphs** - File relationships, symbol dependencies, semantic connections
3. **Generates Summaries** - AI-powered file and function summaries via LLM
4. **Provides Chatbot Q&A** - Natural language questions answered from project knowledge
5. **Enables Agent Continuity** - Session handoff, state preservation, policy enforcement
6. **Offers MCP Tools** - Direct tool access for MCP-compatible AI clients

### What It Is NOT

- Not a code search engine (like Sourcegraph)
- Not a documentation generator (like Docusaurus)
- Not a CI/CD tool
- Not a code review system
- Not a project management tool

---

## Why Was It Created?

### The Problem: AI Agents Have No Memory

When you start a new session with Claude Code, Codex, or any AI coding agent:

1. **No context** - Agent doesn't know what was done in previous sessions
2. **No project knowledge** - Agent starts fresh every time, requiring extensive onboarding
3. **No continuity** - Each conversation is independent, leading to repeated work
4. **No institutional memory** - Architectural decisions, conventions, and patterns are lost

### Existing Solutions Are Flawed

| Tool | Problem |
|------|---------|
| GitHub Copilot | No project-wide context, just file-level autocomplete |
| Sourcegraph | Code search only, no agent memory or Q&A |
| Langchain | Over-engineered for simple use cases |
| Custom embeddings | Requires separate infrastructure, no agent integration |
| Claude Memory | External service, not project-specific |

### The Solution: Project-Native Brain

KontextMind solves this by:

1. **Being project-native** - Data lives in `.kontextmind/` directory, versioned with code
2. **Being agent-agnostic** - Works with Claude, Codex, Cursor, Continue, Copilot, any MCP client
3. **Being privacy-preserving** - No external services, everything local
4. **Being MCP-ready** - Direct tool access via Model Context Protocol

---

## Core Features

### 1. Project Initialization

```bash
kontextmind init --yes
```

Creates:
- `CLAUDE.md` - Claude Code instructions
- `AGENTS.md` - Generic agent instructions
- `.toolignore` - Files to ignore
- `.context/` - Project memory
- `.kontextmind/` - Configuration
- `.kg/` - Knowledge graph
- `.summaries/` - AI summaries
- `.sessions/` - Session tracking
- `.logs/` - Audit logs

### 2. File Scanning & Indexing

```bash
kontextmind scan  # Index all files
kontextmind index # Extract symbols and dependencies
```

Builds:
- File index with hashes
- Symbol index (functions, classes, interfaces)
- Dependency graph
- Import/export relationships

### 3. LLM-Powered Summaries

```bash
kontextmind summarize --all
```

Generates:
- File-level summaries
- Function summaries
- Module overviews
- Architecture documentation

### 4. Knowledge Base Building

```bash
kontextmind kb build
```

Creates:
- Common questions & answers
- API flows documentation
- Entity maps
- Dependency maps
- Response policies

### 5. Chatbot Q&A

```bash
kontextmind ask "How does authentication work?"
```

Returns:
- Natural language answer
- Confidence score
- Source references
- Tier indicator (how the answer was found)

### 6. HTTP API Server

```bash
kontextmind serve --port 7331
```

Exposes:
- Project setup via GitHub
- Question answering
- Feedback collection
- Progress tracking

### 7. MCP Server

```bash
kontextmind mcp
```

Provides tools:
- `project.status`
- `project.search`
- `project.get_file_summary`
- `project.find_dependencies`
- `project.find_callers`
- And more...

### 8. Security Features

```bash
kontextmind secrets scan
kontextmind audit
```

Detects and logs:
- AWS keys, private keys
- JWT tokens, API keys
- Database URLs, passwords
- Prompt injection attempts

---

## Architecture Overview

### System Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                        AI Coding Agent                              │
│                     (Claude Code, Codex, etc.)                      │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐       ┌─────▼─────┐
              │ MCP       │       │ HTTP API  │
              │ (stdio)   │       │ (REST)    │
              └─────┬─────┘       └─────┬─────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │                   │
              ┌─────▼─────┐       ┌─────▼─────┐
              │ CLI       │       │ CLI       │
              │ Commands  │       │ Commands  │
              └─────┬─────┘       └─────┬─────┘
                    │                   │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
        │ Scanner   │   │ Parser    │   │ Summarizer│
        │ (Files)   │   │ (Symbols) │   │ (LLM)     │
        └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │                               │
        ┌─────▼─────┐                 ┌─────▼─────┐
        │ .kg/      │                 │ .summaries/│
        │ Knowledge  │                 │ AI          │
        │ Graph      │                 │ Summaries   │
        └───────────┘                 └─────────────┘
```

### Package Architecture

```
kontextmind/
├── packages/
│   ├── core/          # Core library
│   │   └── src/
│   │       ├── scanner/      # File scanning
│   │       ├── parser/       # Symbol extraction
│   │       ├── summaries/    # LLM summarization
│   │       ├── chatbot/      # Q&A system
│   │       ├── providers/    # LLM provider abstraction
│   │       └── init/         # Project initialization
│   │
│   ├── adapters/      # Agent adapters
│   │
│   ├── mcp/           # MCP server
│   │   └── src/
│   │       ├── mcp-server.ts    # MCP protocol implementation
│   │       └── index.ts          # Exports
│   │
│   ├── server/        # HTTP API server
│   │   └── src/
│   │       ├── index.ts          # Express app
│   │       ├── routes/           # API endpoints
│   │       │   ├── projects.ts
│   │       │   ├── ask.ts
│   │       │   ├── feedback.ts
│   │       │   ├── jobs.ts
│   │       │   └── health.ts
│   │       └── services/
│   │           └── project-service.ts  # Project lifecycle management
│   │
│   └── client/        # TypeScript API client
│       └── src/
│           └── index.ts          # KontextMindClient class
│
├── apps/
│   └── cli/           # Command-line interface
│       └── src/
│           ├── index.ts          # CLI entry point
│           └── commands/
│               ├── init.ts
│               ├── scan.ts
│               ├── index.ts
│               ├── summarize.ts
│               ├── ask.ts
│               ├── serve.ts
│               ├── mcp.ts
│               └── ...
│
└── docs/
    └── (documentation)
```

### Data Flow

```
Git Repository
      │
      ▼
┌─────────────┐
│   Scanner   │ → Creates .kg/file-index.json
└─────────────┘
      │
      ▼
┌─────────────┐
│   Parser    │ → Creates .kg/symbol-index.json
└─────────────┘
      │
      ├──────────────────┐
      │                  │
      ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ Summarizer  │    │  Chatbot    │
│ (LLM call)  │    │  KB Builder │
└─────────────┘    └─────────────┘
      │                  │
      ▼                  ▼
.summaries/          .kontextmind/chatbot/
      │                  │
      └────────┬─────────┘
               │
               ▼
        ┌─────────────┐
        │  Ask Engine │
        └─────────────┘
               │
               ▼
        User Answer
```

---

## How It Differs From Other Tools

### Comparison Table

| Feature | KontextMind | GitHub Copilot | Sourcegraph | LangChain |
|---------|-------------|----------------|-------------|-----------|
| Project Memory | ✅ | ❌ | ❌ | ❌ |
| Knowledge Graph | ✅ | ❌ | ❌ | ❌ |
| Agent Continuity | ✅ | ❌ | ❌ | ❌ |
| Local-First | ✅ | ❌ | ❌ | ❌ |
| MCP Support | ✅ | ❌ | ❌ | ✅ |
| Chatbot Q&A | ✅ | ❌ | ❌ | ✅ |
| Secret Scanning | ✅ | ❌ | ❌ | ❌ |
| Obsidian Export | ✅ | ❌ | ❌ | ❌ |
| No External DB | ✅ | ❌ | ❌ | ❌ |

### Detailed Comparisons

#### vs. GitHub Copilot

| Aspect | GitHub Copilot | KontextMind |
|--------|---------------|-------------|
| Scope | Single file | Whole project |
| Context | Current file only | Project-wide |
| Memory | None | Full session history |
| Q&A | None | Chatbot mode |
| Customization | Limited | Full control |

#### vs. Sourcegraph

| Aspect | Sourcegraph | KontextMind |
|--------|-------------|-------------|
| Purpose | Code search | Project brain |
| Infrastructure | Server required | Local files |
| Agent integration | None | Full MCP |
| Q&A | None | Natural language |
| Memory | None | Persistent |

#### vs. Custom Embeddings (Pinecone, Weaviate)

| Aspect | Custom Embeddings | KontextMind |
|--------|------------------|-------------|
| Setup | Complex | Simple (`kontextmind init`) |
| Infrastructure | External DB | Local files |
| Agent-native | No | Yes |
| Maintenance | High | Low |
| Portability | Poor | Excellent |

#### vs. LangChain

| Aspect | LangChain | KontextMind |
|--------|-----------|-------------|
| Complexity | High | Low |
| Purpose | General LLM apps | Project-specific |
| Learning curve | Steep | Gentle |
| Agent-native | Partial | Full |
| Local-first | No | Yes |

### Unique Advantages

1. **Project-Native Storage**
   - Data lives in `.kontextmind/` directory
   - Versioned with code (git)
   - No external dependencies
   - Easy to share across team

2. **Agent-Agnostic Design**
   - Works with any MCP client
   - No vendor lock-in
   - Open protocol (MCP)

3. **Privacy-First**
   - No data leaves your machine
   - No external API calls for storage
   - Full control over data

4. **Built-in Security**
   - Secret scanning
   - Prompt injection detection
   - Audit logging

---

## MCP Server Integration

### What is MCP?

The **Model Context Protocol (MCP)** is an open protocol that enables AI clients to connect to external tools and resources. It provides:

- **Tools** - Functions the AI can call
- **Resources** - Data the AI can read
- **Prompts** - Reusable prompt templates

### KontextMind MCP Tools

```typescript
// All available MCP tools (11 total)
const MCP_TOOLS = [
  // Project status and search
  { name: 'project.status', description: 'Get project status' },
  { name: 'project.search', description: 'Search files/symbols' },

  // File and symbol info
  { name: 'project.get_file_summary', description: 'Get file summary' },
  { name: 'project.get_symbol_summary', description: 'Get symbol info' },

  // Dependency analysis
  { name: 'project.find_dependencies', description: 'Find dependencies' },
  { name: 'project.find_callers', description: 'Find function callers' },
  { name: 'project.find_related_files', description: 'Find related files' },

  // Q&A and handoff
  { name: 'project.ask_readonly', description: 'Ask question (no code in response)' },
  { name: 'project.create_handoff', description: 'Create handoff document' },

  // Maintenance
  { name: 'project.refresh_summary', description: 'Refresh stale summaries' },
  { name: 'project.security_scan', description: 'Scan for security issues' },
];
```

### MCP Resources

```typescript
const MCP_RESOURCES = [
  { uri: 'kontextmind://project/overview', name: 'Project Overview' },
  { uri: 'kontextmind://project/architecture', name: 'Architecture' },
  { uri: 'kontextmind://project/current-state', name: 'Current State' },
  { uri: 'kontextmind://graph/files', name: 'File Graph' },
  { uri: 'kontextmind://graph/symbols', name: 'Symbol Graph' },
  { uri: 'kontextmind://handoff/latest', name: 'Latest Handoff' },
  { uri: 'kontextmind://summaries/files', name: 'File Summaries' },
];
```

### How MCP Works

```
┌─────────────┐         ┌─────────────┐
│   Claude    │◄───────►│ KontextMind │
│   (MCP      │  JSON   │   MCP       │
│   Client)   │  RPC    │   Server    │
└─────────────┘         └─────────────┘
     │                       │
     │  list_tools           │
     │──────────────────────►│
     │                       │
     │  [tools...]           │
     │◄──────────────────────│
     │                       │
     │  call_tool            │
     │  {name, args}         │
     │──────────────────────►│
     │                       │
     │  {result}             │
     │◄──────────────────────│
```

### Starting the MCP Server

```bash
# Stdio mode (for Claude Code, Continue, etc.)
kontextmind mcp

# HTTP mode (for remote clients)
kontextmind mcp --transport http --port 7332
```

### MCP in Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "npx",
      "args": ["kontextmind", "mcp"]
    }
  }
}
```

**Note:** The settings above use `npx` which downloads and runs the package. For better performance, install the CLI globally first:

```bash
# From the kontextmind repository
cd /path/to/kontextmind
npm install -g ./apps/cli

# Then update settings to use direct command
{
  "mcpServers": {
    "kontextmind": {
      "command": "kontextmind",
      "args": ["mcp"]
    }
  }
}
```

### MCP Troubleshooting

**"Connection closed" error:**
1. Ensure project is initialized: `cd /your/project && kontextmind init --yes`
2. Check version matches: `kontextmind --version`
3. Test MCP directly: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | kontextmind mcp`

**MCP not responding:**
- Check if project has `.kontextmind` directory
- Verify `kontextmind mcp` works in terminal first
- Ensure no firewall blocking stdio communication

**Project not detected:**
- MCP must run from a directory containing `.kontextmind/config.json`
- Run `kontextmind init` in your project first

---

## Project Management

### Project Lifecycle

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌────────┐
│  Init   │────►│  Scan    │────►│  Index  │────►│Summarize│
└─────────┘     └──────────┘     └─────────┘     └────────┘
                                                             │
                                                             ▼
     ┌─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────┐     ┌────────┐     ┌─────────┐
│KB Build │────►│  Ask   │────►│Feedback │
└─────────┘     └────────┘     └─────────┘
```

### Step-by-Step Process

#### 1. Initialization

```bash
kontextmind init --yes
```

Creates:
- Agent instruction files
- Configuration directories
- Initial empty indexes

#### 2. Scanning

```bash
kontextmind scan
```

Output:
```
KontextMind Scan
Scanning project...

✓ Files indexed: 757
✓ Files ignored: 18
✓ Large files skipped: 0
✓ Secret-sensitive files skipped: 0

File index: 757 files
Last scan: 5/12/2026, 10:19:52 AM
```

Creates: `.kg/file-index.json`

#### 3. Indexing

```bash
kontextmind index
```

Output:
```
KontextMind Index
Indexing project...

Index Complete
  Files processed: 30
  Files skipped: 727
  Symbols indexed: 130
  Dependencies indexed: 46
  Graph nodes: 177
  Graph edges: 241
```

Creates: `.kg/symbol-index.json`, `.kg/dependency-graph.json`

#### 4. Summarization

```bash
kontextmind summarize --all
```

Output:
```
[PROGRESS] Starting summarization: 757 files
[PROGRESS] 1/757 0.1% Generated summary: backend/src/audit.rs (generated=1 skipped=0 failed=0)
[PROGRESS] 2/757 0.3% Generated summary: backend/src/auth/jwt.rs (generated=2 skipped=0 failed=0)
...
```

Creates layered summaries and writes current progress to `.logs/summary-progress.json`:

```text
.summaries/
├── files/        # file-level summaries
├── functions/    # symbol/function/class/method summaries
├── modules/      # directory/package rollups
├── api/          # endpoint summaries from indexed API routes
├── decisions/    # decision, handoff, and current-state summaries
└── manifest.json # freshness/dependency manifest
```

Check numeric progress while a run is active or after it finishes:

```bash
kontextmind summarize --status
kontextmind status
```

#### 5. KB Build

```bash
kontextmind kb build
```

Creates `.kontextmind/chatbot/*.json` plus a summary-first retrieval corpus:

```text
.kontextmind/chatbot/
├── file-summaries.json
├── function-summaries.json
├── module-summaries.json
├── api-summaries.json
├── decision-summaries.json
├── summary-manifest.json
├── corpus.jsonl
└── retrieval-index.json
```

#### 6. Asking Questions

```bash
kontextmind ask "How does authentication work?"
```

Returns: Natural language answer with confidence score

### Project Directory Structure

After full initialization:

```
project/
├── .kontextmind/
│   ├── config.json          # Project configuration
│   ├── policy.json          # Security/operational rules
│   ├── providers.json       # LLM provider settings
│   ├── instructions.master.md  # Master instructions
│   └── chatbot/
│       ├── architecture.md     # Architecture docs
│       ├── project-overview.md # Project overview
│       ├── common-questions.json  # Pre-computed Q&A
│       ├── api-flows.json     # API documentation
│       ├── file-summaries.json # File summary map
│       ├── function-summaries.json # Function summary map
│       ├── dependency-map.json # Dependency documentation
│       ├── entity-map.json    # Entity documentation
│       ├── response-policy.json # Response guidelines
│       └── troubleshooting.json # Common issues
│
├── .kg/
│   ├── file-index.json      # All project files
│   ├── symbol-index.json    # All symbols (functions, classes)
│   ├── dependency-graph.json # Import/export relationships
│   └── hash-manifest.json   # File hash tracking
│
├── .summaries/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── jwt.rs.summary     # LLM summary
│   │   │   │   └── mod.rs.summary
│   │   │   └── main.rs.summary
│   │   └── Cargo.toml.summary
│   └── frontend/
│       └── src/
│           └── App.tsx.summary
│
├── .context/
│   ├── handoff.md           # Session handoff notes
│   ├── current-state.md     # Project status
│   ├── conventions.md        # Coding conventions
│   └── boot-prompt.md       # Boot instructions
│
├── .logs/
│   ├── audit-events.log
│   ├── security-events.log
│   ├── cost-events.log
│   └── qna-events.log
│
├── CLAUDE.md                # Claude Code instructions
├── AGENTS.md               # Generic agent instructions
└── README_AI.md            # AI agent guide
```

---

## Task & Session Management

### Session Tracking

KontextMind tracks sessions in `.context/handoff.md`:

```markdown
# Session Handoff

## Current Session
- **Started**: 2026-05-12T10:00:00Z
- **Agent**: claude-code
- **Mode**: full-agent

## Work Completed
- Implemented user authentication
- Added JWT token validation
- Created password hashing utilities

## Current Task
Implementing refresh token rotation

## Next Steps
1. Add refresh token endpoint
2. Implement token rotation logic
3. Add session cleanup job

## Pending Decisions
- Token expiration time (currently 7 days)
- Refresh token storage (memory vs DB)
```

### Task State Machine

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│ pending │───►│ running  │───►│ completed │    │  failed   │
└─────────┘    └──────────┘    └───────────┘    └───────────┘
                    │                  ▲              │
                    │                  │              │
                    └──────────────────┴──────────────┘
                              (retry)
```

### Job Tracking (API Server)

For long-running operations like project setup:

```json
{
  "job_id": "job_abc123",
  "project_id": "beanav16",
  "type": "setup",
  "status": "running",
  "progress_percent": 72,
  "current_step": "Generating summaries (127+ files)",
  "created_at": "2026-05-12T10:27:27Z",
  "updated_at": "2026-05-12T10:43:28Z",
  "error": null
}
```

### Progress Tracking

| Phase | Progress Range | Description |
|-------|-----------------|-------------|
| Clone | 0-16% | Git clone using GITHUB_TOKEN |
| Init | 17-33% | Run kontextmind init |
| Scan | ~33% | Index all files |
| Index | 34-66% | Parse symbols and dependencies |
| Summarize | 67-94% | Generate LLM summaries |
| KB Build | 95-99% | Build chatbot knowledge base |
| Complete | 100% | Project ready |

---

## LLM/Agent Interaction

### How Claude Uses KontextMind

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code Session                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. READ CLAUDE.md                                               │
│     └─► Instructions from project                                 │
│                                                                  │
│  2. READ .context/handoff.md                                     │
│     └─► What was done in previous sessions                       │
│                                                                  │
│  3. READ .context/current-state.md                               │
│     └─► Project status, recent activity                           │
│                                                                  │
│  4. READ .kontextmind/instructions.master.md                     │
│     └─► Agent rules, security policies                            │
│                                                                  │
│  5. READ .kontextmind/policy.json                                │
│     └─► Operational constraints                                  │
│                                                                  │
│  6. USE MCP TOOLS (if available)                                 │
│     └─► project.status, project.search, etc.                     │
│                                                                  │
│  7. ASK QUESTIONS (via kontextmind ask or API)                    │
│     └─► Query the knowledge base                                 │
│                                                                  │
│  8. UPDATE .context/handoff.md (end of session)                  │
│     └─► Save state for next agent                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Provider Abstraction

KontextMind supports multiple LLM providers:

```typescript
// Provider interface
interface LLMProvider {
  complete(prompt: string, options?: Options): Promise<string>;
  embed(text: string): Promise<number[]>;
}

// Implementations
- OpenAIProvider (OpenAI API)
- AnthropicProvider (Anthropic API)
- OpenAICompatibleProvider (LM Studio, Ollama, etc.)
- MockProvider (no API key needed)
```

### Configuration

```json
// .kontextmind/providers.json
{
  "selected_provider": "primary",
  "providers": {
    "primary": {
      "type": "openai-compatible",
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-xxx",
      "model": "gpt-4o"
    },
    "local": {
      "type": "openai-compatible",
      "base_url": "http://localhost:8080/v1",
      "api_key": "not-needed",
      "model": "llama-3"
    }
  }
}
```

### Cost Tracking

KontextMind logs all LLM usage:

```json
// .logs/cost-events.log
{"timestamp":"2026-05-12T10:30:00Z","operation":"summarize","model":"gpt-4o","input_tokens":1500,"output_tokens":200,"cost":0.003}
{"timestamp":"2026-05-12T10:31:00Z","operation":"ask","model":"gpt-4o","input_tokens":3000,"output_tokens":500,"cost":0.007}
```

---

## External Project Integration

### Integration Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    External Project                                 │
│                 (React, Node, Python, etc.)                         │
│                                                                      │
│    ┌──────────────────────────────────────────────────────────┐    │
│    │                    Your Application                        │    │
│    │                                                          │    │
│    │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │    │
│    │   │   Chat UI   │   │ Admin Panel │   │  Webhooks   │   │    │
│    │   └─────────────┘   └─────────────┘   └─────────────┘   │    │
│    └──────────────────────────┬───────────────────────────────────┘    │
│                               │                                       │
│                    ┌──────────▼──────────┐                            │
│                    │  @kontextmind/client │                            │
│                    │   (TypeScript SDK)   │                            │
│                    └──────────┬──────────┘                            │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │ REST API
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                    KontextMind API Server                            │
│                           │                                          │
│    ┌──────────────────────┼──────────────────────┐                   │
│    │                      │                      │                  │
│    ▼                      ▼                      ▼                  │
│ ┌──────────┐        ┌──────────┐        ┌──────────┐              │
│ │ Projects │        │   Jobs   │        │ Feedback │              │
│ └──────────┘        └──────────┘        └──────────┘              │
│                           │                                          │
│                           ▼                                          │
│                    ┌──────────────┐                                  │
│                    │  /kontextmind/projects/                        │
│                    │  (Project Storage)                             │
│                    └──────────────┘                                  │
└────────────────────────────────────────────────────────────────────┘
```

### Integration Options

#### Option 1: REST API (HTTP)

Best for: Web applications, mobile apps, any HTTP-capable client.

```typescript
import { KontextMindClient } from '@kontextmind/client';

const client = new KontextMindClient({
  baseUrl: 'http://localhost:7331',
  apiKey: process.env.KONTMIND_API_KEY,
});

// Setup project
const { job_id } = await client.setupProject({
  gitUrl: 'https://github.com/org/repo',
  name: 'my-project',
});

// Poll for completion
const job = await client.waitForJob(job_id);

// Ask question
const answer = await client.ask('my-project', {
  question: 'How does authentication work?'
});

// Submit feedback
await client.submitFeedback({
  qa_id: answer.qa_id,
  project: 'my-project',
  signal: 'helpful',
});
```

#### Option 2: MCP Server

Best for: AI coding agents (Claude Code, Continue, Cursor).

```bash
# Add to Claude Code settings
kontextmind mcp
```

#### Option 3: Direct CLI

Best for: Scripts, CI/CD pipelines, local development.

```bash
kontextmind init
kontextmind scan
kontextmind ask "What does this project do?"
```

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  kontextmind:
    image: kontextmind-api:latest
    ports:
      - "7331:7331"
    environment:
      - API_KEY=${KONTMIND_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_PROVIDER=openai-compatible
      - LLM_BASE_URL=${LLM_BASE_URL}
      - LLM_MODEL=${LLM_MODEL:-claude-opus-4-7}
    volumes:
      - kontextmind-data:/kontextmind/projects

volumes:
  kontextmind-data:
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 7331 | Server port |
| `HOST` | No | 0.0.0.0 | Server host |
| `DATA_DIR` | No | /kontextmind/projects | Projects directory |
| `API_KEY` | No | - | API authentication key |
| `GITHUB_TOKEN` | Yes* | - | GitHub PAT for cloning |
| `LLM_API_KEY` | Yes* | - | LLM API key |
| `LLM_PROVIDER` | No | openai | Provider type |
| `LLM_MODEL` | No | provider default | Model name |
| `LLM_BASE_URL` | No | - | Custom endpoint |

*Required for project setup and ask operations.

### React Integration Example

```typescript
// src/hooks/useKontextMind.ts
import { useState, useEffect } from 'react';
import { KontextMindClient } from '@kontextmind/client';

const kontext = new KontextMindClient({
  baseUrl: import.meta.env.VITE_KONTEXTMIND_URL,
  apiKey: import.meta.env.VITE_KONTMIND_API_KEY,
});

export function useKontextMind(projectName: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectStatus, setProjectStatus] = useState<string>('loading');

  useEffect(() => {
    // Check project status
    kontext.getProject(projectName).then(p => {
      setProjectStatus(p.status);
    }).catch(() => {
      setProjectStatus('not_found');
    });
  }, [projectName]);

  async function ask(question: string) {
    setLoading(true);
    try {
      const answer = await kontext.ask(projectName, { question });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer.answer,
        qa_id: answer.qa_id,
      }]);
      return answer;
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(qa_id: string, signal: 'helpful' | 'not_helpful') {
    await kontext.submitFeedback({ qa_id, project: projectName, signal });
  }

  return { messages, loading, projectStatus, ask, submitFeedback };
}
```

---

## Technical Deep Dive

### File Index Structure

```json
// .kg/file-index.json
{
  "version": "1.0",
  "generated_at": "2026-05-12T10:19:52Z",
  "total_files": 757,
  "files": [
    {
      "path": "backend/src/auth/jwt.rs",
      "hash": "abc123...",
      "size": 4096,
      "modified": "2026-05-10T15:30:00Z",
      "language": "rust",
      "skip_reason": null
    }
  ],
  "ignored_patterns": ["node_modules", "target", ".git"],
  "large_files": [],
  "secret_files": []
}
```

### Symbol Index Structure

```json
// .kg/symbol-index.json
{
  "version": "1.0",
  "generated_at": "2026-05-12T10:20:00Z",
  "total_symbols": 130,
  "symbols": [
    {
      "name": "AuthService",
      "kind": "class",
      "file": "backend/src/auth/service.rs",
      "line": 15,
      "signature": "pub struct AuthService",
      "dependencies": ["UserRepository", "JwtToken"],
      "docs": "Handles user authentication and authorization"
    }
  ]
}
```

### Q&A History Structure

```json
// .kontextmind/chatbot/qa-history.jsonl
{"qa_id":"qa_001","question":"How does auth work?","answer":"Uses JWT tokens...","timestamp":"2026-05-12T10:30:00Z","confidence":0.85,"tier":5,"sources":["llm-synthesis"],"feedback":{"signal":"helpful","timestamp":"2026-05-12T10:35:00Z"}}
{"qa_id":"qa_002","question":"What is the main function?","answer":"The entry point...","timestamp":"2026-05-12T10:40:00Z","confidence":0.92,"tier":0,"sources":["history"],"feedback":null}
```

### Embedding Cache Structure

```json
// .kontextmind/chatbot/embedding-cache.json
{
  "version": "1.0",
  "embeddings": [
    {
      "id": "emb_001",
      "text_hash": "hash_of_question",
      "normalized_text": "how does auth work",
      "embedding": [0.123, -0.456, ...],
      "created_at": "2026-05-12T10:30:00Z"
    }
  ]
}
```

---

## Implementation Status

### Completed Features ✅

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Project initialization, CLI, agent instructions | ✅ Complete |
| 2 | File scanner, index, hash tracking | ✅ Complete |
| 3 | Symbol parser, knowledge graph | ✅ Complete |
| 4 | Summary engine, stale detection | ✅ Complete |
| 5 | Chatbot KB, ask command, Q&A history | ✅ Complete |
| 6 | HTTP API server, project management | ✅ Complete |
| 7 | MCP server, tool definitions | ✅ Complete |
| 8 | Security scanning, audit logging, cost tracking | ✅ Complete |
| 9 | Obsidian export | ✅ Complete |
| 10 | Polish, documentation, release readiness | ✅ Complete |

### Current Capabilities

1. **Local CLI**
   - `kontextmind init` - Initialize project
   - `kontextmind scan` - Scan files
   - `kontextmind index` - Index symbols
   - `kontextmind summarize` - Generate summaries
   - `kontextmind kb build` - Build knowledge base
   - `kontextmind ask` - Query the project
   - `kontextmind serve` - Start HTTP server
   - `kontextmind mcp` - Start MCP server
   - `kontextmind secrets scan` - Scan for secrets
   - `kontextmind audit` - View audit logs

2. **HTTP API**
   - Project setup via GitHub
   - Project management (list, get, delete)
   - Reindexing projects
   - Question answering
   - Feedback collection
   - Job status tracking
   - Settings management
   - Progress tracking

3. **MCP Server**
   - `project.status`
   - `project.search`
   - `project.get_file_summary`
   - `project.get_symbol_summary`
   - `project.find_dependencies`
   - `project.find_callers`
   - `project.find_related_files`
   - And more...

4. **TypeScript Client**
   - Full API coverage
   - Automatic job polling
   - TypeScript types
   - ESM support

### Known Limitations

1. **Parser** - Basic support for TypeScript, JavaScript, Python only
2. **Knowledge Graph** - JSON-based, not a production database
3. **Chatbot** - Answers from summaries, not raw code
4. **No Web UI** - CLI and API only
5. **MCP clients** - Depends on client compatibility

---

## Roadmap & Future Work

### Phase 11: Enhanced Parser

- [ ] Add Rust support
- [ ] Add Go support
- [ ] Add Java/Kotlin support
- [ ] Add C# support

### Phase 12: Database Integration

- [ ] SQLite for knowledge graph (instead of JSON)
- [ ] Full-text search with FTS5
- [ ] Graph queries with edge filtering

### Phase 13: Enhanced Chatbot

- [ ] Real-time code analysis
- [ ] Multi-file context understanding
- [ ] Conversation history
- [ ] Intent detection

### Phase 14: Web UI

- [ ] Dashboard for project management
- [ ] Q&A interface
- [ ] Feedback visualization
- [ ] Settings management

### Phase 15: Team Features

- [ ] Shared knowledge bases
- [ ] Team-wide conventions
- [ ] Permission system
- [ ] Audit trail

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **Agent** | AI coding assistant (Claude, Codex, etc.) |
| **KB** | Knowledge Base - structured project data |
| **MCP** | Model Context Protocol - standard for AI tool access |
| **QA** | Question & Answer pair |
| **Tier** | Answer source quality (0=history, 5=LLM) |
| **Project** | Git repository managed by KontextMind |

### Agent Setup Instructions

For detailed agent setup instructions, see [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md).

**Quick Summary:**

```bash
# 1. Check if KontextMind is configured
if [ -f ".kontextmind/config.json" ]; then
  echo "KontextMind is configured"
else
  # 2. If not, initialize in full-agent mode
  kontextmind init --yes --mode full-agent
fi

# 3. Build knowledge (scan + index are fast)
kontextmind scan && kontextmind index

# 4. START SUMMARIZATION IN BACKGROUND - CRITICAL
# This takes 30+ minutes for large projects but runs while you work
nohup kontextmind summarize --all > kontextmind-summarize.log 2>&1 &
echo "Summarization started in background. Check with: tail -f kontextmind-summarize.log"

# 5. Continue with your work - partial summaries are better than none

# 6. Check progress periodically:
tail -f kontextmind-summarize.log
kontextmind summarize --status

# 7. When complete, build KB:
kontextmind kb build

# 8. Verify
kontextmind status && kontextmind doctor
```

### File Reference

| File | Purpose |
|------|---------|
| `.kg/file-index.json` | All project files |
| `.kg/symbol-index.json` | All code symbols |
| `.summaries/*.md` | LLM-generated file summaries |
| `.kontextmind/chatbot/*.json` | Chatbot knowledge base |
| `.context/handoff.md` | Session handoff notes |
| `.logs/*.log` | Audit, security, cost events |

### Quick Reference

```bash
# Initialize
kontextmind init --yes

# Build knowledge
kontextmind scan && kontextmind index && kontextmind summarize --all && kontextmind kb build

# Query
kontextmind ask "question"

# API
kontextmind serve --port 7331

# MCP
kontextmind mcp

# Docker
docker run -p 7331:7331 --env-file .env kontextmind-api:latest
```

---

**End of Documentation**
