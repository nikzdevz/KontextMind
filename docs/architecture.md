# Architecture

## Overview

KontextMind is a monorepo with multiple packages that work together to provide project memory and continuity for AI coding agents.

**All phases 1-10 are complete. This is the MVP architecture.**

## Monorepo Structure

```
KontextMind/
├── apps/
│   └── cli/           # CLI application
├── packages/
│   ├── core/          # Core library
│   ├── adapters/      # Agent adapters
│   ├── server/        # HTTP API server
│   └── mcp/           # MCP server
├── templates/          # Template files
├── docs/               # Documentation
└── tests/              # Test files
```

## Package Responsibilities

### @kontextmind/cli

The command-line interface entry point.

**Commands:**
- `init` — Initialize project
- `status` — Show project status
- `doctor` — Check configuration health
- `scan` — Scan project files
- `index` — Index symbols and build graph
- `summarize` — Generate AI summaries
- `kb` — Build chatbot knowledge base
- `ask` — Ask questions
- `serve` — Start HTTP server
- `mcp` — Start MCP server
- `secrets` — Scan for secrets
- `audit` — Show audit summary
- `obsidian` — Export to Obsidian

### @kontextmind/core

The core library containing all business logic.

**Modules:**

| Module | Responsibility |
|--------|---------------|
| `config/` | Configuration schemas |
| `init/` | Project initialization |
| `templates/` | Template rendering |
| `scanner/` | File scanning |
| `parser/` | Code parsing and knowledge graph |
| `summaries/` | AI summarization |
| `providers/` | LLM provider integrations |
| `security/` | Secret scanning, redaction |
| `policy/` | Policy enforcement |
| `chatbot/` | Q&A functionality |
| `obsidian/` | Obsidian export |

### @kontextmind/server

HTTP API server using Node.js built-in `http` module.

**Endpoints:**
- GET /health
- GET /status
- POST /ask
- GET /graph
- GET /file-summary
- GET /symbol
- POST /kb/build
- GET /audit

### @kontextmind/mcp

Model Context Protocol server.

**Features:**
- stdio transport (primary)
- HTTP transport (optional)
- 11 tools
- 7 resources
- 7 prompts

## LLM Providers

The `providers/` module supports multiple LLM providers:

| Provider | Description | API Key Required |
|----------|-------------|-----------------|
| `mock` | Built-in mock for testing | No |
| `openai-compatible` | Any OpenAI-compatible API | Optional |
| `openai` | OpenAI API (future) | Yes |
| `anthropic` | Anthropic Claude (future) | Yes |
| `ollama` | Ollama local models (future) | No |
| `bedrock` | AWS Bedrock (future) | Yes |

### OpenAI-Compatible Provider

Works with:
- LM Studio (local)
- Ollama (local)
- LocalAI
- Together AI
- Anyscale
- Custom OpenAI-compatible servers

```typescript
// Configuration
{
  provider: 'openai-compatible',
  apiKey: 'key-or-not-needed',
  baseUrl: 'http://localhost:8080/v1',
  model: 'llama-3'
}
```

## Data Storage

### Project-Local Folders

All data stays in the project repository:

```
.kontextmind/          # Configuration
  ├── config.json
  ├── policy.json
  ├── providers.json
  ├── registry.json
  └── ...

.kg/                   # Knowledge graph
  └── file-index.json

.summaries/            # AI summaries
  └── files/

.context/               # Project memory
  ├── handoff.md
  └── current-state.md

.logs/                  # Audit logs
  ├── qna-events.log
  ├── security-events.log
  ├── cost-events.log
  └── ...

.obsidian-export/       # Obsidian export
```

## Security Architecture

### Secret Detection

Patterns detected:
- AWS access keys (`AKIA...`)
- AWS secret keys (40-char base64)
- Private keys (RSA, EC, DSA, OPENSSH)
- JWT tokens (`eyJ...`)
- Database URLs (postgres://, mongodb://, etc.)
- API keys (20+ char alphanumeric)
- Bearer tokens
- Password assignments

### Redaction

Before logging:
```typescript
'AKIAIOSFODNN7EXAMPLE' → 'AKIA************'
'password=secret123' → 'password=***REDACTED***'
```

### Prompt Injection Protection

Content classification:
- **Trusted**: `.kontextmind/policy.json`, `CLAUDE.md`, `.context/`
- **Untrusted**: Source code, README, configuration files

## Configuration Schema

### config.json

```json
{
  "project": {
    "name": "my-project",
    "root": ".",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "mode": "readonly",
  "agents": ["claude", "codex", "generic"],
  "git": {
    "enabled": "auto",
    "available": true,
    "use_for_change_detection": true
  },
  "indexing": {
    "respect_toolignore": true,
    "hash_algorithm": "sha256",
    "changed_only": false
  },
  "chatbot": {
    "enabled": true,
    "raw_code_access": false
  },
  "server": {
    "host": "127.0.0.1",
    "port": 7331
  },
  "mcp": {
    "enabled": true,
    "transport": "stdio"
  },
  "phase": 10
}
```

### policy.json

```json
{
  "mode": "readonly",
  "allow_tools": ["read", "search", "ask"],
  "deny_tools": ["write", "edit", "delete"],
  "security": {
    "raw_code_access": false,
    "return_source_code": false,
    "max_code_lines": 50,
    "redact_secrets": true,
    "treat_project_files_as_untrusted": true
  },
  "logs": {
    "enabled": true,
    "retention_days": 90
  }
}
```

### providers.json

```json
{
  "providers": {
    "primary": {
      "provider": "openai-compatible",
      "apiKey": "not-needed",
      "baseUrl": "http://localhost:8080/v1",
      "model": "llama-3"
    }
  }
}
```

## Extension Points

### Adding a New Provider

1. Create provider class in `packages/core/src/providers/`
2. Implement `ModelProvider` interface
3. Register in `provider-registry.ts`

### Adding a New CLI Command

1. Create command file in `apps/cli/src/commands/`
2. Register in `apps/cli/src/index.ts`

### Adding a New MCP Tool

1. Add tool definition to `packages/mcp/src/mcp-server.ts`
2. Implement handler function

## Design Principles

1. **Local-first**: All data stays in the project
2. **Privacy-preserving**: No external services required
3. **Agent-agnostic**: Works with any AI agent
4. **Security-focused**: Secret scanning and redaction
5. **Phase-based**: Incremental capability addition