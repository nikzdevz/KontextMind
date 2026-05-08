# CLI Reference

## kontextmind

KontextMind CLI — the shared project brain for AI coding agents.

### Synopsis

```bash
kontextmind [command] [options]
```

### Commands

#### init

Initialize KontextMind in the current project.

```bash
kontextmind init [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--yes` | `-y` | Skip prompts and use defaults | false |
| `--force` | `-f` | Overwrite existing files | false |
| `--agents <list>` | | Comma-separated agent list | claude,codex,generic |
| `--mode <mode>` | | Mode: readonly, suggest, edit-with-approval, full-agent | readonly |
| `--git <mode>` | | Git integration: auto, enabled, disabled | auto |
| `--provider <provider>` | | LLM provider: none, openai, anthropic, ollama, bedrock, openai-compatible | none |

**Examples:**

```bash
# Initialize with defaults
kontextmind init --yes

# Force overwrite existing files
kontextmind init --force

# Initialize for Claude and Cursor
kontextmind init --agents claude,cursor

# Initialize in suggest mode
kontextmind init --mode suggest

# Initialize with OpenAI provider
kontextmind init --provider openai

# Full example with all options
kontextmind init --yes --agents claude,codex --mode readonly --git auto --provider anthropic
```

#### status

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
kontextmind status --json
```

**Output (text):**

```
KontextMind Status

Initialized: yes
Project: my-project
Mode: readonly
Phase: 1
Agents: claude,codex,generic
Git mode: auto
Git available: true
Provider: none
CLAUDE.md: found
AGENTS.md: found
.toolignore: found
```

**Output (JSON):**

```json
{
  "initialized": true,
  "project": "my-project",
  "mode": "readonly",
  "phase": 1,
  "agents": ["claude", "codex", "generic"],
  "gitMode": "auto",
  "gitAvailable": true,
  "provider": "none",
  "claudeMd": true,
  "agentsMd": true,
  "toolignore": true,
  "errors": []
}
```

#### doctor

Check KontextMind health and configuration.

```bash
kontextmind doctor [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
kontextmind doctor
kontextmind doctor --json
```

**Output:**

```
KontextMind Doctor

PASS .kontextmind/config.json exists
PASS .kontextmind/policy.json exists
PASS CLAUDE.md exists
PASS AGENTS.md exists
PASS .toolignore exists
WARN Knowledge graph not built yet. This is expected in Phase 1.
WARN Scanner not implemented yet. This will be added in Phase 2.

Result: healthy for Phase 1
```

### Future Commands (Phase 2+)

The following commands are not implemented in Phase 1:

```bash
kontextmind scan       # Scan project files (Phase 2)
kontextmind index      # Index project files (Phase 2)
kontextmind summarize  # Generate summaries (Phase 4)
kontextmind ask        # Ask questions (Phase 5)
kontextmind serve      # Start HTTP server (Phase 6)
kontextmind chat       # Start chatbot (Phase 5)
kontextmind export     # Export to Obsidian (Phase 9)
```

Running these commands in Phase 1 will show:

```
Command not implemented in Phase 1.
This command will be added in a later phase.
```

### Global Options

| Option | Description |
|--------|-------------|
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## Configuration Files

### .kontextmind/config.json

Main project configuration file.

**Fields:**

- `project.name` — Project name
- `project.root` — Project root (always ".")
- `project.created_at` — ISO timestamp
- `mode` — Current mode
- `agents` — List of supported agents
- `git.enabled` — Git integration mode
- `git.available` — Whether git is available
- `git.use_for_change_detection` — Use git for changes
- `indexing.*` — File indexing settings
- `chatbot.*` — Chatbot settings
- `server.*` — HTTP server settings
- `mcp.*` — MCP server settings
- `phase` — Current phase

### .kontextmind/policy.json

Security and operational policy.

**Fields:**

- `mode` — Enforced mode
- `allow_tools` — List of allowed tools
- `deny_tools` — List of denied tools
- `security.*` — Security settings
- `logs.*` — Logging settings

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Error |
| 2 | Invalid arguments |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `KONTEXTMIND_VERSION` | KontextMind version |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OLLAMA_API_KEY` | Ollama API key |