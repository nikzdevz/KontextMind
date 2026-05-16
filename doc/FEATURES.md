# KontextMind Features Documentation

**Document Version:** 2.1
**Date:** 2026-05-16
**Total Features:** 34

---

## Table of Contents

1. [Core Infrastructure](#1-core-infrastructure)
2. [AI & Learning](#2-ai-learning)
3. [Memory & Sessions](#3-memory-sessions)
4. [Quality & Security](#4-quality-security)
5. [Integration](#5-integration)
6. [Export & Data](#6-export-data)
7. [Advanced Features](#7-advanced-features)
8. [CLI Commands](#8-cli-commands)
9. [Setup Guide](#9-setup-guide)
10. [MCP Tools](#10-mcp-tools)

---

## 1. Core Infrastructure

### 1.1 Scanner / File Indexing

**Description:** Scans project files and generates a file index with hashes for change detection.

**Category:** Core Infrastructure

**Key Files:**
- `packages/core/src/scanner/scan-project.ts`
- `packages/core/src/scanner/file-index.ts`
- `packages/core/src/scanner/walk-files.ts`
- `packages/core/src/scanner/hash-file.ts`
- `packages/core/src/scanner/ignore-rules.ts`

**Capabilities:**
- Recursive file traversal
- Configurable ignore patterns (`.gitignore`, `.toolignore`)
- File hashing for change detection (SHA-256)
- Language detection
- Max file size filtering
- Secret-sensitive file detection

---

### 1.2 Code Parser / Indexer

**Description:** Parses code files to extract symbols, imports, and exports.

**Category:** Code Analysis

**Key Files:**
- `packages/core/src/parser/indexer.ts`
- `packages/core/src/parser/typescript-parser.ts`
- `packages/core/src/parser/python-parser.ts`
- `packages/core/src/parser/symbol-index.ts`
- `packages/core/src/parser/dependency-index.ts`
- `packages/core/src/parser/knowledge-graph.ts`

**Capabilities:**
- TypeScript/JavaScript parsing
- Python parsing
- Symbol extraction (functions, classes, interfaces, enums)
- Import/export tracking
- Dependency graph construction
- Change-only re-indexing

---

### 1.3 Knowledge Graph

**Description:** Graph-based representation of codebase structure and dependencies.

**Category:** Code Analysis

**Key Structure:**
```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

**Capabilities:**
- Node and edge representation
- Relationship types (imports, exports, calls, extends)
- Graph traversal
- Dependency visualization

---

### 1.4 Project Initialization

**Description:** Project setup and configuration.

**Category:** Setup

**Key Files:**
- `packages/core/src/init/init-project.ts`
- `packages/core/src/init/detect-project.ts`
- `packages/core/src/init/create-files.ts`

**Capabilities:**
- Creates configuration files
- Detects existing setup
- Generates project files (CLAUDE.md, AGENTS.md, kontextmind.json)

---

## 2. AI & Learning

### 2.1 Summarization Engine

**Description:** AI-powered generation of file, function, module, API, and decision summaries.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/summaries/summarizer.ts`
- `packages/core/src/summaries/summary-storage.ts`
- `packages/core/src/summaries/summary-types.ts`

**Capabilities:**
- File-level summaries
- Function/method summaries
- Module/package summaries
- API endpoint summaries
- Architectural decision summaries
- Blocker summaries
- Staleness tracking and refresh
- Change-only summarization

---

### 2.2 Chatbot / Q&A System

**Description:** Knowledge-base powered chatbot for answering project questions.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/chatbot/kb-builder.ts`
- `packages/core/src/chatbot/semantic-search.ts`
- `packages/core/src/chatbot/intent-classifier.ts`
- `packages/core/src/chatbot/context-builder.ts`
- `packages/core/src/chatbot/session-manager.ts`
- `packages/core/src/chatbot/analytics.ts`

**Capabilities:**
- Intent classification (overview, architecture, implementation, debugging)
- Semantic search across summaries
- Hierarchical context building
- Multi-turn conversation support
- Feedback tracking
- Security policy enforcement
- Quality metrics and analytics
- Pre-computed answers cache

---

### 2.3 Brain-Ask (Learning-Based Answers)

**Description:** Answers questions using learned knowledge with agentic fallback.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/brain-ask/brain-ask.ts`

**Capabilities:**
- Memory-based answers
- Mental model queries
- Q&A history search
- Agentic code reading (fallback)
- Smart chunk reading (5000 chars)
- Dynamic file suggestion
- Auto-generate summaries for read files
- Confidence scoring

---

### 2.4 Learning Bridge

**Description:** Automatic learning from summaries and Q&A history.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/learning/learning-bridge.ts`
- `packages/core/src/learning/outcome-tracker.ts`

**Capabilities:**
- Summary-based learning
- Q&A history learning
- Cross-project import
- 4 sync types: startup, periodic, on-demand, event-based
- Outcome tracking
- Pattern detection

---

### 2.5 Intent Predictor

**Description:** Predicts next actions based on context patterns.

**Category:** Prediction

**Key Files:**
- `packages/core/src/prediction/intent-predictor.ts`

**Capabilities:**
- Action prediction
- Pattern learning
- Outcome tracking

---

## 3. Memory & Sessions

### 3.1 Semantic Memory

**Description:** Cross-session memory storage with importance and access tracking.

**Category:** Memory

**Key Files:**
- `packages/core/src/memory/semantic/semantic-memory.ts`
- `packages/core/src/memory/cross-session-sync.ts`

**Capabilities:**
- Memory storage with importance scores
- Access tracking and counting
- Source tracking (code_analysis, decision, conversation)
- Tag-based organization
- Time-based retrieval

---

### 3.2 Session Index / Tracking

**Description:** Tracks work sessions with metadata, topics, and files touched.

**Category:** Session Management

**Key Files:**
- `packages/core/src/memory/session-index.ts`

**Capabilities:**
- Session creation and tracking
- Topic extraction
- File touched tracking
- Activity monitoring
- Session statistics

---

### 3.3 Task Index / Tracking

**Description:** Task management across sessions with dependencies and blockers.

**Category:** Task Management

**Key Files:**
- `packages/core/src/memory/task-index.ts`
- `packages/core/src/memory/task-detector.ts`

**Capabilities:**
- Task creation and tracking
- Status management (in_progress, completed, blocked, pending)
- Dependency tracking
- Blocker identification
- Current task detection
- Task boundary detection

---

### 3.4 Mental Model

**Description:** Structured understanding of codebase architecture and entities.

**Category:** Memory

**Key Files:**
- `packages/core/src/mental-model/project-mental-model.ts`

**Capabilities:**
- Entity tracking (file, function, class, module)
- Relationship mapping
- Architecture understanding
- Query and traversal

---

### 3.5 Continuity Engine

**Description:** Provides suggestions for continuing work from previous sessions.

**Category:** Memory

**Key Files:**
- `packages/core/src/memory/continuity-engine.ts`

**Capabilities:**
- Pending work detection
- Stale summary identification
- Blocked task suggestions
- Task resumption context
- Session resumption context
- Continuity analysis

---

### 3.6 Timeline Builder

**Description:** Builds activity timelines from sessions and tasks.

**Category:** Visualization

**Key Files:**
- `packages/core/src/memory/timeline-builder.ts`

**Capabilities:**
- Activity aggregation
- Timeline visualization
- Recent activity queries

---

### 3.7 Search Index

**Description:** Full-text search across all indexed content.

**Category:** Search

**Key Files:**
- `packages/core/src/memory/search-index.ts`

**Capabilities:**
- Memory search
- Entity search
- Related session finding

---

## 4. Quality & Security

### 4.1 Codebase Health Monitor

**Description:** Monitors code quality metrics and health indicators.

**Category:** Quality

**Key Files:**
- `packages/core/src/health/codebase-health-monitor.ts`

**Metrics:**
- Complexity analysis
- File size checks
- Documentation coverage
- Circular dependency detection

---

### 4.2 Security Audit

**Description:** Scans for security vulnerabilities and secrets.

**Category:** Security

**Key Files:**
- `packages/core/src/security/audit.ts`
- `packages/core/src/security/secret-scanner.ts`
- `packages/core/src/security/redact.ts`
- `packages/core/src/security/prompt-injection.ts`

**Capabilities:**
- Secret detection (API keys, tokens, passwords)
- Vulnerability pattern matching
- Prompt injection detection
- Security report generation
- Cost tracking

---

### 4.3 Policy Engine

**Description:** Enforces security and behavior policies.

**Category:** Security

**Key Files:**
- `packages/core/src/policy/policy-enforcer.ts`

**Capabilities:**
- Code protection rules
- Path protection rules
- Strict mode enforcement

---

### 4.4 Quality Metrics

**Description:** Answer quality tracking and analytics.

**Category:** Quality

**Key Files:**
- `packages/core/src/chatbot/quality-metrics.ts`

**Capabilities:**
- Quality metrics calculation
- Trend analysis
- Performance statistics
- Quality reports

---

## 5. Integration

### 5.1 MCP Server

**Description:** Model Context Protocol compatible server providing tools, resources, and prompts.

**Category:** Integration

**Key Files:**
- `packages/mcp/src/mcp-server.ts`

**Modes:**
- `readonly` - Read-only access (default)
- `chatbot-readonly` - Chatbot Q&A mode
- `suggest` - Suggestions enabled
- `edit-with-approval` - Write with approval
- `full-agent` - Full agent capabilities

**Total Tools:** 70+
**Total Resources:** 15
**Total Prompts:** 10

---

### 5.2 AI Provider Adapters

**Description:** Abstraction layer for multiple AI providers.

**Category:** Integration

**Key Files:**
- `packages/adapters/src/claude.ts`
- `packages/adapters/src/openai.ts`
- `packages/adapters/src/ollama.ts`
- `packages/adapters/src/gemini.ts`
- `packages/adapters/src/groq.ts`
- `packages/adapters/src/deepseek.ts`
- `packages/adapters/src/qwen.ts`

**Supported Providers:**
- Anthropic (Claude)
- OpenAI
- Ollama (local)
- Google (Gemini)
- Groq
- DeepSeek
- Qwen

---

### 5.3 API Server

**Description:** HTTP API server for external integration.

**Category:** Integration

**Key Files:**
- `packages/server/src/api-server.ts`

**Capabilities:**
- REST API endpoints
- SSE streaming
- API key authentication
- CORS support
- Multi-tenant support

**Total Endpoints:** 70+

---

## 6. Export & Data

### 6.1 Dataset Preparation

**Description:** Prepares training data from Q&A interactions and code summaries.

**Category:** Data

**Key Files:**
- `packages/core/src/dataset/collector.ts` - Q&A data collection
- `packages/core/src/dataset/summary-dataset.ts` - Summary-based training data
- `packages/core/src/dataset/quality-filter.ts` - Quality filtering
- `packages/core/src/dataset/versioning.ts` - Dataset versioning
- `packages/core/src/dataset/formats/chatml.ts`
- `packages/core/src/dataset/formats/sharegpt.ts`
- `packages/core/src/dataset/formats/jsonl.ts`

**Data Sources:**
- Q&A History (`qa-history.jsonl`)
- Session Data (`session-index.json`)
- Task Data (`task-index.json`)
- Code Summaries (`.summaries/*`)

**Export Formats:**
- ChatML
- ShareGPT
- JSONL
- JSON

**CLI Commands:**
```bash
# Export Q&A training data
kontextmind dataset export --format sharegpt

# Export summaries as training data
kontextmind dataset export-summaries --types file,function --format jsonl

# Get summary dataset stats
kontextmind dataset stats-summaries
```

**Summary Dataset Types:**
| Type | Description |
|------|-------------|
| `file` | File purpose and key exports |
| `function` | Function documentation with parameters |
| `module` | Directory/module summaries |
| `api` | API endpoint documentation |
| `decision` | Architectural decisions |

---

### 6.2 Obsidian Export

**Description:** Exports knowledge to Obsidian-compatible markdown.

**Category:** Export

**Key Files:**
- `packages/core/src/obsidian/export-notes.ts`

**Capabilities:**
- Graph to markdown conversion
- Bidirectional linking
- Vault structure generation

---

### 6.3 Personalization Engine

**Description:** Adapts to user/agent preferences and patterns.

**Category:** Personalization

**Key Files:**
- `packages/core/src/personalization/personalization-engine.ts`

**Capabilities:**
- Preference tracking
- Style adaptation
- Usage pattern analysis

---

## 7. Advanced Features

### 7.1 Self-Awareness / Agent State

**Description:** Agent understands its own capabilities and tracks actions.

**Category:** Awareness

**Key Files:**
- `packages/core/src/awareness/self-awareness.ts`

**Capabilities:**
- Capability profiling
- Success rate tracking
- Action history
- Anti-pattern detection
- Performance metrics

---

### 7.2 Dynamic Context Engine

**Description:** Smart context window management with priority scoring.

**Category:** Context Management

**Key Files:**
- `packages/core/src/context/dynamic-context.ts`

**Capabilities:**
- Priority-based element management
- Token budget calculation
- Context window maintenance
- Relevance scoring
- Freshness tracking

---

### 7.3 Conversation Compressor

**Description:** Compresses conversations preserving key decisions.

**Category:** Compression

**Key Files:**
- `packages/core/src/compression/conversation-compressor.ts`

**KeyPoint Types:**
- decision, implementation, question, issue, concept

---

### 7.4 Multi-Agent Memory Sync

**Description:** Synchronizes memory across multiple AI agents.

**Category:** Multi-Agent

**Key Files:**
- `packages/core/src/multiagent/multi-agent-memory-sync.ts`

**Conflict Resolution:**
- latest, merge, agent_priority

---

### 7.5 Adaptive Token Budget

**Description:** Dynamic token allocation based on task requirements.

**Category:** Optimization

**Key Files:**
- `packages/core/src/budget/adaptive-token-budget.ts`

**Capabilities:**
- Task-type based allocation
- Sliding window context
- Priority-based retention

---

### 7.6 Handover / Proactive Handoff

**Description:** Context transfer between sessions/agents.

**Category:** Continuity

**Key Files:**
- `packages/core/src/handoff/proactive-handoff.ts`

**Capabilities:**
- Automatic handoff document generation
- Pending work transfer
- Decision documentation
- Next steps recommendations

---

### 7.7 Realtime Event Bus

**Description:** Event-driven architecture for real-time updates.

**Category:** Architecture

**Key Files:**
- `packages/core/src/eventbus/integration-event-bus.ts`

**Capabilities:**
- Event publishing/subscription
- Cross-component communication
- Integration event handling

---

### 7.8 Event Hooks

**Description:** Event-driven hooks for extensibility.

**Category:** Extensibility

**Key Files:**
- `packages/core/src/hooks/summary-hooks.ts`

**Capabilities:**
- Summary hooks
- Lifecycle hooks
- Custom event handlers

---

### 7.9 Skills Framework

**Description:** Skill registration and management.

**Category:** Extensibility

**Key Files:**
- `packages/core/src/skills/skill-dependency-graph.ts`

**Capabilities:**
- Skill discovery
- Skill metadata
- Capability tracking
- Dependency management

---

## 8. CLI Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `kontextmind init` | Initialize project |
| `kontextmind setup` | Interactive setup wizard |
| `kontextmind status` | Show project status |
| `kontextmind doctor` | Health check |

### Scanning & Indexing

| Command | Description |
|---------|-------------|
| `kontextmind scan` | Scan project files |
| `kontextmind index` | Index symbols & dependencies |
| `kontextmind summarize` | Generate AI summaries |

### Question Answering

| Command | Description |
|---------|-------------|
| `kontextmind ask` | Ask a question |
| `kontextmind session chat` | Chat in session |

### Server Management

| Command | Description |
|---------|-------------|
| `kontextmind serve` | Start API server (port 7331) |
| `kontextmind mcp` | Start MCP server |
| `kontextmind daemon` | Start background daemon |

### Session Management

| Command | Description |
|---------|-------------|
| `kontextmind session create` | Create session |
| `kontextmind session list` | List sessions |
| `kontextmind session show` | Show session |
| `kontextmind session delete` | Delete session |
| `kontextmind session stats` | Session statistics |

### Configuration

| Command | Description |
|---------|-------------|
| `kontextmind config` | Manage configuration |
| `kontextmind kb build` | Build knowledge base |

### Security & Data

| Command | Description |
|---------|-------------|
| `kontextmind secrets` | Scan for secrets |
| `kontextmind audit` | Audit summary |
| `kontextmind dataset export` | Export training data |
| `kontextmind obsidian` | Export to Obsidian |

### NEW CLI Commands

| Command | Description |
|---------|-------------|
| `kontextmind agent` | Agent awareness mode |
| `kontextmind analytics` | Q&A statistics |
| `kontextmind insights` | Cross-session insights |
| `kontextmind learn sync` | Learning sync |
| `kontextmind quality` | Quality tracking |
| `kontextmind search` | Search codebase |
| `kontextmind task` | Task management |

---

## 9. Setup Guide

Complete setup pattern for new projects to maximize KontextMind features.

### Quick-Start

```bash
kontextmind init --mode full-agent --yes && kontextmind scan && kontextmind index && kontextmind summarize && kontextmind kb build && kontextmind learn sync
```

### Phase 1: Initialization & Core Indexing

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `kontextmind init --mode full-agent --yes` | Initialize with full agent capabilities |
| 2 | `kontextmind scan` | Scan all project files |
| 3 | `kontextmind index` | Index symbols and dependencies |
| 4 | `kontextmind summarize` | Generate AI summaries |
| 5 | `kontextmind kb build` | Build knowledge base |

### Phase 2: Learning & Analytics

| Step | Command | Purpose |
|------|---------|---------|
| 6 | `kontextmind learn sync` | Sync summaries/Q&A to semantic memory |
| 7 | `kontextmind analytics stats` | Verify Q&A tracking |
| 8 | `kontextmind learn stats` | View learning outcomes |

### Phase 3: Dataset Generation

| Step | Command | Purpose |
|------|---------|---------|
| 9 | `kontextmind dataset export` | Export Q&A training data |
| 10 | `kontextmind dataset export-summaries` | Export code summaries as training data |
| 11 | `kontextmind dataset stats` | View dataset statistics |

### Phase 4: Continuous Usage

```bash
# Ask questions (builds Q&A dataset)
kontextmind ask "what does this project do?"

# After changes - refresh data
kontextmind scan --changed-only
kontextmind summarize --changed-only
kontextmind kb build
kontextmind learn sync

# Monitor quality
kontextmind quality report
kontextmind insights --days 7
```

### Phase 5: Session & Task Management

| Command | Purpose |
|---------|---------|
| `kontextmind session create` | Create work session |
| `kontextmind task list` | List active tasks |
| `kontextmind insights` | Cross-session insights |
| `kontextmind handoff` | Create context handoff |

### Phase 6: Optional Enhancements

| Command | Purpose |
|---------|---------|
| `kontextmind secrets` | Security scan |
| `kontextmind obsidian` | Export to Obsidian vault |
| `kontextmind learn import /path/to/project` | Import learning from another project |
| `kontextmind learn export` | Export patterns for training |

### Command Dependencies

```
init → scan → index → summarize → kb build → learn sync
                                           ↓
                    ┌─────────────────────┼─────────────────────┐
                    ↓                     ↓                     ↓
              analytics stats      dataset export       dataset export-summaries
```

### MCP Server Setup

```bash
# Add to Claude Code globally
claude mcp add -s user kontextmind -- kontextmind mcp --mode full-agent

# Start MCP server manually
kontextmind mcp --mode full-agent --transport sse --port 7330
```

---

## 10. MCP Tools

### Categories

| Category | Count | Description |
|---------|-------|-------------|
| Status & Search | 6 | Project status, search, provider check |
| Summary Retrieval | 8 | File, function, module, API, decision summaries |
| Dependency Analysis | 5 | Dependencies, callers, related files |
| Q&A | 2 | Ask questions, ask statistics |
| Write Operations | 3 | Handoff, task summary, session summary |
| Refresh & Scan | 3 | Refresh summaries, security scan |
| Session Management | 4 | Session index, stats, search |
| Timeline | 2 | Activity timeline, recent activity |
| Task Management | 8 | Current task, dependencies, blocked tasks |
| Memory Search | 3 | Search memory, entities, sessions |
| Continuity | 4 | Continuity suggestions, resumption context |
| Learning | 6 | Sync, import, stats, patterns, suggestions |
| Agent Awareness | 4 | State, capabilities, antipatterns, assess |
| Analytics | 3 | Ask stats, top questions, quality |
| Quality | 3 | Trends, report, performance |
| Context & Insights | 3 | Context stats, export, session insights |

**Total: 70+ tools**

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total Feature Areas | 33 |
| CLI Commands | 30+ |
| MCP Tools | 70+ |
| MCP Resources | 15 |
| MCP Prompts | 10 |
| API Server Endpoints | 70+ |
| Supported Languages | TypeScript, JavaScript, Python |
| AI Providers | 7 |

---

## Feature Matrix

| Feature | CLI | MCP | API Server | Status |
|---------|-----|-----|------------|--------|
| Scanner/Indexing | ✅ | ❌ | ❌ | Ready |
| Summarization | ✅ | ✅ | ❌ | Ready |
| Chatbot/Q&A | ✅ | ✅ | ✅ | Ready |
| Sessions | ✅ | ✅ | ✅ | Ready |
| Tasks | ✅ | ✅ | ✅ | Ready |
| Learning | ✅ | ✅ | ✅ | Ready |
| Agent Awareness | ✅ | ✅ | ❌ | Ready |
| Quality Tracking | ✅ | ✅ | ✅ | Ready |
| Analytics | ✅ | ✅ | ✅ | Ready |
| Webhooks | ❌ | ❌ | ✅ | Ready |
| Multi-Tenant | ❌ | ❌ | ✅ | Ready |
| SSE Streaming | ❌ | ❌ | ✅ | Ready |
| Rate Limiting | ❌ | ❌ | ❌ | **Removed** |

---

*Document Version: 2.0*
*Generated: 2026-05-16*
*Total Features: 33*
*Total MCP Tools: 70+*
*Total CLI Commands: 30+*