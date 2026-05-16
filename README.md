# KontextMind

**The Shared Project Brain for AI Coding Agents**

KontextMind is a comprehensive CLI tool and MCP server that provides AI coding agents with a centralized knowledge base about your project. It implements a full brain system with learning, memory, context management, agentic capabilities, and a 70+ endpoint HTTP API server.

---

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands Reference](#commands-reference)
5. [Brain Ask Architecture](#brain-ask-architecture)
6. [Learning System](#learning-system)
7. [MCP Server](#mcp-server)
8. [API Server](#api-server)
9. [Architecture](#architecture)

---

## Features

### Phase 1: Core Brain

| Module | Description |
|--------|-------------|
| **Awareness** | Self-awareness for agent state management |
| **Dynamic Context** | Real-time context injection system |
| **Brain Ask** | Agentic code reading with smart file selection |

### Phase 2: Learning & Adaptation

| Module | Description |
|--------|-------------|
| **Learning Bridge** | Automatic sync from summaries and Q&A |
| **Outcome Tracker** | Track success/failure patterns |
| **Intent Predictor** | Proactive task prediction |
| **Personalization** | User-specific adaptation |

### Phase 3: Memory & Continuity

| Module | Description |
|--------|-------------|
| **Semantic Memory** | Cross-session knowledge storage |
| **Mental Model** | Project entity mapping |
| **Proactive Handoff** | Context transfer documents |
| **Conversation Compression** | Token budget optimization |

### Phase 4: Project Intelligence

| Module | Description |
|--------|-------------|
| **Adaptive Token Budget** | Dynamic token allocation |
| **Skill Dependency Graph** | Skill relationships |
| **Codebase Health Monitor** | Project health tracking |

### Phase 5: Multi-Agent & Real-Time

| Module | Description |
|--------|-------------|
| **Multi-Agent Sync** | Memory sync across agents |
| **Real-Time Context** | Live context injection |
| **Event Bus** | Event-driven communication |

### Phase 6: Tools & Security

| Module | Description |
|--------|-------------|
| **Composable Tools** | Tool action system |
| **Security Audit** | Secret detection & scanning |

---

## Installation

### Prerequisites

- Node.js 18+
- pnpm 8+
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/nikzdevz/KontextMind.git
cd KontextMind

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Link CLI globally (optional)
pnpm link -g
```

### One-Command Setup

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/nikzdevz/KontextMind/main/scripts/setup.ps1 | iex
```

**macOS/Linux:**
```bash
curl -sSL https://raw.githubusercontent.com/nikzdevz/KontextMind/main/scripts/setup.sh | bash
```

---

## Quick Start

```bash
# 1. Initialize KontextMind in your project
kontextmind init --mode full-agent --yes

# 2. Scan and index all files
kontextmind scan
kontextmind index

# 3. Generate AI summaries
kontextmind summarize

# 4. Build knowledge base
kontextmind kb build

# 5. Ask questions
kontextmind ask "What does this project do?"

# 6. Start MCP server
kontextmind mcp --mode full-agent --transport http --port 7332
```

---

## Commands Reference

### Initialization & Setup

| Command | Description |
|---------|-------------|
| `kontextmind init` | Initialize project with mode and agents |
| `kontextmind setup` | Interactive setup wizard |
| `kontextmind deinit` | Remove KontextMind from project |
| `kontextmind status` | Show project status |
| `kontextmind doctor` | Diagnose configuration issues |

### Scanning & Indexing

| Command | Description |
|---------|-------------|
| `kontextmind scan` | Index all project files |
| `kontextmind index` | Extract symbols and build knowledge graph |
| `kontextmind summarize` | Generate AI-powered summaries |
| `kontextmind kb build` | Build Q&A knowledge base |

### Knowledge & Q&A

| Command | Description |
|---------|-------------|
| `kontextmind ask <question>` | Ask about the project |
| `kontextmind session create` | Create new chat session |
| `kontextmind session list` | List all sessions |
| `kontextmind session chat <id> <question>` | Chat in session |
| `kontextmind session show <id>` | Show session details |
| `kontextmind session delete <id>` | Delete session |

### Server & MCP

| Command | Description |
|---------|-------------|
| `kontextmind serve` | Start HTTP API server (port 7331) |
| `kontextmind mcp` | Start MCP server (stdio/http) |
| `kontextmind daemon` | Background daemon mode |

### Agent & Analytics (NEW)

| Command | Description |
|---------|-------------|
| `kontextmind agent` | Agent awareness mode |
| `kontextmind analytics` | Q&A statistics |
| `kontextmind insights` | Cross-session insights |
| `kontextmind search <query>` | Search codebase |
| `kontextmind task list` | List tasks |
| `kontextmind task complete` | Mark task complete |

### Learning Commands

| Command | Description |
|---------|-------------|
| `kontextmind learn sync` | Trigger learning sync |
| `kontextmind learn stats` | Learning statistics |
| `kontextmind learn patterns` | Success/failure patterns |
| `kontextmind learn export` | Export learning data |
| `kontextmind learn import` | Import learning data |

### Quality Commands

| Command | Description |
|---------|-------------|
| `kontextmind quality report` | Quality report |
| `kontextmind quality trends` | Quality trends |

### Dataset & Export

| Command | Description |
|---------|-------------|
| `kontextmind dataset export` | Export Q&A training dataset |
| `kontextmind dataset export-summaries` | Export code summaries as training data |
| `kontextmind dataset stats` | Show Q&A dataset statistics |
| `kontextmind dataset stats-summaries` | Show summary dataset statistics |
| `kontextmind dataset validate` | Validate quality |
| `kontextmind dataset version list` | List dataset versions |

### Security & Audit

| Command | Description |
|---------|-------------|
| `kontextmind secrets` | Scan for secrets in code |
| `kontextmind audit` | Show audit summary |
| `kontextmind obsidian` | Export to Obsidian |

### Configuration

| Command | Description |
|---------|-------------|
| `kontextmind config --action show` | Show config |
| `kontextmind config --action list` | List providers |
| `kontextmind config --action add --name x --type y --apiKey z` | Add provider |

---

## Brain Ask Architecture

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER QUESTION                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: LEARNED KNOWLEDGE                                          │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Semantic    │  │  Mental      │  │  Q&A         │                   │
│  │  Memory      │  │  Model       │  │  History     │                   │
│  │  +0.25       │  │  +0.20       │  │  +0.15       │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│         │                │                │                              │
│         └────────────────┼────────────────┘                              │
│                          ▼                                               │
│              Sources Found?                                              │
│                   │                                                      │
│         ┌────────┴────────┐                                             │
│         ▼                 ▼                                             │
│       YES                 NO                                            │
│         │                 │                                              │
│         ▼                 ▼                                             │
│  Return Answer    PHASE 2: AGENTIC CODE READING                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: AGENTIC CODE READING                                        │
│                                                                          │
│  Step 1: Classify Question (intent, entities, keywords)                │
│                                                                          │
│  Step 2: Semantic Search (AI summaries first)                          │
│          → If found: Generate answer (confidence=0.85)                 │
│          → Return                                                        │
│                                                                          │
│  Step 3: Raw File Search (when no summaries)                          │
│          → findRawFileContent() → returns up to 5 chunks                │
│                                                                          │
│  Step 4: AGENTIC READING LOOP                                           │
│          ┌────────────────────────────────────────────────────┐        │
│          │  For each chunk (max 8-12 files):                   │        │
│          │                                                     │        │
│          │  1. smartChunkRead() → read up to 5000 chars        │        │
│          │     • If mid-block, extend to closing brace        │        │
│          │     • If no brace, cut at statement                 │        │
│          │                                                     │        │
│          │  2. Ask LLM: "YES/SUGGEST/NO?"                     │        │
│          │                                                     │        │
│          │  3. If YES → Return answer (confidence=0.85)       │        │
│          │  4. If SUGGEST → Add files to queue, continue      │        │
│          │  5. If NO → All files exhausted                     │        │
│          │                                                     │        │
│          │  Also: autoGenerateSummary() for each file read   │        │
│          └────────────────────────────────────────────────────┘        │
│                                                                          │
│  Step 5: Exhaustion Handling                                           │
│          → Partial answer (confidence=0.5)                            │
│          → If confidence < 0.6 → "Out of context" response            │
└─────────────────────────────────────────────────────────────────────┘
```

### Smart File Reading

```
File is ≤ 5000 chars? → YES: Return full content

Have unclosed braces? → YES: Look back for closing brace }
                                       ↓
                              Cut at brace boundary (complete block)

NO closing brace in range? → Find last complete statement (semicolon)
                              ↓
                    Cut at statement boundary
```

### Dynamic File Suggestion

```
After reading each file, LLM can respond with:

YES: [answer]     → Stop, return answer
SUGGEST: a.ts, b.ts → Add to queue, continue reading
NO: [reason]       → No more files needed

Iteration limit: 8 files initially, +1 per suggestion (max 12)
```

### Out of Context Responses

When answer cannot be found:
- "As per the project, I am not able to answer this question."
- "In your project, such a feature is not implemented yet."
- "This question is out of context for the current project."
- "Based on my analysis, I couldn't find information related to this question."

---

## Learning System

### Automatic Sync Types

| Type | Trigger | Description |
|------|---------|-------------|
| **Startup Sync** | On MCP server start | Sync from summaries and Q&A |
| **Periodic Sync** | Every 5 minutes (configurable) | Background learning |
| **On-Demand Sync** | Manual trigger | `kontextmind sync --force` |
| **Event-Based** | Summary hook triggers | Real-time learning |

### Import Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ LOCAL-ONLY BY DEFAULT                                               │
│                                                                          │
│  Project A                    Project B                                │
│  ┌─────────────┐             ┌─────────────┐                       │
│  │ Learned     │             │ Learned     │                       │
│  │ Knowledge   │             │ Knowledge   │                       │
│  └─────────────┘             └─────────────┘                       │
│        │                           │                              │
│        └──────────┬────────────────┘                              │
│                   │                                                 │
│                   ▼                                                 │
│         ┌─────────────────┐                                        │
│         │ Manual Import   │                                        │
│         │ (opt-in)         │                                        │
│         │                 │                                        │
│         │ kontextmind     │                                        │
│         │ import --from  │                                        │
│         │ /path/to/proj   │                                        │
│         └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Outcome Tracking

```bash
# Track what works
kontextmind learn --track-outcomes

# View patterns
kontextmind learn --show-patterns

# Get improvement suggestions
kontextmind learn --suggest
```

---

## MCP Server

### Available Tools (70+ Total)

**Status & Search:**
- `project.status` - Get project status
- `project.search` - Search files/symbols
- `project.check_provider` - Check LLM provider
- `project.search_entities` - Search entities

**Summary Tools:**
- `project.get_file_summary` - Get file summary
- `project.get_function_summary` - Get function summary
- `project.get_module_summary` - Get module summary
- `project.get_api_summary` - Get API summary
- `project.get_decision_summary` - Get decision summary
- `project.get_blocker_summary` - Get blocker summary
- `project.get_symbol_summary` - Get symbol summary
- `project.get_all_summaries` - Get all summaries
- `project.refresh_summary` - Refresh stale summaries
- `project.refresh_all_summaries` - Refresh all summaries

**Session/Task Tools:**
- `project.get_session_index` - List all sessions
- `project.get_session_stats` - Session statistics
- `project.search_sessions` - Search sessions
- `project.get_last_session` - Last session details
- `project.write_session_summary` - Write session summary
- `project.get_current_task` - Get active task
- `project.get_recent_tasks` - Recent tasks
- `project.resume_task` - Resume task
- `project.write_task_summary` - Write task summary
- `project.task_detect` - Detect task boundaries
- `project.task_complete` - Mark task complete
- `project.task_update_pending` - Update pending work

**Handoff Tools:**
- `project.create_handoff` - Create handoff document
- `project.get_task_resumption_context` - Resume context

**Memory Search:**
- `project.search_memory` - Search sessions/tasks/handoffs
- `project.get_recent_files` - Recent files
- `project.find_related_sessions` - Find related sessions

**Dependencies:**
- `project.find_dependencies` - Find imports
- `project.find_callers` - Find function callers
- `project.find_related_files` - Find related files
- `project.find_blockers` - Find blockers

**Learning:**
- `project.learn_sync` - Trigger learning sync
- `project.learn_stats` - Learning statistics
- `project.learn_patterns` - Success/failure patterns
- `project.learn_suggestions` - Improvement suggestions
- `project.learn_import` - Import from other project
- `project.learn_export` - Export learning data

**Agent Awareness:**
- `project.agent_state` - Current agent state
- `project.agent_capabilities` - Capability profile
- `project.agent_antipatterns` - Anti-patterns to avoid
- `project.agent_assess` - Self-assess current state

**Quality & Analytics:**
- `project.quality_trends` - Quality trends
- `project.quality_report` - Quality report
- `project.quality_performance` - Performance stats
- `project.ask_stats` - Q&A statistics
- `project.ask_top_questions` - Most asked questions
- `project.ask_quality` - Answer quality metrics

**Context & Insights:**
- `project.context_stats` - Context engine stats
- `project.context_export` - Export context
- `project.session_insights` - Cross-session insights
- `project.get_timeline` - Activity timeline
- `project.get_recent_activity` - Recent activity

**Continuity:**
- `project.should_continue` - Check pending work
- `project.get_continuity_suggestions` - Get suggestions
- `project.analyze_continuity` - Analyze continuity
- `project.get_blocked_tasks` - Get blocked tasks
- `project.get_task_dependencies` - Task dependencies
- `project.add_task_dependency` - Add dependency
- `project.get_task_sessions` - Sessions for task

**Security:**
- `project.security_scan` - Scan for security issues

### Starting MCP Server

```bash
# STDIO mode (for Claude Code)
kontextmind mcp --mode full-agent

# HTTP mode (for other tools)
kontextmind mcp --mode full-agent --transport http --port 7332
```

### MCP Modes

| Mode | Description |
|------|-------------|
| `readonly` | Read-only, no modifications |
| `chatbot-readonly` | Chatbot mode, read-only |
| `suggest` | Suggest changes, no apply |
| `edit-with-approval` | Edit with approval |
| `full-agent` | Full agent capabilities |

---

## API Server

### Starting the Server

```bash
# Start API server on port 7331
kontextmind serve

# Start with custom port
kontextmind serve --port 8080

# Start MCP server with full-agent mode
kontextmind mcp --mode full-agent
```

### Authentication

```bash
# Login with username/password
curl -X POST http://localhost:7331/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'

# Get access token
curl -X POST http://localhost:7331/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret","grant_type":"password"}'

# Verify token
curl -X POST http://localhost:7331/auth/verify \
  -H "Authorization: Bearer <token>"
```

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/projects` | GET | List projects |
| `/projects` | POST | Create project |
| `/projects/:id` | GET | Get project |
| `/conversations` | GET | List conversations |
| `/conversations` | POST | Create conversation |
| `/conversations/:id` | POST | Send message |
| `/projects/:id/pipeline/status` | GET | Pipeline status |
| `/projects/:id/pipeline/stream` | GET | SSE stream |

### Learning Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects/:id/learning/config` | GET/PUT | Learning config |
| `/projects/:id/learning/stats` | GET | Learning statistics |

### Request Example

```bash
# Create conversation with bearer token
curl -X POST http://localhost:7331/conversations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Session","projectId":"<project-id>"}'

# Send message
curl -X POST http://localhost:7331/conversations/<id>/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"What does this project do?"}'
```

### API Server Modes

| Mode | Description |
|------|-------------|
| `readonly` | Read-only access (default) |
| `chatbot-readonly` | Chatbot Q&A mode |
| `suggest` | Suggestions enabled |
| `edit-with-approval` | Write with approval |
| `full-agent` | Full agent capabilities |

---

## Setup Scripts

### Setup Script Features

```bash
# Windows
.\setup.ps1

# macOS/Linux
chmod +x ./setup.sh && ./setup.sh
```

**What it does:**
1. Detect prerequisites (Node.js, pnpm, Git)
2. Clone/copy project
3. Install dependencies
4. Build project
5. Create .env from template
6. Run initial scan
7. Generate summaries
8. Build knowledge base
9. Configure MCP server

### Uninstall Script

```bash
# Windows
.\uninstall.ps1 --force

# macOS/Linux
./uninstall.sh --force
```

**What it does:**
1. Stop running MCP servers
2. Create backup
3. Remove KontextMind directories
4. Remove configuration files
5. Optionally remove MCP configs

### Interactive Setup Wizard

```bash
pnpm kontextmind setup

# Steps:
# 1. Select LLM provider (OpenAI/Anthropic/etc.)
# 2. Enter API key
# 3. Choose mode (readonly/full-agent/etc.)
# 4. Configure auto-sync
# 5. Configure MCP for IDEs
# 6. Run initial scan
```

---

## Architecture

### Package Structure

```
kontextmind/
├── apps/
│   └── cli/                    # Command-line interface
│       └── src/
│           └── commands/       # CLI commands
│               ├── setup.ts    # Interactive setup
│               ├── mcp.ts      # MCP server
│               └── ...
│
├── packages/
│   ├── core/                  # Core functionality
│   │   └── src/
│   │       ├── awareness/     # Self-awareness
│   │       ├── brain-ask/     # Agentic code reading
│   │       ├── budget/        # Token budget
│   │       ├── compression/   # Context compression
│   │       ├── context/       # Dynamic context
│   │       ├── eventbus/      # Event system
│   │       ├── handoff/       # Handoff docs
│   │       ├── health/        # Health monitoring
│   │       ├── hooks/         # Event hooks
│   │       ├── learning/      # Learning bridge
│   │       ├── mental-model/  # Entity mapping
│   │       ├── memory/        # Semantic memory
│   │       ├── multiagent/     # Multi-agent sync
│   │       ├── personalization/# User adaptation
│   │       ├── prediction/     # Intent prediction
│   │       ├── realtime/       # Real-time context
│   │       ├── skills/        # Skill graph
│   │       ├── tools/         # Tool actions
│   │       ├── chatbot/      # Chatbot KB
│   │       ├── scanner/      # File scanning
│   │       ├── parser/       # Code parsing
│   │       ├── summaries/    # AI summaries
│   │       └── providers/    # LLM providers
│   │
│   ├── mcp/                   # MCP server
│   ├── server/                # HTTP API server
│   ├── client/                # Client library
│   └── adapters/             # Provider adapters
│
└── scripts/
    ├── setup.ps1             # Windows setup
    ├── setup.sh              # Unix setup
    ├── uninstall.ps1          # Windows uninstall
    └── uninstall.sh           # Unix uninstall
```

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CHUNK_SIZE` | 5000 | Characters per file chunk |
| `MAX_CONTEXT_CHARS` | 25000 | Max accumulated context |
| `MAX_FILES_TO_SUGGEST` | 3 | Max suggestions per LLM call |
| `BRACE_LOOKBACK` | 500 | Characters to look back for `}` |

---

## MCP Configuration

### Claude Code

`.mcp.json`:
```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "kontextmind",
      "args": ["mcp", "--mode", "full-agent"],
      "cwd": "/path/to/project",
      "env": {
        "DATA_DIR": ".kontextmind"
      }
    }
  }
}
```

### Claude Desktop

`~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "kontextmind",
      "args": ["mcp", "--mode", "full-agent"],
      "env": {
        "KONTEXT_PROJECT_ROOT": "C:/Users/you/Projects/your-project"
      }
    }
  }
}
```

---

## Configuration

### Project Config (`.kontextmind/config.json`)

```json
{
  "project": {
    "name": "my-project",
    "description": "Project description"
  },
  "mode": "full-agent",
  "phase": 6,
  "agents": ["claude", "codex", "roo", "cursor"],
  "git": {
    "enabled": true,
    "mode": "auto"
  },
  "learning": {
    "enabled": true,
    "syncOnStartup": true,
    "periodicSync": true,
    "syncIntervalMs": 300000
  }
}
```

### Providers Config (`.kontextmind/providers.json`)

```json
{
  "selected_provider": "openai",
  "providers": {
    "openai": {
      "type": "openai",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-4"
    },
    "anthropic": {
      "type": "anthropic",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "model": "claude-3-sonnet-20240229"
    }
  }
}
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Initialize | `kontextmind init --mode full-agent --yes` |
| Interactive setup | `kontextmind setup` |
| Scan files | `kontextmind scan` |
| Index symbols | `kontextmind index` |
| Summarize | `kontextmind summarize` |
| Build KB | `kontextmind kb build` |
| Ask question | `kontextmind ask "your question?"` |
| Start API server | `kontextmind serve --port 7331` |
| Start MCP | `kontextmind mcp --mode full-agent` |
| Check status | `kontextmind status` |
| Agent mode | `kontextmind agent` |
| Analytics | `kontextmind analytics` |
| Insights | `kontextmind insights` |
| Quality report | `kontextmind quality report` |
| Learn sync | `kontextmind learn sync` |

## API Server Quick Reference

| Task | Command |
|------|---------|
| Health check | `curl http://localhost:7331/health` |
| Login | `curl -X POST http://localhost:7331/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"secret"}'` |
| Create project | `curl -X POST http://localhost:7331/projects -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"my-project"}'` |
| Ask question | `curl -X POST http://localhost:7331/ask -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"question":"What does this project do?"}'` |

---

## Key Statistics

| Metric | Value |
|--------|-------|
| CLI Commands | 30+ |
| MCP Tools | 70+ |
| API Endpoints | 70+ |
| Documentation Files | 9 |
| Feature Areas | 33 |

---

## License

MIT