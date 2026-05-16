# KontextMind Quick Reference

## Quick Start

```bash
# Install and initialize
kontextmind init --mode full-agent --yes

# Interactive setup
kontextmind setup

# Ask a question
kontextmind ask "What does this project do?"

# Start MCP server
kontextmind mcp --mode full-agent
```

---

## Essential Commands

| Command | Description |
|---------|-------------|
| `kontextmind init` | Initialize project |
| `kontextmind setup` | Interactive setup wizard |
| `kontextmind status` | Check project status |
| `kontextmind doctor` | Health check |

---

## Scanning & Indexing

| Command | Description |
|---------|-------------|
| `kontextmind scan` | Scan project files |
| `kontextmind index` | Extract symbols & dependencies |
| `kontextmind summarize` | Generate AI summaries |
| `kontextmind kb build` | Build knowledge base |

---

## Question Answering

| Command | Description |
|---------|-------------|
| `kontextmind ask "question"` | Ask about project |
| `kontextmind session create` | Create session |
| `kontextmind session chat <id> "question"` | Chat in session |

---

## Server Management

| Command | Description |
|---------|-------------|
| `kontextmind serve --port 7331` | Start API server |
| `kontextmind mcp --mode full-agent` | Start MCP server |
| `kontextmind daemon` | Start background daemon |

---

## Session Commands

| Command | Description |
|---------|-------------|
| `kontextmind session create` | Create new session |
| `kontextmind session list` | List all sessions |
| `kontextmind session show <id>` | Show session details |
| `kontextmind session chat <id> "?"` | Chat in session |
| `kontextmind session stats <id>` | Session statistics |
| `kontextmind session delete <id>` | Delete session |

---

## NEW Commands

| Command | Description |
|---------|-------------|
| `kontextmind agent` | Agent awareness mode |
| `kontextmind analytics` | Q&A statistics |
| `kontextmind insights` | Cross-session insights |
| `kontextmind learn sync` | Learning sync |
| `kontextmind learn stats` | Learning stats |
| `kontextmind learn patterns` | Success/failure patterns |
| `kontextmind quality report` | Quality report |
| `kontextmind quality trends` | Quality trends |
| `kontextmind search <query>` | Search codebase |
| `kontextmind task list` | List tasks |
| `kontextmind task complete` | Mark task complete |

---

## Dataset Commands

| Command | Description |
|---------|-------------|
| `kontextmind dataset export` | Export Q&A training data |
| `kontextmind dataset export-summaries` | Export summaries as training data |
| `kontextmind dataset stats` | Q&A dataset statistics |
| `kontextmind dataset stats-summaries` | Summary dataset statistics |
| `kontextmind dataset validate` | Validate dataset |
| `kontextmind dataset version list` | List versions |

### Dataset Export Formats

| Format | Use Case |
|--------|----------|
| `jsonl` | Default line-delimited JSON |
| `json` | Full JSON array |
| `sharegpt` | ShareGPT format for training |
| `chatml` | ChatML format |

### Summary Dataset Types

| Type | Description |
|------|-------------|
| `file` | File purpose and exports |
| `function` | Function documentation |
| `module` | Directory/module summaries |
| `api` | API endpoint documentation |
| `decision` | Architectural decisions |

---

## Security & Audit

| Command | Description |
|---------|-------------|
| `kontextmind secrets` | Scan for secrets |
| `kontextmind audit` | Audit summary |
| `kontextmind obsidian` | Export to Obsidian |

---

## Configuration

| Command | Description |
|---------|-------------|
| `kontextmind config --action show` | Show config |
| `kontextmind config --action list` | List providers |
| `kontextmind config --action add --name x --type y --apiKey z` | Add provider |
| `kontextmind config --provider <name>` | Set default |

---

## MCP Tools Quick Reference

### Status & Search
- `project.status` - Project status
- `project.search` - Search files/symbols
- `project.check_provider` - Check LLM provider

### Summaries
- `project.get_file_summary` - File summary
- `project.get_function_summary` - Function summary
- `project.get_module_summary` - Module summary
- `project.get_all_summaries` - All summaries

### Dependencies
- `project.find_dependencies` - Find file deps
- `project.find_callers` - Find function callers
- `project.find_related_files` - Find related files

### Sessions
- `project.get_session_index` - List sessions
- `project.search_sessions` - Search sessions
- `project.get_last_session` - Last session

### Tasks
- `project.get_current_task` - Current task
- `project.get_recent_tasks` - Recent tasks
- `project.resume_task` - Resume task

