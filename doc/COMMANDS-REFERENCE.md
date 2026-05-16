# KontextMind Commands & Tools Reference

## Table of Contents
1. [CLI Commands](#cli-commands)
2. [MCP Tools (70+)](#mcp-tools)
3. [MCP-Only Tools (No CLI)](#mcp-only-tools-no-cli)
4. [Recommended Initial Setup for New Projects](#recommended-initial-setup-for-new-projects)

---

## CLI Commands

| Command | Options | Description | MCP Equivalent |
|---------|---------|-------------|----------------|
| `kontextmind init` | `--yes`, `--force`, `--reset`, `--agents`, `--mode`, `--git`, `--provider` | Initialize project | N/A |
| `kontextmind setup` | `--provider`, `--model` | Interactive setup wizard | N/A |
| `kontextmind deinit` | - | Remove KontextMind | N/A |
| `kontextmind status` | `--json` | Show project status | `project.status` |
| `kontextmind doctor` | `--json` | Health check | `project.check_provider` |
| `kontextmind scan` | `--changed-only`, `--include`, `--exclude`, `--json`, `--max-size` | Scan files | N/A |
| `kontextmind index` | `--changed-only`, `--language`, `--json` | Index symbols/deps | N/A |
| `kontextmind summarize` | `--changed-only`, `--provider`, `--model`, `--dry-run`, `--mock`, `--max-files`, `--json` | Generate summaries | `project.refresh_all_summaries` |
| `kontextmind kb` | `build` | Build knowledge base | N/A |
| `kontextmind ask` | `--stats`, `--json`, `<question>` | Ask question | `project.ask_readonly` |
| `kontextmind serve` | `--port`, `--host` | Start HTTP API | N/A |
| `kontextmind mcp` | `--mode`, `--transport`, `--port` | Start MCP server | N/A |
| `kontextmind daemon` | `--port`, `--log` | Background daemon | N/A |
| `kontextmind secrets` | `--json`, `--include-known` | Scan for secrets | `project.security_scan` |
| `kontextmind audit` | `--since`, `--json` | Audit summary | N/A |
| `kontextmind obsidian` | `--output`, `--include` | Export to Obsidian | N/A |
| `kontextmind session create` | `--title`, `--tags` | Create session | N/A |
| `kontextmind session list` | `--json`, `--limit` | List sessions | `project.get_session_index` |
| `kontextmind session show` | `<session-id>` | Show session | `project.get_last_session` |
| `kontextmind session delete` | `<session-id>` | Delete session | N/A |
| `kontextmind session chat` | `<session-id> <question>` | Chat in session | N/A |
| `kontextmind session stats` | `<session-id>`, `--json` | Session statistics | `project.get_session_stats` |
| `kontextmind dataset` | `export`, `stats`, `validate`, `version`, `export-summaries`, `stats-summaries` | Dataset operations | N/A |
| `kontextmind handoff` | - | Create handoff | `project.create_handoff` |
| `kontextmind config` | `--action`, `--name`, `--type`, `--provider`, `--json` | Manage config | N/A |
| `kontextmind cache` | `clear`, `stats` | Cache management | N/A |

### NEW CLI Commands

| Command | Options | Description | MCP Equivalent |
|---------|---------|-------------|----------------|
| `kontextmind agent` | - | Run agent mode | `project.agent_state` |
| `kontextmind analytics` | `--period`, `--format` | Q&A statistics | `project.ask_stats` |
| `kontextmind insights` | `--days` | Cross-session insights | `project.session_insights` |
| `kontextmind learn` | `sync`, `import`, `export`, `--stats`, `--patterns` | Learning operations | `project.learn_*` |
| `kontextmind quality` | `report`, `trends`, `--days` | Quality tracking | `project.quality_*` |
| `kontextmind search` | `<query>`, `--type`, `--limit` | Search codebase | `project.search` |
| `kontextmind task` | `list`, `show`, `complete`, `--pending` | Task management | `project.task_*` |

### NEW Dataset Commands

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind dataset export-summaries` | `--format`, `--output`, `--min-confidence`, `--types` | Export code summaries as training data |
| `kontextmind dataset stats-summaries` | `--json` | Show summary dataset statistics |

### CLI ↔ MCP Mapping Summary

| CLI Command | MCP Tool(s) |
|------------|-------------|
| `kontextmind status` | `project.status` |
| `kontextmind doctor` | `project.check_provider` |
| `kontextmind summarize` | `project.refresh_summary`, `project.refresh_all_summaries` |
| `kontextmind ask` | `project.ask_readonly` |
| `kontextmind secrets` | `project.security_scan` |
| `kontextmind session list` | `project.get_session_index` |
| `kontextmind session stats` | `project.get_session_stats` |
| `kontextmind handoff` | `project.create_handoff` |
| `kontextmind analytics` | `project.ask_stats`, `project.ask_top_questions` |
| `kontextmind insights` | `project.session_insights`, `project.context_stats` |
| `kontextmind learn sync` | `project.learn_sync` |
| `kontextmind learn patterns` | `project.learn_patterns` |
| `kontextmind learn stats` | `project.learn_stats` |
| `kontextmind quality report` | `project.quality_report` |
| `kontextmind quality trends` | `project.quality_trends` |
| `kontextmind search` | `project.search` |
| `kontextmind task list` | `project.get_current_task`, `project.get_recent_tasks` |
| `kontextmind task complete` | `project.task_complete` |
| `kontextmind agent` | `project.agent_state`, `project.agent_capabilities` |

---

## MCP Tools

### Category 1: Status & Search (6 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.status` | - | - | `kontextmind status` |
| `project.search` | `query`, `type` | `query` | `kontextmind search` |
| `project.check_provider` | - | - | `kontextmind doctor` |
| `project.get_recent_tasks` | `limit` | - | - |
| `project.get_last_session` | - | - | - |
| `project.resume_task` | `taskId`, `keywords` | `taskId` OR `keywords` | - |

### Category 2: Summary Retrieval (8 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.get_file_summary` | `path` | `path` | - |
| `project.get_function_summary` | `symbolId` | `symbolId` | - |
| `project.get_module_summary` | `path` | `path` | - |
| `project.get_api_summary` | `endpoint` | `endpoint` | - |
| `project.get_decision_summary` | `decisionId` | `decisionId` | - |
| `project.get_blocker_summary` | `blockerId` | `blockerId` | - |
| `project.get_symbol_summary` | `name`, `file` | `name` | - |
| `project.get_all_summaries` | `type`, `limit` | - | - |

### Category 3: Dependency Analysis (5 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.find_dependencies` | `path` | `path` | - |
| `project.find_callers` | `name` | `name` | - |
| `project.find_related_files` | `path` | `path` | - |
| `project.find_blockers` | `symbolId` | `symbolId` | - |
| `project.find_related_sessions` | `sessionId`, `limit` | `sessionId` | - |

### Category 4: Q&A (2 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.ask_readonly` | `question`, `no_code` | `question` | `kontextmind ask` |
| `project.ask_stats` | `period` | - | `kontextmind analytics` |

### Category 5: Write Operations (3 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.create_handoff` | `summary`, `next_steps` | `summary` | `kontextmind handoff` |
| `project.write_task_summary` | `title`, `goal`, `progress`, `filesTouched`, `decisions`, `pending`, `nextSteps` | `title`, `goal` | - |
| `project.write_session_summary` | `goals`, `tasksCompleted`, `filesModified`, `decisions`, `pending`, `handoff` | - | - |

### Category 6: Refresh & Scan (3 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.refresh_summary` | `paths` | - | `kontextmind summarize` |
| `project.refresh_all_summaries` | `types` | - | `kontextmind summarize` |
| `project.security_scan` | `include_secrets` | - | `kontextmind secrets` |

### Category 7: Session Management (4 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.get_session_index` | `days`, `limit`, `topic` | - | `kontextmind session list` |
| `project.get_session_stats` | - | - | `kontextmind session stats` |
| `project.search_sessions` | `query`, `limit` | `query` | - |
| `project.get_recent_files` | `days`, `limit` | - | - |

### Category 8: Timeline (2 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.get_timeline` | `hours`, `format` | - | - |
| `project.get_recent_activity` | `days` | - | - |

### Category 9: Task Management (8 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.get_current_task` | - | - | - |
| `project.get_task_sessions` | `taskId` | `taskId` | - |
| `project.get_session_task` | `sessionId` | `sessionId` | - |
| `project.add_task_dependency` | `taskId`, `dependsOn` | both | - |
| `project.get_task_dependencies` | `taskId` | `taskId` | - |
| `project.get_blocked_tasks` | - | - | - |
| `project.task_complete` | `taskId` | `taskId` | `kontextmind task complete` |
| `project.task_update_pending` | `taskId`, `pendingWork` | both | - |

### Category 10: Memory Search (3 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.search_memory` | `query`, `types`, `days`, `limit` | `query` | - |
| `project.search_entities` | `entity`, `type` | `entity` | - |
| `project.find_related_sessions` | `sessionId`, `limit` | `sessionId` | - |

### Category 11: Continuity (4 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.get_continuity_suggestions` | - | - | - |
| `project.analyze_continuity` | - | - | - |
| `project.get_task_resumption_context` | `taskId` | `taskId` | - |
| `project.should_continue` | - | - | - |

### Category 12: Learning (6 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.learn_sync` | - | - | `kontextmind learn sync` |
| `project.learn_import` | `sourceProject`, `dataTypes` | `sourceProject` | - |
| `project.learn_stats` | - | - | `kontextmind learn stats` |
| `project.learn_patterns` | `taskType` | `taskType` | `kontextmind learn patterns` |
| `project.learn_suggestions` | `category`, `limit` | - | - |
| `project.learn_export` | `taskType`, `minConfidence` | - | `kontextmind learn export` |

### Category 13: Agent Awareness (4 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.agent_state` | - | - | `kontextmind agent` |
| `project.agent_capabilities` | - | - | `kontextmind agent` |
| `project.agent_antipatterns` | - | - | - |
| `project.agent_assess` | `taskDescription`, `recentErrors`, `timeSpent` | - | - |

### Category 14: Task Detection (2 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.task_detect` | - | - | - |
| `project.get_task_resumption_context` | `taskId` | `taskId` | - |

### Category 15: Analytics (3 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.ask_stats` | `period` | - | `kontextmind analytics` |
| `project.ask_top_questions` | `limit` | - | `kontextmind analytics` |
| `project.ask_quality` | - | - | `kontextmind analytics` |

### Category 16: Quality (3 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.quality_trends` | `days` | - | `kontextmind quality trends` |
| `project.quality_report` | `period` | - | `kontextmind quality report` |
| `project.quality_performance` | - | - | - |

### Category 17: Context & Insights (2 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.context_stats` | - | - | `kontextmind insights` |
| `project.context_export` | - | - | - |
| `project.session_insights` | `days` | - | `kontextmind insights` |

---

## MCP-Only Tools (No CLI)

**Total: 56 tools** have no direct CLI equivalent.

### Learning (1) - No CLI
- `project.learn_import`

### Agent Awareness (1) - No CLI
- `project.agent_antipatterns`

### Task Detection (1) - No CLI
- `project.task_detect`

### Context & Insights (1) - No CLI
- `project.context_export`

### Other MCP-Only Tools (52)
- `project.search`
- `project.get_recent_tasks`
- `project.resume_task`
- `project.get_file_summary`
- `project.get_function_summary`
- `project.get_module_summary`
- `project.get_api_summary`
- `project.get_decision_summary`
- `project.get_blocker_summary`
- `project.get_symbol_summary`
- `project.get_all_summaries`
- `project.find_dependencies`
- `project.find_callers`
- `project.find_related_files`
- `project.find_blockers`
- `project.find_related_sessions`
- `project.get_timeline`
- `project.get_recent_activity`
- `project.get_current_task`
- `project.get_task_sessions`
- `project.get_session_task`
- `project.add_task_dependency`
- `project.get_task_dependencies`
- `project.get_blocked_tasks`
- `project.get_continuity_suggestions`
- `project.analyze_continuity`
- `project.should_continue`
- `project.search_sessions`
- `project.get_recent_files`
- `project.search_memory`
- `project.search_entities`
- `project.learn_suggestions`
- `project.agent_assess`
- `project.get_task_resumption_context`

---

## Recommended Initial Setup for New Projects

This guide covers the complete setup pattern for maximum utilization of KontextMind's features including learning, analytics, dataset generation, and all agent capabilities.

---

### Quick-Start One-Liner

```bash
kontextmind init --mode full-agent --yes && kontextmind scan && kontextmind index && kontextmind summarize && kontextmind kb build && kontextmind learn sync
```

---

### Phase 1: Initialization & Core Indexing

#### Step 1.1: Initialize with Full-Agent Mode

```bash
# Initialize with full capabilities
kontextmind init --yes --mode full-agent --agents claude,copilot,codex --git auto

# Or interactive setup
kontextmind setup
```

#### Step 1.2: Scan All Files

```bash
# Scan all project files (required before indexing)
kontextmind scan

# Scan only changed files (for updates)
kontextmind scan --changed-only
```

#### Step 1.3: Index Symbols and Dependencies

```bash
# Index TypeScript/JavaScript/Python files
kontextmind index

# Index specific languages only
kontextmind index --language typescript,python
```

#### Step 1.4: Generate AI Summaries

```bash
# Summarize all files
kontextmind summarize

# Summarize only changed files (faster for updates)
kontextmind summarize --changed-only
```

#### Step 1.5: Build Knowledge Base

```bash
# Build the knowledge base
kontextmind kb build
```

---

### Phase 2: Learning & Analytics Setup

#### Step 2.1: Initial Learning Sync

```bash
# Sync summaries, Q&A events, sessions, and tasks to semantic memory
kontextmind learn sync
```

#### Step 2.2: Verify Analytics

```bash
# Check Q&A statistics
kontextmind analytics stats

# Get top questions
kontextmind analytics top-questions

# Get answer quality metrics
kontextmind analytics quality
```

#### Step 2.3: Learning Statistics

```bash
# View learning outcomes and patterns
kontextmind learn stats

# View learned patterns
kontextmind learn patterns

# Get improvement suggestions
kontextmind learn suggestions
```

---

### Phase 3: Dataset Generation Setup

#### Step 3.1: Q&A Dataset

```bash
# Export Q&A data as JSONL
kontextmind dataset export --format jsonl --output ./qa-dataset.jsonl

# Export in ShareGPT format for training
kontextmind dataset export --format sharegpt --output ./training.jsonl

# Get Q&A dataset statistics
kontextmind dataset stats
```

#### Step 3.2: Summary Dataset (Code Explanations)

```bash
# Export code summaries as training data
kontextmind dataset export-summaries --format jsonl --output ./summaries.jsonl

# Export specific types
kontextmind dataset export-summaries --types file,function,module --format json --output ./code-dataset.json

# Get summary dataset statistics
kontextmind dataset stats-summaries
```

#### Step 3.3: Combined Training Dataset

```bash
# Export in ChatML format
kontextmind dataset export --format chatml --output ./chatml-dataset.jsonl

# Validate dataset integrity
kontextmind dataset validate
```

---

### Phase 4: Continuous Usage Commands

#### Daily Workflow

```bash
# Ask questions (builds Q&A dataset)
kontextmind ask "what does this project do?"
kontextmind ask "explain the authentication flow"
kontextmind ask "how do I add a new API endpoint?"

# After code changes - refresh data
kontextmind scan --changed-only
kontextmind summarize --changed-only
kontextmind kb build
kontextmind learn sync

# Monitor quality
kontextmind quality report
kontextmind insights --days 7
```

#### Search & Discovery

```bash
# Search codebase
kontextmind search "authentication middleware"
kontextmind search "database connection"

# Check project status
kontextmind status
kontextmind doctor  # Verify LLM provider
```

---

### Phase 5: Session & Task Management

```bash
# Create work session
kontextmind session create --title "Feature X implementation"

# List sessions
kontextmind session list

# Show last session
kontextmind session show

# List tasks
kontextmind task list

# Get cross-session insights
kontextmind insights --days 7
```

---

### Phase 6: Optional Enhancements

```bash
# Security scan
kontextmind secrets

# Export to Obsidian vault
kontextmind obsidian --output ./obsidian-vault

# Quality trends
kontextmind quality trends --days 7

# Import learning from another project
kontextmind learn import /path/to/other-project

# Export learning for training
kontextmind learn export --output ./patterns.json
```

---

### Command Dependencies

```
init
  └── scan
        └── index
              └── summarize
                    └── kb build
                          └── learn sync
                                ├── analytics stats
                                ├── dataset export
                                └── dataset export-summaries
```

---

### MCP Server Setup

```bash
# Add to Claude Code globally
claude mcp add -s user kontextmind -- kontextmind mcp --mode full-agent

# Start MCP server manually
kontextmind mcp --mode full-agent --transport sse --port 7330
```

---

### First Task Workflow (MCP Tools)

When starting your first task in a new project:

| Step | MCP Tool | Purpose |
|------|----------|---------|
| 1 | `project.status` | Verify project state |
| 2 | `project.ask_readonly` | "What's the project about?" |
| 3 | `project.get_all_summaries` | Review codebase summaries |
| 4 | `project.task_detect` | Start new task |
| 5 | `project.should_continue` | Check for pending work |
| 6 | `project.get_current_task` | Get active task |
| 7 | `project.learn_sync` | Sync learning after work |
| 8 | `project.quality_report` | Review quality metrics |
| 9 | `project.create_handoff` | Generate handoff for next session |

---

### Recommended MCP Tools by Phase

| Phase | Tools | Purpose |
|-------|-------|---------|
| **Onboarding** | `project.status`, `project.ask_readonly` | Understand project |
| | `project.get_all_summaries`, `project.get_recent_files` | Learn codebase |
| **Task Planning** | `project.task_detect`, `project.should_continue` | Start/resume task |
| | `project.get_current_task`, `project.resume_task` | Get task context |
| **During Work** | `project.learn_sync`, `project.learn_stats` | Track learning |
| | `project.agent_state`, `project.agent_assess` | Self-awareness |
| **Quality** | `project.ask_stats`, `project.ask_top_questions` | Analytics |
| **Dataset** | `project.learn_export`, `project.session_insights` | Export training data |
| **Handoff** | `project.create_handoff`, `project.write_session_summary` | Context transfer |
| | `project.quality_trends`, `project.quality_report` | Quality tracking |
| **Handoff** | `project.create_handoff`, `project.write_task_summary` | Context transfer |
| | `project.get_task_resumption_context` | Resume later |

### Best Practices for Agentic AI Interaction

1. **At Session Start:**
   ```
   "Check project status and tell me what I should work on"
   → project.status, project.should_continue, project.get_current_task
   ```

2. **During Development:**
   ```
   "Search for similar patterns in the codebase"
   → project.search, project.find_related_files

   "Show me the dependencies for this file"
   → project.find_dependencies
   ```

3. **Before Handoff:**
   ```
   "Create a handoff document and mark my task complete"
   → project.create_handoff, project.task_complete
   ```

4. **For Self-Improvement:**
   ```
   "Sync learning and show me my agent capabilities"
   → project.learn_sync, project.agent_capabilities

   "What patterns should I avoid?"
   → project.agent_antipatterns
   ```

5. **For Analytics:**
   ```
   "Show me Q&A statistics and quality trends"
   → project.ask_stats, project.quality_trends

   "What are the most common questions?"
   → project.ask_top_questions
   ```

---

## Quick Reference: Tool Categories

| Category | Count | CLI | MCP Only |
|----------|-------|-----|----------|
| Status & Search | 6 | 2 | 4 |
| Summary Retrieval | 8 | 0 | 8 |
| Dependency Analysis | 5 | 0 | 5 |
| Q&A | 2 | 1 | 1 |
| Write Operations | 3 | 1 | 2 |
| Refresh & Scan | 3 | 3 | 0 |
| Session Management | 4 | 2 | 2 |
| Timeline | 2 | 0 | 2 |
| Task Management | 8 | 1 | 7 |
| Memory Search | 3 | 0 | 3 |
| Continuity | 4 | 0 | 4 |
| Learning | 6 | 4 | 1 |
| Agent Awareness | 4 | 1 | 1 |
| Task Detection | 2 | 0 | 2 |
| Analytics | 3 | 1 | 2 |
| Quality | 3 | 2 | 0 |
| Context & Insights | 3 | 2 | 1 |
| **Total** | **70** | **20** | **50** |

---

## API Server Endpoints Reference

The API server provides additional HTTP endpoints for integration:

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Tenant login |
| `POST` | `/auth/token` | Get API token |
| `POST` | `/auth/refresh` | Refresh JWT |
| `POST` | `/auth/verify` | Verify API key |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Register project |
| `GET` | `/projects` | List projects |
| `GET` | `/projects/:id` | Get project |
| `DELETE` | `/projects/:id` | Remove project |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/conversations` | Create conversation |
| `GET` | `/conversations` | List conversations |
| `GET` | `/conversations/:id` | Get conversation |
| `POST` | `/conversations/:id/messages` | Send message |
| `POST` | `/conversations/:id/feedback` | Submit feedback |

### Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/pipeline/status` | Pipeline status |
| `GET` | `/projects/:id/pipeline/stream` | SSE stream |
| `GET` | `/projects/:id/readiness` | Readiness check |

### Learning
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/learning/config` | Get config |
| `PUT` | `/projects/:id/learning/config` | Update config |
| `GET` | `/projects/:id/learning/stats` | Get stats |

---

*Document generated: 2026-05-16*
*Version: KontextMind v1.0.0*
*Total MCP tools: 70+*
*Total CLI commands: 20+*
*Total API endpoints: 70+*