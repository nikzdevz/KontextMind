# KontextMind Documentation

## Table of Contents
1. [Features](#features)
2. [CLI Commands](#cli-commands)
3. [MCP Tools](#mcp-tools)

---

## Features

### 1. Scanner / File Indexing

**Description:** Scans project files and generates a file index with hashes for change detection.

**Category:** Core Infrastructure

**Key Files:**
- `packages/core/src/scanner/scan-project.ts`
- `packages/core/src/scanner/file-index.ts`
- `packages/core/src/scanner/walk-files.ts`
- `packages/core/src/scanner/hash-file.ts`
- `packages/core/src/scanner/ignore-rules.ts`

**Key Functions:**
- `scanProject()` - Main scanning function
- `walkFiles()` - Recursive directory traversal with ignore rules
- `hashFile()` - SHA-256 hashing for change detection
- `loadFileIndex()` / `saveFileIndex()` - Persistence

**Capabilities:**
- Recursive file traversal
- Configurable ignore patterns (`.gitignore`, `.toolignore`)
- File hashing for change detection
- Language detection
- Max file size filtering
- Secret-sensitive file detection

---

### 2. Code Parser / Indexer

**Description:** Parses code files to extract symbols (functions, classes, interfaces), imports, and exports.

**Category:** Code Analysis

**Key Files:**
- `packages/core/src/parser/indexer.ts`
- `packages/core/src/parser/typescript-parser.ts`
- `packages/core/src/parser/python-parser.ts`
- `packages/core/src/parser/symbol-index.ts`
- `packages/core/src/parser/dependency-index.ts`
- `packages/core/src/parser/knowledge-graph.ts`

**Key Functions:**
- `indexProject()` - Orchestrates parsing of all files
- `TypeScriptParser.parse()` - Parse TypeScript/JavaScript
- `PythonParser.parse()` - Parse Python
- `createSymbolIndex()` - Create symbol tracking index
- `createDependencyIndex()` - Create import tracking index
- `buildGraphFromParsedFiles()` - Build knowledge graph

**Capabilities:**
- TypeScript/JavaScript parsing
- Python parsing
- Symbol extraction (functions, classes, interfaces, enums)
- Import/export tracking
- Dependency graph construction
- Change-only re-indexing

---

### 3. Knowledge Graph

**Description:** Graph-based representation of codebase structure, dependencies, and relationships.

**Category:** Code Analysis

**Key Files:**
- `packages/core/src/parser/knowledge-graph.ts`

**Key Structures:**
```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;
  type: 'file' | 'symbol' | 'dependency' | 'api-route';
  label: string;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: 'imports' | 'exports' | 'calls' | 'extends' | 'implements';
}
```

**Capabilities:**
- Node and edge representation
- Relationship types (imports, exports, calls, extends)
- Graph traversal
- Dependency visualization

---

### 4. Summarization Engine

**Description:** AI-powered generation of file, function, module, API, and decision summaries.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/summaries/summarizer.ts`
- `packages/core/src/summaries/summary-storage.ts`
- `packages/core/src/summaries/summary-types.ts`

**Key Functions:**
- `generateSummaries()` - Generate all summaries
- `generateFileSummary()` - Individual file summarization
- `loadFileSummary()` - Load file summary from storage
- `loadFunctionSummary()` - Load function summary
- `loadModuleSummary()` - Load module summary
- `isStale()` - Check if summary needs refresh

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

### 5. Chatbot / Q&A System

**Description:** Knowledge-base powered chatbot for answering project questions with context-aware responses.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/chatbot/kb-builder.ts`
- `packages/core/src/chatbot/semantic-search.ts`
- `packages/core/src/chatbot/intent-classifier.ts`
- `packages/core/src/chatbot/context-builder.ts`
- `packages/core/src/chatbot/qa-history.ts`
- `packages/core/src/chatbot/analytics.ts`

**Key Functions:**
- `buildChatbotKB()` - Generate KB files
- `askQuestion()` - Production Q&A pipeline
- `classifyQuestion()` - Intent detection
- `semanticSearch()` - Search using AI-generated summaries
- `buildContext()` - Build hierarchical context

**Capabilities:**
- Intent classification (overview, architecture, implementation, debugging, etc.)
- Semantic search across summaries
- Hierarchical context building
- Multi-turn conversation support
- Feedback tracking (like/dislike)
- Security policy enforcement (no-code mode)
- Quality metrics and analytics
- Pre-computed answers cache
- Session management

---

### 6. Brain-Ask (Learning-Based Answers)

**Description:** Answers questions using learned knowledge, with agentic code reading fallback.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/brain-ask/brain-ask.ts`

**Key Classes:**
- `BrainAsk` - Main answer engine

**Key Methods:**
- `answer()` - Main answer function with fallback
- `searchMemories()` - Query semantic memory
- `searchEntities()` - Query mental model
- `searchQnA()` - Search Q&A history
- `fallbackToCode()` - Agentic file reading when no learned knowledge
- `agenticReadFiles()` - Iterative file reading with LLM suggestions

**Capabilities:**
- Memory-based answers
- Mental model queries
- Q&A history search
- Agentic code reading (fallback)
- Smart chunk reading (5000 chars with brace-aware truncation)
- Dynamic file suggestion (LLM can request more files)
- Auto-generate summaries for read files
- Confidence scoring

**Smart Chunk Reading:**
- Default chunk size: 5000 characters
- Brace-aware truncation (extends to closing brace)
- Statement boundary fallback
- Max context: 25000 characters
- Max files per question: 12

---

### 7. Semantic Memory

**Description:** Cross-session memory storage with importance and access tracking.

**Category:** Memory

**Key Files:**
- `packages/core/src/memory/semantic/semantic-memory.ts`

**Key Functions:**
- `SemanticMemory.store()` - Store new memories
- `SemanticMemory.recall()` - Retrieve relevant memories
- `SemanticMemory.update()` - Modify existing memories
- `SemanticMemory.search()` - Full-text search

**Capabilities:**
- Memory storage with importance scores
- Access tracking and counting
- Source tracking (code_analysis, decision, conversation, etc.)
- Tag-based organization
- Time-based retrieval
- Importance filtering

---

### 8. Session Index / Tracking

**Description:** Tracks work sessions with metadata, topics, and files touched.

**Category:** Session Management

**Key Files:**
- `packages/core/src/memory/session-index.ts`

**Key Functions:**
- `loadSessionIndex()` / `saveSessionIndex()` - Persistence
- `getRecentSessions()` - Get last N sessions
- `searchSessions()` - Full-text search
- `getSessionsByTopic()` - Topic filtering
- `getSessionsByFile()` - File-based filtering
- `getSessionStats()` - Session statistics

**Capabilities:**
- Session creation and tracking
- Topic extraction
- File touched tracking
- Activity monitoring
- Session statistics

---

### 9. Task Index / Tracking

**Description:** Task management across sessions with dependencies, status, and blockers.

**Category:** Task Management

**Key Files:**
- `packages/core/src/memory/task-index.ts`

**Key Functions:**
- `loadTaskIndex()` / `saveTaskIndex()` - Persistence
- `getCurrentTask()` - Active task detection
- `getIncompleteTasks()` - Pending work
- `getBlockedTasks()` - Blocked tasks
- `getTaskDependencies()` - Dependency graph
- `addTaskDependency()` - Add dependency

**Capabilities:**
- Task creation and tracking
- Status management (in_progress, completed, blocked, pending)
- Dependency tracking
- Blocker identification
- Current task detection

---

### 10. Continuity Engine

**Description:** Provides suggestions for continuing work from previous sessions.

**Category:** Memory

**Key Files:**
- `packages/core/src/memory/continuity-engine.ts`

**Key Functions:**
- `getContinuitySuggestions()` - Returns pending work, stale summaries, blocked tasks
- `analyzeContinuityNeed()` - Determines if resuming needed
- `getTaskResumptionContext()` - Context for resuming tasks
- `getSessionResumptionContext()` - Context for resuming sessions
- `shouldContinueFromLastSession()` - Check if there's work to continue

**Capabilities:**
- Pending work detection
- Stale summary identification
- Blocked task suggestions
- Task resumption context
- Session resumption context
- Continuity analysis

---

### 11. Self-Awareness / Agent State

**Description:** Agent understands its own capabilities, tracks actions and success rates.

**Category:** Awareness

**Key Files:**
- `packages/core/src/awareness/self-awareness.ts`

**Key Classes:**
- `SelfAwareness` - Agent self-understanding system
- `AgentState` - Current task, goals, blockers, energy level
- `CapabilityProfile` - Strengths, weaknesses, success rates
- `ActionRecord` - Action tracking with outcomes
- `AntiPattern` - Pattern detection for error avoidance

**Capabilities:**
- Capability profiling
- Success rate tracking
- Action history
- Anti-pattern detection
- Performance metrics

---

### 12. Dynamic Context Engine

**Description:** Smart context window management with priority scoring.

**Category:** Context Management

**Key Files:**
- `packages/core/src/context/dynamic-context.ts`

**Key Classes:**
- `DynamicContextEngine` - Priority-based context management

**Key Methods:**
- `add()` / `addBatch()` - Element management
- `maintainWindow()` - Size constraint enforcement
- `calculateBudget()` - Token allocation by task type

**Capabilities:**
- Priority-based element management
- Token budget calculation
- Context window maintenance
- Relevance scoring
- Freshness tracking

---

### 13. Learning Bridge

**Description:** Automatic learning from summaries and Q&A history.

**Category:** AI/Learning

**Key Files:**
- `packages/core/src/learning/learning-bridge.ts`

**Key Classes:**
- `LearningBridge` - Sync engine for learning

**Key Methods:**
- `syncNow()` - Performs sync from summaries/Q&A
- `importFrom()` - Imports from other projects
- `syncFromSummaries()` - Learn from file/decisions summaries
- `syncFromQnA()` - Learn from Q&A events

**Capabilities:**
- Summary-based learning
- Q&A history learning
- Cross-project import
- 4 sync types: startup, periodic, on-demand, event-based
- Automatic knowledge extraction

---

### 14. Mental Model

**Description:** Structured understanding of codebase architecture and entities.

**Category:** Memory

**Key Files:**
- `packages/core/src/mental-model/project-mental-model.ts`

**Key Classes:**
- `ProjectMentalModel` - Entity and relationship tracking

**Key Methods:**
- `addEntity()` - Add entity to model
- `query()` - Query entities
- `findRelated()` - Relationship traversal
- `getArchitecture()` - Get architectural overview

**Capabilities:**
- Entity tracking (file, function, class, module, etc.)
- Relationship mapping
- Architecture understanding
- Query and traversal

---

### 15. Codebase Health Monitor

**Description:** Monitors code quality metrics and health indicators.

**Category:** Quality

**Key Files:**
- `packages/core/src/health/codebase-health-monitor.ts`

**Key Functions:**
- `CodebaseHealthMonitor.scan()` - Run health checks
- `getCurrentHealth()` - Returns overall score/status
- `compareReports()` - Track health over time

**Metrics:**
- Complexity analysis
- File size checks
- Documentation coverage
- Circular dependency detection

---

### 16. Intent Predictor

**Description:** Predicts next actions/intents based on context patterns.

**Category:** Prediction

**Key Files:**
- `packages/core/src/prediction/intent-predictor.ts`

**Key Functions:**
- `IntentPredictor.predict()` - Generate predictions
- `preload()` - Pre-load resources for predicted intents
- `recordOutcome()` - Learning from prediction accuracy

**Capabilities:**
- Action prediction
- Pattern learning
- Outcome tracking

---

### 17. Conversation Compressor

**Description:** Compresses conversations preserving key decisions and points.

**Category:** Compression

**Key Files:**
- `packages/core/src/compression/conversation-compressor.ts`

**Key Functions:**
- `extractKeyPoints()` - Extract important items
- `summarize()` - Generate conversation summary

**KeyPoint Types:**
- decision
- implementation
- question
- issue
- concept

---

### 18. Multi-Agent Memory Sync

**Description:** Synchronizes memory across multiple AI agents.

**Category:** Multi-Agent

**Key Files:**
- `packages/core/src/multiagent/multi-agent-memory-sync.ts`

**Key Functions:**
- `registerAgent()` - Agent registration
- `recordUpdate()` / `syncFromAgent()` - Memory synchronization
- `resolveConflict()` - Conflict resolution

**Conflict Resolution Strategies:**
- latest
- merge
- agent_priority

---

### 19. MCP Server (Model Context Protocol)

**Description:** MCP-compatible server providing tools, resources, and prompts to AI clients.

**Category:** Integration

**Key Files:**
- `packages/mcp/src/mcp-server.ts`

**Modes:**
- `readonly` - Read-only access (default)
- `chatbot-readonly` - Chatbot Q&A mode
- `suggest` - Suggestions enabled
- `edit-with-approval` - Write operations with approval
- `full-agent` - Full agent capabilities

**Capabilities (see MCP Tools section):**
- 44 tools for project interaction
- 15 resources for data access
- 10 prompts for common tasks

---

### 20. Handover / Proactive Handoff

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

### 21. Dataset Preparation

**Description:** Prepares training data from Q&A interactions.

**Category:** Data

**Key Files:**
- `packages/core/src/dataset/collector.ts`
- `packages/core/src/dataset/quality-filter.ts`
- `packages/core/src/dataset/versioning.ts`
- `packages/core/src/dataset/formats/chatml.ts`
- `packages/core/src/dataset/formats/sharegpt.ts`
- `packages/core/src/dataset/formats/jsonl.ts`

**Export Formats:**
- ChatML
- ShareGPT
- JSONL
- JSON

**Capabilities:**
- Q&A event collection
- Quality filtering
- Dataset versioning
- Format conversion
- Minimum confidence threshold

---

### 22. Personalization Engine

**Description:** Adapts to user/agent preferences and patterns.

**Category:** Personalization

**Key Files:**
- `packages/core/src/personalization/personalization-engine.ts`

**Capabilities:**
- Preference tracking
- Style adaptation
- Usage pattern analysis

---

### 23. Adaptive Token Budget

**Description:** Dynamic token allocation based on task requirements.

**Category:** Optimization

**Key Files:**
- `packages/core/src/budget/adaptive-token-budget.ts`

**Capabilities:**
- Task-type based allocation
- Sliding window context
- Priority-based retention

---

### 24. Security Audit

**Description:** Scans for security vulnerabilities and secrets in codebase.

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

### 25. Obsidian Export

**Description:** Exports knowledge to Obsidian-compatible markdown.

**Category:** Export

**Key Files:**
- `packages/core/src/obsidian/export-notes.ts`

**Capabilities:**
- Graph to markdown conversion
- Bidirectional linking
- Vault structure generation

---

### 26. Realtime Event Bus

**Description:** Event-driven architecture for real-time updates.

**Category:** Architecture

**Key Files:**
- `packages/core/src/eventbus/integration-event-bus.ts`

**Capabilities:**
- Event publishing/subscription
- Cross-component communication
- Integration event handling

---

### 27. Project Initialization

**Description:** Project setup and configuration.

**Category:** Setup

**Key Files:**
- `packages/core/src/init/init-project.ts`
- `packages/core/src/init/detect-project.ts`
- `packages/core/src/init/create-files.ts`

**Capabilities:**
- `initProject()` - Creates configuration files
- `detectProject()` - Detects existing setup
- `createFiles()` - Generates project files

**Generated Files:**
- `CLAUDE.md` - Agent instructions
- `AGENTS.md` - Multi-agent configuration
- `kontextmind.json` - Project config

---

### 28. AI Provider Adapters

**Description:** Abstraction layer for multiple AI providers.

**Category:** Integration

**Key Files:**
- `packages/adapters/src/claude.ts`
- `packages/adapters/src/openai.ts`
- `packages/adapters/src/cursor.ts`
- `packages/adapters/src/continue.ts`
- `packages/adapters/src/copilot.ts`
- `packages/adapters/src/codex.ts`
- `packages/adapters/src/generic.ts`

**Supported Providers:**
- Claude (Anthropic)
- OpenAI
- GitHub Copilot
- Cursor
- Continue
- Codex
- Generic OpenAI-compatible

---

### 29. Timeline Builder

**Description:** Builds activity timelines from sessions and tasks.

**Category:** Visualization

**Key Files:**
- `packages/core/src/memory/timeline-builder.ts`

**Capabilities:**
- Activity aggregation
- Timeline visualization
- Recent activity queries

---

### 30. Policy Engine

**Description:** Enforces security and behavior policies.

**Category:** Security

**Key Files:**
- `packages/core/src/policy/policy-enforcer.ts`

**Capabilities:**
- Code protection rules
- Path protection rules
- Strict mode enforcement

---

### 31. Search Index

**Description:** Full-text search across all indexed content.

**Category:** Search

**Key Files:**
- `packages/core/src/memory/search-index.ts`

**Capabilities:**
- Memory search
- Entity search
- Related session finding

---

### 32. Event Hooks

**Description:** Event-driven hooks for extensibility.

**Category:** Extensibility

**Key Files:**
- `packages/core/src/hooks/summary-hooks.ts`

**Capabilities:**
- Summary hooks
- Lifecycle hooks
- Custom event handlers

---

### 33. Skills Framework

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

## CLI Commands

### Core Commands

#### init
Initialize KontextMind in the current project.

```bash
kontextmind init [options]
```

**Options:**
- `-y, --yes` - Skip prompts and use defaults
- `-f, --force` - Overwrite existing KontextMind-generated files
- `-r, --reset` - Delete existing KontextMind data and reinitialize
- `--agents <list>` - Comma-separated agent list (claude,codex,roo,cursor,antigravity,continue,copilot,generic)
- `--mode <mode>` - Mode: readonly, suggest, edit-with-approval, full-agent
- `--git <mode>` - Git integration: auto, enabled, disabled
- `--provider <provider>` - LLM provider: none, openai, anthropic, ollama, bedrock, openai-compatible

**Example:**
```bash
kontextmind init --mode full-agent --yes
```

---

#### setup
Interactive setup wizard for KontextMind.

```bash
kontextmind setup [options]
```

**Options:**
- `--provider <provider>` - LLM provider (openai/anthropic/openrouter/custom/opusmax/ollama)
- `--api-key <key>` - API key for the provider
- `--mode <mode>` - KontextMind mode (readonly/chatbot-readonly/suggest/edit-with-approval/full-agent)
- `--auto-sync` / `--no-auto-sync` - Enable/disable automatic sync (default: true)
- `--configure-mcp` / `--no-configure-mcp` - Configure MCP server (default: true)
- `--run-scan` / `--no-run-scan` - Run initial scan (default: true)
- `--skip-summarize` - Skip summary generation

**Example:**
```bash
kontextmind setup --provider anthropic --api-key sk-ant-xxx --mode full-agent
```

---

#### status
Show KontextMind status for the current project.

```bash
kontextmind status [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
kontextmind status
kontextmind status --json
```

---

#### doctor
Check KontextMind health and configuration.

```bash
kontextmind doctor [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
kontextmind doctor
```

---

### Scanning & Indexing

#### scan
Scan project files and build file index.

```bash
kontextmind scan [options]
```

**Options:**
- `--changed-only` - Only reindex changed files
- `--include <path>` - Include specific path
- `--exclude <path>` - Exclude specific path
- `--max-size <size>` - Max file size (e.g., 2m, 100k, 5000b)
- `--json` - Output as JSON

**Example:**
```bash
kontextmind scan
kontextmind scan --changed-only
kontextmind scan --max-size 2m
```

---

#### index
Index project: extract symbols, dependencies, and build knowledge graph.

```bash
kontextmind index [options]
```

**Options:**
- `--changed-only` - Only re-index changed files since last scan
- `--language <languages>` - Comma-separated list of languages (typescript,javascript,python)
- `--json` - Output results as JSON

**Example:**
```bash
kontextmind index
kontextmind index --changed-only
kontextmind index --language typescript,python
```

---

#### summarize
Generate AI summaries for project files.

```bash
kontextmind summarize [options]
```

**Options:**
- `--changed-only` - Only summarize changed/stale files
- `--provider <provider>` - LLM provider to use
- `--model <model>` - Model to use for summarization
- `--dry-run` - Show what would be summarized without writing
- `--mock` - Use mock provider (no API key required)
- `--max-files <number>` - Maximum files to summarize per run
- `--json` - Output results as JSON

**Example:**
```bash
kontextmind summarize --changed-only
kontextmind summarize --mock --max-files 10
```

---

### Question Answering

#### ask
Ask a question about the project.

```bash
kontextmind ask "<question>" [options]
```

**Options:**
- `--mode <mode>` - Response mode: readonly, chatbot-readonly
- `--json` - Output as JSON
- `--no-code` - Filter out code from response

**Example:**
```bash
kontextmind ask "What does this project do?"
kontextmind ask "How does authentication work?" --mode chatbot-readonly
```

---

### Session Management

#### session create
Create a new chat session.

```bash
kontextmind session create [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
kontextmind session create
```

---

#### session list
List all sessions for the project.

```bash
kontextmind session list [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
kontextmind session list
```

---

#### session show
Show session details.

```bash
kontextmind session show <session-id> [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
kontextmind session show abc123
```

---

#### session delete
Delete a session.

```bash
kontextmind session delete <session-id>
```

**Example:**
```bash
kontextmind session delete abc123
```

---

#### session chat
Ask a question in a session.

```bash
kontextmind session chat <session-id> "<question>" [options]
```

**Options:**
- `--mode <mode>` - Response mode: readonly, chatbot-readonly
- `--json` - Output as JSON

**Example:**
```bash
kontextmind session chat abc123 "What files were modified?"
```

---

#### session stats
Show session statistics.

```bash
kontextmind session stats <session-id> [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
kontextmind session stats abc123
```

---

### Knowledge Base

#### kb build
Build chatbot knowledge base.

```bash
kontextmind kb build [options]
```

**Options:**
- `--mode <mode>` - Build mode: chatbot
- `--changed-only` - Only rebuild changed content
- `--mock` - Use mock provider
- `--max-questions <number>` - Maximum questions to generate
- `--json` - Output results as JSON

**Example:**
```bash
kontextmind kb build
kontextmind kb build --changed-only
```

---

### Servers

#### serve
Start HTTP API server.

```bash
kontextmind serve [options]
```

**Options:**
- `--port <port>` - Port number (default: 7331)
- `--host <host>` - Host address (default: 127.0.0.1)
- `--mode <mode>` - Server mode: readonly, chatbot-readonly, suggest, edit-with-approval, full-agent

**Example:**
```bash
kontextmind serve --port 7331 --mode full-agent
```

---

#### mcp
Start MCP server for AI agent integration.

```bash
kontextmind mcp [options]
```

**Options:**
- `--mode <mode>` - Server mode: readonly, chatbot-readonly, suggest, edit-with-approval, full-agent
- `--transport <transport>` - Transport: stdio, http (default: stdio)
- `--port <port>` - Port for HTTP transport (default: 7332)

**Example:**
```bash
kontextmind mcp --mode full-agent
kontextmind mcp --transport http --port 7332
```

---

#### daemon
Start KontextMind as a background daemon.

```bash
kontextmind daemon [options]
```

**Options:**
- `--port <port>` - MCP server port (default: 7332)
- `--api-port <port>` - API server port (default: 7331)
- `--autostart` - Register with system autostart
- `--remove-autostart` - Remove from system autostart

**Example:**
```bash
kontextmind daemon --port 7332
kontextmind daemon --autostart
```

---

### Configuration

#### config
Manage KontextMind configuration and providers.

```bash
kontextmind config [options]
```

**Options:**
- `--action <action>` - Action: show, add, remove, list, test, set-api-key
- `--name <name>` - Provider name
- `--type <type>` - Provider type (e.g., openai-compatible)
- `--baseUrl <url>` - API base URL
- `--apiKey <key>` - API key
- `--model <model>` - Model name
- `--provider <name>` - Set default provider
- `--prompt <text>` - Test prompt
- `--global` - Use global configuration

**Example:**
```bash
kontextmind config --action show
kontextmind config --action add --name anthropic --type anthropic --apiKey sk-ant-xxx
kontextmind config --action list
kontextmind config --action test --prompt "Hello"
kontextmind config --provider anthropic
```

---

### Security & Audit

#### secrets
Scan for secrets in project files.

```bash
kontextmind secrets [options]
```

**Options:**
- `--json` - Output as JSON
- `--fail-on-critical` - Exit with error code if critical secrets found

**Example:**
```bash
kontextmind secrets
kontextmind secrets --fail-on-critical
```

---

#### audit
Show audit summary and statistics.

```bash
kontextmind audit [options]
```

**Options:**
- `--since <time>` - Filter events since (e.g., 24h, 7d, 1h)
- `--json` - Output as JSON

**Example:**
```bash
kontextmind audit
kontextmind audit --since 24h
```

---

### Dataset Management

#### dataset export
Export training dataset.

```bash
kontextmind dataset export [options]
```

**Options:**
- `--format <format>` - Output format: jsonl, json, chatml, sharegpt (default: jsonl)
- `--output <path>` - Output file path
- `--min-confidence <n>` - Minimum confidence threshold (default: 0.5)
- `--include-code` - Include code request responses
- `--api-only` - Only include API-sourced data
- `--json` - Output as JSON

**Example:**
```bash
kontextmind dataset export --format jsonl --output training.jsonl
kontextmind dataset export --format chatml --min-confidence 0.7
```

---

#### dataset stats
Show dataset statistics.

```bash
kontextmind dataset stats [options]
```

**Options:**
- `--version <ver>` - Show stats for specific version
- `--json` - Output as JSON

**Example:**
```bash
kontextmind dataset stats
```

---

#### dataset validate
Validate dataset quality.

```bash
kontextmind dataset validate [options]
```

**Options:**
- `--strict` - Fail on validation errors
- `--min-quality <n>` - Minimum quality score (default: 0.6)
- `--json` - Output as JSON

**Example:**
```bash
kontextmind dataset validate
kontextmind dataset validate --strict --min-quality 0.8
```

---

#### dataset version
Manage dataset versions.

```bash
kontextmind dataset version <action> [options]
```

**Actions:** list, export

**Options:**
- `--version <ver>` - Version for export
- `--format <format>` - Export format: jsonl, json, chatml, sharegpt
- `--output <path>` - Output file path
- `--json` - Output as JSON

**Example:**
```bash
kontextmind dataset version list
kontextmind dataset version export --version v1 --output export.jsonl
```

---

### Export

#### obsidian
Export project brain to Obsidian-compatible Markdown notes.

```bash
kontextmind obsidian [options]
```

**Options:**
- `--output <path>` - Output directory (default: .obsidian-export)
- `--clean` - Remove existing export before exporting
- `--json` - Output as JSON

**Example:**
```bash
kontextmind obsidian
kontextmind obsidian --output ~/vault/knowledge --clean
```

---

### Maintenance

#### deinit
Remove KontextMind completely from the current project.

```bash
kontextmind deinit
```

**Example:**
```bash
kontextmind deinit
```

---

#### cache
Clear KontextMind cache.

```bash
kontextmind cache [options]
```

**Options:**
- `clear` - Clear cache

**Example:**
```bash
kontextmind cache clear
```

---

## MCP Tools

### Project Status & Search (6 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.status` | `kontextmind status` | Get project status |
| `project.search` | N/A | Search files, symbols, or content |
| `project.check_provider` | `kontextmind doctor` | Check if LLM provider is configured |
| `project.get_recent_tasks` | N/A | Get recent task summaries |
| `project.get_last_session` | N/A | Get previous session summary |
| `project.resume_task` | N/A | Get context to resume a task |

---

### Summary Retrieval (7 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.get_file_summary` | N/A | Get summary for a specific file |
| `project.get_function_summary` | N/A | Get summary for a function |
| `project.get_module_summary` | N/A | Get summary for a module/directory |
| `project.get_api_summary` | N/A | Get summary for an API endpoint |
| `project.get_decision_summary` | N/A | Get architectural decision summary |
| `project.get_blocker_summary` | N/A | Get blocker information |
| `project.get_symbol_summary` | N/A | Get symbol summary |

---

### Dependency & Relationship Analysis (5 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.find_dependencies` | N/A | Find files that import/depend on a file |
| `project.find_callers` | N/A | Find functions that call a given function |
| `project.find_related_files` | N/A | Find files related via imports |
| `project.find_blockers` | N/A | Find blocking/blocked symbols |
| `project.get_all_summaries` | N/A | Get all summaries with filtering |

---

### Ask & Q&A (1 tool)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.ask_readonly` | `kontextmind ask "<question>"` | Ask question in readonly mode |

---

### Write Operations (3 tools)

> **Note:** These require `edit-with-approval` or `full-agent` mode

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.create_handoff` | N/A | Create handoff document |
| `project.write_task_summary` | N/A | Write task summary |
| `project.write_session_summary` | N/A | Write session summary |

---

### Refresh & Scan (3 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.refresh_summary` | `kontextmind summarize --changed-only` | Refresh stale summaries |
| `project.refresh_all_summaries` | `kontextmind summarize` | Refresh all summaries |
| `project.security_scan` | `kontextmind secrets` | Scan for security issues |

---

### Session Index - Cross-Session Continuity (4 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.get_session_index` | `kontextmind session list` | Get all sessions with metadata |
| `project.get_session_stats` | `kontextmind session stats <id>` | Get session statistics |
| `project.search_sessions` | N/A | Search across historical sessions |
| `project.get_recent_files` | N/A | Get recently touched files |

---

### Timeline (2 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.get_timeline` | N/A | Get activity timeline |
| `project.get_recent_activity` | N/A | Get recent activity summary |

---

### Task Management (6 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.get_current_task` | N/A | Get current active task |
| `project.get_task_sessions` | N/A | Get sessions related to a task |
| `project.get_session_task` | N/A | Get task a session contributed to |
| `project.add_task_dependency` | N/A | Mark task dependency |
| `project.get_task_dependencies` | N/A | Get dependency info for task |
| `project.get_blocked_tasks` | N/A | Get blocked tasks |

---

### Memory & Cross-Session Search (3 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.search_memory` | N/A | Search sessions/tasks/handoffs |
| `project.search_entities` | N/A | Search files/functions/components |
| `project.find_related_sessions` | N/A | Find related sessions |

---

### Continuity & Resumption (4 tools)

| MCP Tool | CLI Equivalent | Description |
|----------|----------------|-------------|
| `project.get_continuity_suggestions` | N/A | Get suggestions to continue work |
| `project.analyze_continuity` | N/A | Analyze pending work |
| `project.get_task_resumption_context` | N/A | Get context for resuming task |
| `project.should_continue` | N/A | Check if there's work to continue |

---

### MCP Resources (15 total)

| URI | Name | Description |
|-----|------|-------------|
| `kontextmind://project/overview` | Project Overview | Name, mode, phase, statistics |
| `kontextmind://project/architecture` | Project Architecture | File structure, key components |
| `kontextmind://project/current-state` | Current State | Recent activity, next steps |
| `kontextmind://project/provider-status` | Provider Status | LLM provider availability |
| `kontextmind://graph/files` | File Graph | File dependency graph |
| `kontextmind://graph/symbols` | Symbol Graph | Symbol dependency graph |
| `kontextmind://graph/blockers` | Blockers Graph | Blocker/dependency graph |
| `kontextmind://handoff/latest` | Latest Handoff | Latest handoff document |
| `kontextmind://summaries/files` | File Summaries | All file summaries |
| `kontextmind://summaries/functions` | Function Summaries | All function summaries |
| `kontextmind://summaries/modules` | Module Summaries | All module summaries |
| `kontextmind://summaries/apis` | API Summaries | All API endpoint summaries |
| `kontextmind://summaries/decisions` | Decision Summaries | All architectural decisions |
| `kontextmind://summaries/blockers` | Blocker Summaries | All blocker summaries |
| `kontextmind://summaries/all` | All Summaries | Combined summaries |

---

### MCP Prompts (10 total)

| Name | Description | Arguments |
|------|-------------|-----------|
| `explain_project` | Generate project explanation | `detail_level` (brief/medium/detailed) |
| `resume_last_task` | Get context to resume last task | None |
| `review_impact` | Analyze change impact | `changed_files` (required) |
| `answer_without_code` | Answer question without code | `question` (required) |
| `find_bug_area` | Find bug location | `error` (required) |
| `summarize_module` | Summarize a module | `path` (required) |
| `prepare_handoff` | Prepare handoff document | `completed_work` (required), `pending_work` |
| `understand_architecture` | Understand project architecture | `focus_area` (optional) |
| `analyze_dependencies` | Analyze dependencies | `path` (required) |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total Feature Areas | 33 |
| Core Package Modules | 27 |
| CLI Commands | 15+ |
| MCP Tools | 44 |
| MCP Resources | 15 |
| MCP Prompts | 10 |
| Supported Languages | TypeScript, JavaScript, Python |
| AI Provider Adapters | 7+ |

---

*Documentation generated from codebase analysis*