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

## Dataset Commands

| Command | Description |
|---------|-------------|
| `kontextmind dataset export` | Export training data |
| `kontextmind dataset stats` | Dataset statistics |
| `kontextmind dataset validate` | Validate dataset |
| `kontextmind dataset version list` | List versions |

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

### Write (requires full-agent mode)
- `project.create_handoff` - Create handoff
- `project.write_task_summary` - Write task
- `project.write_session_summary` - Write session

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
└── tool-linking.json  # Tool configuration

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

*Quick Reference Card - Keep this handy!*