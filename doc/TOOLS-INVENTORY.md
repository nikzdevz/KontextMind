# KontextMind Tools & Functions - Complete Inventory

## Executive Summary

| Category | Total Functions | Exposed via MCP | Exposed via CLI | Internal Only |
|----------|----------------|-----------------|-----------------|---------------|
| Memory Module | ~50+ | 25+ | 5+ | ~20 |
| Learning Module | ~30+ | 10 | 0 | ~20 |
| Brain-Ask | ~15 | 4 | 1 | ~10 |
| Awareness | ~25+ | 4 | 0 | ~21+ |
| Context | ~15 | 3 | 0 | ~12 |
| Chatbot | ~50+ | 10+ | 10+ | ~30 |
| MCP Tools | 70+ | 70+ | - | 0 |
| MCP Resources | 15 | 15 | - | 0 |
| MCP Prompts | 10 | 10 | - | 0 |
| CLI Commands | 30+ | - | 30+ | 0 |

**Total Code Functions: 200+**
**Total Exposed Functions: 130+**
**Total API Endpoints: 70+**

---

## SECTION 1: CLI Commands (30+)

### Core Commands

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind init` | `--yes`, `--force`, `--reset`, `--agents`, `--mode`, `--git`, `--provider` | Initialize project |
| `kontextmind setup` | `--provider`, `--model` | Interactive setup wizard |
| `kontextmind deinit` | - | Remove KontextMind |
| `kontextmind status` | `--json` | Show project status |
| `kontextmind doctor` | `--json` | Health check |

### Scanning & Indexing

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind scan` | `--changed-only`, `--include`, `--exclude`, `--json`, `--max-size` | Scan files |
| `kontextmind index` | `--changed-only`, `--language`, `--json` | Index symbols/deps |
| `kontextmind summarize` | `--changed-only`, `--provider`, `--model`, `--dry-run`, `--mock`, `--max-files`, `--json` | Generate summaries |
| `kontextmind kb` | `build` | Build knowledge base |

### Question Answering

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind ask` | `--stats`, `--json`, `<question>` | Ask question |

### Server Management

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind serve` | `--port`, `--host` | Start HTTP API |
| `kontextmind mcp` | `--mode`, `--transport`, `--port` | Start MCP server |
| `kontextmind daemon` | `--port`, `--log` | Background daemon |

### Session Management

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind session create` | `--title`, `--tags` | Create session |
| `kontextmind session list` | `--json`, `--limit` | List sessions |
| `kontextmind session show` | `<session-id>` | Show session |
| `kontextmind session delete` | `<session-id>` | Delete session |
| `kontextmind session chat` | `<session-id> <question>` | Chat in session |
| `kontextmind session stats` | `<session-id>`, `--json` | Session statistics |

### Dataset & Export

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind dataset export` | `--format`, `--output`, `--min-confidence` | Export Q&A training data |
| `kontextmind dataset export-summaries` | `--format`, `--output`, `--types`, `--min-confidence` | Export summaries as training data |
| `kontextmind dataset stats` | `--version`, `--json` | Show Q&A dataset statistics |
| `kontextmind dataset stats-summaries` | `--json` | Show summary dataset statistics |
| `kontextmind dataset validate` | `--strict`, `--min-quality` | Validate dataset quality |
| `kontextmind dataset version` | `list`, `export` | Manage dataset versions |
| `kontextmind obsidian` | `--output`, `--include` | Export to Obsidian |

### Security & Audit

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind secrets` | `--json`, `--include-known` | Scan for secrets |
| `kontextmind audit` | `--since`, `--json` | Audit summary |

### Configuration

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind config` | `--action`, `--name`, `--type`, `--provider`, `--json` | Manage config |
| `kontextmind cache` | `clear`, `stats` | Cache management |
| `kontextmind handoff` | - | Create handoff |

### NEW CLI Commands

| Command | Options | Description |
|---------|---------|-------------|
| `kontextmind agent` | - | Run agent mode |
| `kontextmind analytics` | `--period`, `--format` | Q&A statistics |
| `kontextmind insights` | `--days` | Cross-session insights |
| `kontextmind learn` | `sync`, `import`, `export`, `--stats`, `--patterns` | Learning operations |
| `kontextmind quality` | `report`, `trends`, `--days` | Quality tracking |
| `kontextmind search` | `<query>`, `--type`, `--limit` | Search codebase |
| `kontextmind task` | `list`, `show`, `complete`, `--pending` | Task management |

---

## SECTION 2: MCP Tools (70+)

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

