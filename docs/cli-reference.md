# CLI Reference

Complete reference for all KontextMind CLI commands.

## Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help information |
| `--version` | Show version number |
| `--json` | Output as JSON (where supported) |

---

## Project Setup

### `kontextmind init`

Initialize KontextMind in the current project.

```bash
kontextmind init [options]
```

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--yes` | `-y` | Skip prompts and use defaults | false |
| `--force` | `-f` | Overwrite existing files | false |
| `--reset` | `-r` | Delete existing data and reinitialize | false |
| `--agents <list>` | | Comma-separated agent list | claude,codex,generic |
| `--mode <mode>` | | Mode: readonly, suggest, edit-with-approval, full-agent | readonly |
| `--git <mode>` | | Git integration: auto, enabled, disabled | auto |
| `--provider <provider>` | | LLM provider: none, openai, anthropic, ollama | none |

**Examples:**

```bash
# Initialize with defaults
kontextmind init

# Initialize with all agents
kontextmind init --agents claude,cursor,copilot,continue

# Initialize with full-agent mode
kontextmind init --mode full-agent --git enabled

# Force overwrite existing files
kontextmind init --force

# Reset and reinitialize
kontextmind init --reset
```

### `kontextmind deinit`

Remove KontextMind completely from the current project.

```bash
kontextmind deinit
```

### `kontextmind status`

Show KontextMind status for the current project.

```bash
kontextmind status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
kontextmind status
# Output:
# Project: my-project
# Mode: readonly
# Initialized: Yes
# KB Ready: Yes
# Last Ask: 2 hours ago
```

### `kontextmind doctor`

Check KontextMind health and configuration.

```bash
kontextmind doctor [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

---

## Scanning & Indexing

### `kontextmind scan`

Scan project files and build file index.

```bash
kontextmind scan [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--changed-only` | Only reindex changed files | false |
| `--include <path>` | Include specific path | - |
| `--exclude <path>` | Exclude specific path | - |
| `--max-size <size>` | Max file size (e.g., 2m, 100k, 5000b) | - |
| `--json` | Output results as JSON | - |

**Examples:**

```bash
# Scan all files
kontextmind scan

# Only changed files
kontextmind scan --changed-only

# With custom limits
kontextmind scan --max-size 500k --exclude node_modules

# JSON output
kontextmind scan --json
```

### `kontextmind index`

Index project: extract symbols, dependencies, and build knowledge graph.

```bash
kontextmind index [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--changed-only` | Only re-index changed files since last scan | false |
| `--language <langs>` | Comma-separated list of languages | typescript,javascript,python |
| `--json` | Output results as JSON | - |

**Examples:**

```bash
# Full index
kontextmind index

# Only changed files
kontextmind index --changed-only

# Python only
kontextmind index --language python

# JSON output
kontextmind index --json
```

### `kontextmind summarize`

Generate AI summaries for project files.

```bash
kontextmind summarize [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--changed-only` | Only summarize changed/stale files | false |
| `--provider <name>` | LLM provider to use | - |
| `--model <model>` | Model to use for summarization | - |
| `--dry-run` | Show what would be summarized without writing | false |
| `--mock` | Use mock provider (no API key required) | false |
| `--max-files <n>` | Maximum files to summarize per run | - |
| `--json` | Output results as JSON | - |

**Examples:**

```bash
# Summarize all files (requires API key)
kontextmind summarize

# Use mock provider (no API key)
kontextmind summarize --mock

# Only changed files
kontextmind summarize --changed-only

# Dry run
kontextmind summarize --dry-run

# With specific provider
kontextmind summarize --provider openai --model gpt-4
```

### `kontextmind kb build`

Build chatbot knowledge base.

```bash
kontextmind kb build [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--mode <mode>` | Build mode: chatbot | chatbot |
| `--changed-only` | Only rebuild changed content | false |
| `--mock` | Use mock provider | false |
| `--max-questions <n>` | Maximum questions to generate | 50 |
| `--json` | Output results as JSON | - |

**Examples:**

```bash
# Build full knowledge base
kontextmind kb build

# With mock provider
kontextmind kb build --mock

# Limited questions
kontextmind kb build --max-questions 20

# JSON output
kontextmind kb build --json
```

---

## Chatbot & Q&A

### `kontextmind ask`

Ask a question about the project.

```bash
kontextmind ask "<question>" [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--mode <mode>` | Response mode: readonly, chatbot-readonly | chatbot-readonly |
| `--json` | Output as JSON | - |
| `--no-code` | Filter out code from response | true |

**Examples:**

```bash
# Basic question
kontextmind ask "What is this project about?"

# JSON output
kontextmind ask "How does authentication work?" --json

# Readonly mode
kontextmind ask "What files handle user auth?" --mode readonly
```

**JSON Output Format:**

```json
{
  "response_id": "abc123",
  "answer": "The authentication system uses...",
  "confidence": 0.85,
  "sources": [
    { "type": "qa", "name": "What is auth?", "relevance": 0.9 },
    { "type": "file_summary", "name": "src/auth/login.ts", "relevance": 0.7 }
  ],
  "raw_code_access": false,
  "policy_applied": true,
  "llm_enhanced": true,
  "provider": "openai",
  "feedback_supported": false
}
```

---

## Session Management

### `kontextmind session create`

Create a new chat session.

```bash
kontextmind session create [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
kontextmind session create
# Session created: abc-123-xyz

kontextmind session create --json
# {"id": "abc-123-xyz", "projectName": "my-project", "createdAt": "2026-05-13T..."}
```

### `kontextmind session list`

List all sessions for the project.

```bash
kontextmind session list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
kontextmind session list
# Sessions (3):
#
# abc-123-xyz
#   Project: my-project
#   Messages: 5
#   Topics: authentication, user management
#   Last activity: 2 minutes ago
#
# def-456-uvw
#   Project: my-project
#   Messages: 2
#   Topics: api design
#   Last activity: 1 hour ago
```

### `kontextmind session show`

Show session details.

```bash
kontextmind session show <session-id> [options]
```

**Example:**

```bash
kontextmind session show abc-123-xyz

# Session: abc-123-xyz
# Project: my-project
# Created: 2026-05-13T10:00:00Z
# Updated: 2026-05-13T10:30:00Z
# Messages: 5
# Topics: authentication, user management
#
# Messages:
#
# [USER] 2026-05-13T10:00:00Z
# How does authentication work?
#
# [ASSISTANT] 2026-05-13T10:00:05Z
# The authentication system uses JWT tokens...
```

### `kontextmind session delete`

Delete a session.

```bash
kontextmind session delete <session-id>
```

**Example:**

```bash
kontextmind session delete abc-123-xyz
# Session deleted: abc-123-xyz
```

### `kontextmind session chat`

Ask a question in a session.

```bash
kontextmind session chat <session-id> <question> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--mode <mode>` | Response mode: readonly, chatbot-readonly | chatbot-readonly |
| `--json` | Output as JSON | - |

**Examples:**

```bash
# Ask in session
kontextmind session chat abc-123-xyz "What files handle auth?"

# With options
kontextmind session chat abc-123-xyz "Explain the login flow" --mode readonly --json
```

### `kontextmind session stats`

Show session statistics.

```bash
kontextmind session stats <session-id> [options]
```

**Example:**

```bash
kontextmind session stats abc-123-xyz

# Session Statistics: abc-123-xyz
# Total messages: 10
# User messages: 5
# Assistant messages: 5
# Total tokens: 15000
# Average confidence: 0.82
# Sources used: qa, file_summary, llm-synthesis
# Started: 2026-05-13T10:00:00Z
# Last activity: 2026-05-13T11:30:00Z
```

---

## Dataset Management

### `kontextmind dataset export`

Export training dataset.

```bash
kontextmind dataset export [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Output format: jsonl, json, chatml, sharegpt | jsonl |
| `--output <path>` | Output file path | .kontextmind/dataset/current/training.jsonl |
| `--min-confidence <n>` | Minimum confidence threshold | 0.5 |
| `--include-code` | Include code request responses | false |
| `--api-only` | Only include API-sourced data | false |
| `--json` | Output as JSON | - |

**Examples:**

```bash
# Export as JSONL
kontextmind dataset export

# Export as ChatML
kontextmind dataset export --format chatml

# Export with custom path
kontextmind dataset export --output ./data/training.jsonl

# Include all records
kontextmind dataset export --include-code --api-only

# JSON output with stats
kontextmind dataset export --json
```

### `kontextmind dataset stats`

Show dataset statistics.

```bash
kontextmind dataset stats [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--version <ver>` | Show stats for specific version |
| `--json` | Output as JSON |

**Example:**

```bash
kontextmind dataset stats

# Dataset Statistics
# Total records: 150
# Version: 1.2.0
# Average quality: 0.78
#
# By Source:
#   api: 80
#   cli: 50
#   mcp: 20
#
# By Feedback:
#   helpful: 45
#   neutral: 80
#   not_helpful: 25
```

### `kontextmind dataset validate`

Validate dataset quality.

```bash
kontextmind dataset validate [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--strict` | Fail on validation errors | false |
| `--min-quality <n>` | Minimum quality score | 0.6 |
| `--json` | Output as JSON | - |

**Examples:**

```bash
# Basic validation
kontextmind dataset validate

# Strict mode
kontextmind dataset validate --strict --min-quality 0.7

# JSON output
kontextmind dataset validate --json
```

### `kontextmind dataset version`

Manage dataset versions.

```bash
kontextmind dataset version <action> [options]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | List all versions |
| `export` | Export specific version |

**Options:**

| Option | Description |
|--------|-------------|
| `--version <ver>` | Version for export |
| `--format <format>` | Export format: jsonl, json, chatml, sharegpt |
| `--output <path>` | Output file path |
| `--json` | Output as JSON |

**Examples:**

```bash
# List all versions
kontextmind dataset version list

# Export specific version
kontextmind dataset version export --version 1.0.0 --format chatml

# Output to custom path
kontextmind dataset version export --version 1.0.0 --output ./export.jsonl
```

---

## Server

### `kontextmind serve`

Start HTTP API server.

```bash
kontextmind serve [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--port <port>` | Port number | 7331 |
| `--host <host>` | Host address | 127.0.0.1 |
| `--mode <mode>` | Server mode: readonly, chatbot-readonly, suggest, edit-with-approval, full-agent | chatbot-readonly |

**Examples:**

```bash
# Default server
kontextmind serve

# Custom port
kontextmind serve --port 8080

# External access
kontextmind serve --port 8080 --host 0.0.0.0

# Full agent mode
kontextmind serve --mode full-agent
```

### `kontextmind mcp`

Start MCP server for AI agent integration.

```bash
kontextmind mcp [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--mode <mode>` | Server mode: readonly, chatbot-readonly, suggest, edit-with-approval | chatbot-readonly |
| `--transport <transport>` | Transport: stdio, http | stdio |
| `--port <port>` | Port for HTTP transport | 7332 |

**Examples:**

```bash
# STDIO transport (default)
kontextmind mcp

# HTTP transport
kontextmind mcp --transport http --port 7332

# Readonly mode
kontextmind mcp --mode readonly
```

---

## Security

### `kontextmind secrets`

Scan for secrets in project files.

```bash
kontextmind secrets [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--fail-on-critical` | Exit with error code if critical secrets found |

**Examples:**

```bash
# Scan for secrets
kontextmind secrets

# JSON output
kontextmind secrets --json

# Fail on critical
kontextmind secrets --fail-on-critical
```

### `kontextmind audit`

Show audit summary and statistics.

```bash
kontextmind audit [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--since <time>` | Filter events since (e.g., 24h, 7d, 1h) | - |
| `--json` | Output as JSON |

**Examples:**

```bash
# View audit summary
kontextmind audit

# Last 24 hours
kontextmind audit --since 24h

# Last 7 days
kontextmind audit --since 7d

# JSON output
kontextmind audit --json
```

---

## Utilities

### `kontextmind obsidian`

Export project brain to Obsidian-compatible Markdown notes.

```bash
kontextmind obsidian [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--output <path>` | Output directory | .obsidian-export |
| `--clean` | Remove existing export before exporting | false |
| `--json` | Output as JSON | - |

**Examples:**

```bash
# Export to default location
kontextmind obsidian export

# Clean and re-export
kontextmind obsidian export --clean

# Custom output directory
kontextmind obsidian export --output ./my-notes
```

### `kontextmind config`

Manage KontextMind configuration and providers.

```bash
kontextmind config [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--action <action>` | Action: show, add, remove, list, test, set-api-key |
| `--name <name>` | Provider name |
| `--type <type>` | Provider type (e.g., openai-compatible) |
| `--baseUrl <url>` | API base URL |
| `--apiKey <key>` | API key |
| `--model <model>` | Model name |
| `--provider <name>` | Set default provider |
| `--prompt <text>` | Test prompt |
| `--global` | Use global configuration |

**Examples:**

```bash
# Show current config
kontextmind config --action show

# Add OpenAI-compatible provider
kontextmind config add --name openai --type openai-compatible \
  --baseUrl https://api.openai.com/v1 --apiKey sk-xxx --model gpt-4

# Set default provider
kontextmind config --provider openai

# Test provider
kontextmind config test --prompt "Hello"

# List providers
kontextmind config --action list
```

---

## Placeholder Commands

### `kontextmind handoff`

Placeholder for future handoff functionality.

```bash
kontextmind handoff
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Project not initialized |

---

## Examples

### Complete Workflow

```bash
# 1. Initialize project
kontextmind init --yes

# 2. Scan and index
kontextmind scan
kontextmind index

# 3. Generate summaries
kontextmind summarize --mock

# 4. Build knowledge base
kontextmind kb build

# 5. Ask questions
kontextmind ask "What is this project about?"

# 6. Start API server
kontextmind serve --port 7331
```

### Session-Based Workflow

```bash
# 1. Create session
kontextmind session create
# Save the session ID

# 2. Start conversation
kontextmind session chat abc-123-xyz "What files handle auth?"

# 3. Continue conversation
kontextmind session chat abc-123-xyz "Explain the login flow"

# 4. View session
kontextmind session show abc-123-xyz

# 5. Get stats
kontextmind session stats abc-123-xyz
```

### Dataset Preparation Workflow

```bash
# 1. After Q&A sessions, export dataset
kontextmind dataset export --format jsonl

# 2. View statistics
kontextmind dataset stats

# 3. Validate quality
kontextmind dataset validate --min-quality 0.6

# 4. Create version
kontextmind dataset version list

# 5. Export specific version
kontextmind dataset version export --version 1.0.0 --format sharegpt
```