### Continuity
- `project.should_continue` - Check pending work
- `project.get_continuity_suggestions` - Get suggestions
- `project.get_task_resumption_context` - Resume context

### Learning
- `project.learn_sync` - Trigger learning sync
- `project.learn_stats` - Learning statistics
- `project.learn_patterns` - Success/failure patterns
- `project.learn_suggestions` - Improvement suggestions

### Agent Awareness
- `project.agent_state` - Current agent state
- `project.agent_capabilities` - Capability profile
- `project.agent_antipatterns` - Anti-patterns to avoid

### Task Detection
- `project.task_detect` - Detect task boundaries
- `project.task_complete` - Mark task complete
- `project.task_update_pending` - Update pending work

### Analytics
- `project.ask_stats` - Q&A statistics
- `project.ask_top_questions` - Most asked questions
- `project.ask_quality` - Answer quality metrics

### Quality
- `project.quality_trends` - Quality trends
- `project.quality_report` - Quality report
- `project.quality_performance` - Performance stats

### Context & Insights
- `project.context_stats` - Context engine stats
- `project.context_export` - Export context
- `project.session_insights` - Cross-session insights

### Write (requires full-agent mode)
- `project.create_handoff` - Create handoff
- `project.write_task_summary` - Write task
- `project.write_session_summary` - Write session

---

## API Server Endpoints

### Authentication
```
POST /auth/login
POST /auth/token
POST /auth/verify
```

### Projects
```
POST /projects
GET /projects
GET /projects/:id
DELETE /projects/:id
```

### Conversations
```
POST /conversations
GET /conversations
GET /conversations/:id
POST /conversations/:id/messages
POST /conversations/:id/feedback
```

### Pipeline
```
GET /projects/:id/pipeline/status
GET /projects/:id/pipeline/stream
GET /projects/:id/readiness
```

### Learning
```
GET /projects/:id/learning/config
PUT /projects/:id/learning/config
GET /projects/:id/learning/stats
```

---

## MCP Modes

| Mode | Description |
|------|-------------|
| `readonly` | Read-only access (default) |
| `chatbot-readonly` | Chatbot Q&A mode |
| `suggest` | Suggestions enabled |
| `edit-with-approval` | Write with approval |
| `full-agent` | Full agent capabilities |

---

## Common Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--changed-only` | Only changed files |
| `--mode <mode>` | Set operation mode |
| `--mock` | Use mock provider |

---

## Project Structure

```
.kontextmind/
├── config.json        # Project config
├── providers.json     # LLM providers
├── policy.json        # Security policy
└── tool-linking.json   # Tool configuration

.summaries/
├── files/             # File summaries
├── functions/         # Function summaries
├── modules/           # Module summaries
└── api/               # API summaries

.sessions/
├── index.json         # Session index
└── <session-id>.json  # Individual sessions

.tasks/
└── index.json         # Task index

.memory/
├── semantic/          # Semantic memory
└── entities/          # Mental model entities
```

---

## Setup One-Liners

### Windows
```powershell
iwr https://raw.githubusercontent.com/kontextmind/setup/main/setup.ps1 | iex
```

### macOS/Linux
```bash
curl -fsSL https://raw.githubusercontent.com/kontextmind/setup/main/setup.sh | bash
```

---

## LLM Providers

| Provider | Models |
|----------|--------|
| anthropic | claude-sonnet-4, claude-opus-4, claude-haiku-4 |
| openai | gpt-4, gpt-4-turbo, gpt-3.5-turbo |
| ollama | llama3, mistral, codellama (local) |
| gemini | gemini-pro, gemini-ultra |
| groq | llama3-70b, mixtral-8x7b |
| deepseek | deepseek-chat, deepseek-coder |
| qwen | qwen-turbo, qwen-max |

---

## Error Codes

| Code | Description |
|------|-------------|
| AUTH001 | Invalid API key |
| AUTH002 | Expired token |
| AUTH003 | Missing auth header |
| PRJ001 | Project not found |
| PRJ002 | Project not ready |
| LLM001 | Invalid provider config |
| LLM002 | Provider connection failed |

---

## Quick cURL Examples

```bash
# Health check
curl http://localhost:7331/health

# Ask question
curl -X POST http://localhost:7331/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does auth work?"}'

# Create conversation
curl -X POST http://localhost:7331/conversations \
  -H "Content-Type: application/json" \
  -d '{"title":"My Session"}'
```

---

*Quick Reference Card - Keep this handy!*
*Version: 2.0*
*Total MCP tools: 70+*
*Total API endpoints: 70+*