| Tool | Parameters | Required | Mode Required |
|------|------------|----------|---------------|
| `project.create_handoff` | `summary`, `next_steps` | `summary` | full-agent |
| `project.write_task_summary` | `title`, `goal`, `progress`, `filesTouched`, `decisions`, `pending`, `nextSteps` | `title`, `goal` | full-agent |
| `project.write_session_summary` | `goals`, `tasksCompleted`, `filesModified`, `decisions`, `pending`, `handoff` | - | full-agent |

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
| `project.get_current_task` | - | - | `kontextmind task list` |
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

### Category 17: Context & Insights (3 tools)

| Tool | Parameters | Required | CLI Equivalent |
|------|------------|----------|----------------|
| `project.context_stats` | - | - | `kontextmind insights` |
| `project.context_export` | - | - | - |
| `project.session_insights` | `days` | - | `kontextmind insights` |

---

## SECTION 3: MCP Resources (15)

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

## SECTION 4: MCP Prompts (10)

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

## SECTION 5: API Server Endpoints (70+)

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Tenant login |
| `POST` | `/auth/token` | Get API token |
| `POST` | `/auth/refresh` | Refresh JWT |
| `POST` | `/auth/verify` | Verify API key |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |

### Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tenants` | Create tenant |
| `GET` | `/tenants` | List tenants |
| `GET` | `/tenants/:id` | Get tenant |
| `PATCH` | `/tenants/:id` | Update tenant |
| `DELETE` | `/tenants/:id` | Delete tenant |
| `POST` | `/tenants/:id/suspend` | Suspend tenant |
| `POST` | `/tenants/:id/resume` | Resume tenant |
| `GET` | `/tenants/:id/usage` | Usage stats |

### Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/providers` | List providers |
| `GET` | `/providers/:name/models` | List models |
| `POST` | `/providers/test` | Test connection |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Register project |
| `GET` | `/projects` | List projects |
| `GET` | `/projects/:id` | Get project |
| `DELETE` | `/projects/:id` | Remove project |
| `POST` | `/projects/:id/sync` | Sync from Git |
| `POST` | `/projects/:id/reset` | Reset container |
| `GET` | `/projects/:id/status` | Container health |
| `GET` | `/projects/:id/files/*` | Read file |

### Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/pipeline/status` | Status |
| `GET` | `/projects/:id/pipeline/steps` | Steps |
| `GET` | `/projects/:id/pipeline/stream` | SSE stream |
| `POST` | `/projects/:id/pipeline/trigger` | Trigger |
| `GET` | `/projects/:id/readiness` | Readiness |

### Learning

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/learning/config` | Get config |
| `PUT` | `/projects/:id/learning/config` | Update config |
| `POST` | `/projects/:id/learning/trigger` | Manual sync |
| `GET` | `/projects/:id/learning/stats` | Stats |
| `GET` | `/projects/:id/learning/patterns` | Patterns |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/conversations` | Create |
| `GET` | `/conversations` | List |
| `GET` | `/conversations/:id` | Get |
| `DELETE` | `/conversations/:id` | Delete |
| `PATCH` | `/conversations/:id` | Update |
| `GET` | `/conversations/:id/messages` | Messages |
| `POST` | `/conversations/:id/messages` | Send message |
| `POST` | `/conversations/:id/feedback` | Feedback |
| `GET` | `/conversations/:id/summary` | AI summary |
| `GET` | `/conversations/:id/stream` | SSE stream |

### Q&A

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ask` | Ask question |
| `POST` | `/ask/feedback` | Direct feedback |
| `POST` | `/stream/ask` | Streaming ask |
| `GET` | `/stream/conversations/:id/events` | SSE events |

---

## SECTION 6: Tool Categories Summary

| Category | MCP Tools | CLI Commands | API Endpoints |
|----------|-----------|--------------|---------------|
| Status & Search | 6 | 2 | 0 |
| Summary Retrieval | 8 | 0 | 0 |
| Dependency Analysis | 5 | 0 | 0 |
| Q&A | 2 | 1 | 4 |
| Write Operations | 3 | 1 | 0 |
| Refresh & Scan | 3 | 4 | 0 |
| Session Management | 4 | 6 | 10 |
| Timeline | 2 | 0 | 0 |
| Task Management | 8 | 2 | 0 |
| Memory Search | 3 | 0 | 0 |
| Continuity | 4 | 0 | 0 |
| Learning | 6 | 4 | 5 |
| Agent Awareness | 4 | 1 | 0 |
| Quality | 3 | 2 | 0 |
| Context & Insights | 3 | 2 | 0 |
| Authentication | 0 | 0 | 4 |
| Health | 0 | 0 | 3 |
| Tenants | 0 | 0 | 8 |
| Providers | 0 | 0 | 3 |
| Projects | 0 | 0 | 8 |
| Pipeline | 0 | 0 | 5 |
| **Total** | **70+** | **30+** | **70+** |

---

*Document Version: 2.0*
*Generated: 2026-05-16*
*Total MCP Tools: 70+*
*Total CLI Commands: 30+*
*Total API Endpoints: 70+*