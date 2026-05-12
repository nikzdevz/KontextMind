# KontextMind

**KontextMind — the shared project brain for AI coding agents.**

KontextMind is a local-first project memory, knowledge graph, chatbot Q&A, and agent-continuity layer for AI coding agents like Claude Code, Codex, Cursor, Continue, GitHub Copilot, VS Code agents, and MCP-compatible clients.

## What is KontextMind?

KontextMind stores project context, handoff notes, summaries, knowledge graph data, and policy rules directly in your project repository. This helps AI coding agents understand your codebase structure, conventions, ongoing work, and technical decisions without requiring external databases or services.

### Key Features

- **Local-first**: All data stays in your project repository
- **Agent-agnostic**: Works with Claude Code, Codex, Cursor, Continue, Copilot, and more
- **Privacy-preserving**: No external services required
- **MCP-ready**: Full Model Context Protocol support
- **Chatbot mode**: Natural language Q&A about your codebase
- **Security-focused**: Secret scanning, redaction, and audit logging
- **Obsidian export**: Export project brain to Obsidian-compatible notes

## MVP Status

**All phases 1-10 are complete.** KontextMind is production-ready for evaluation.

## Quick Start

```bash
# Initialize KontextMind
kontextmind init --yes

# Scan and index project
kontextmind scan
kontextmind index

# Generate summaries (mock mode for testing)
kontextmind summarize --mock

# Build chatbot knowledge base
kontextmind kb build --mock

# Ask questions about your project
kontextmind ask "What is this project about?"

# Start API server
kontextmind serve --mode chatbot-readonly

# Start MCP server
kontextmind mcp

# Scan for secrets
kontextmind secrets scan

# Export to Obsidian
kontextmind obsidian export

# View audit summary
kontextmind audit

# Check status
kontextmind status
kontextmind doctor
```

## Features by Phase

| Phase | Features |
|-------|----------|
| 1 | Foundation, CLI, init, agent instruction files |
| 2 | Scanner, file index, hash tracking, improved status/doctor |
| 3 | Parser, symbol index, basic knowledge graph |
| 4 | Summary engine, stale detection |
| 5 | Chatbot knowledge base, ask command |
| 6 | HTTP API server |
| 7 | MCP server (Model Context Protocol) |
| 8 | Audit, security scanning, cost logs, secret detection |
| 9 | Obsidian export |
| 10 | Polish, docs, examples, release readiness |

## CLI Commands

### Core Commands

```bash
kontextmind init           # Initialize project
kontextmind status         # Show project status
kontextmind doctor         # Verify configuration health
```

### Indexing Commands

```bash
kontextmind scan           # Scan project files
kontextmind index          # Extract symbols and build knowledge graph
kontextmind summarize      # Generate AI summaries for files
kontextmind kb build       # Build chatbot knowledge base
```

### Query Commands

```bash
kontextmind ask "<question>"   # Ask about the project
kontextmind serve                # Start HTTP API server
kontextmind mcp                  # Start MCP server
```

### Utility Commands

```bash
kontextmind secrets scan       # Scan for secrets
kontextmind audit               # Show audit summary
kontextmind obsidian export    # Export to Obsidian notes
```

## Options for `kontextmind init`

| Option | Description | Default |
|--------|-------------|---------|
| `--yes` | Skip prompts and use defaults | false |
| `--force` | Overwrite existing files | false |
| `--agents` | Comma-separated agent list | claude,codex,generic |
| `--mode` | Mode: readonly, suggest, edit-with-approval, full-agent | readonly |
| `--git` | Git integration: auto, enabled, disabled | auto |
| `--provider` | LLM provider: none, openai, anthropic, ollama, bedrock | none |

## Modes

KontextMind operates in four modes:

| Mode | File Modifications | Description |
|------|-------------------|-------------|
| `readonly` | Prohibited | Summaries and context only |
| `suggest` | Prohibited | Suggestions without implementation |
| `edit-with-approval` | Requires approval | Implement with explicit approval |
| `full-agent` | Allowed | Act autonomously within policy |

## Security Features

- **Secret Scanning**: Detects AWS keys, private keys, JWT tokens, database URLs, API keys, passwords
- **Redaction**: Automatically redacts secrets from logs
- **Prompt Injection Protection**: Classifies content as trusted/untrusted
- **Audit Logging**: All actions logged for security review
- **Cost Tracking**: Tracks LLM usage and costs

```bash
# Scan for secrets
kontextmind secrets scan --json
kontextmind secrets scan --fail-on-critical

# View audit summary
kontextmind audit --since 24h
kontextmind audit --json
```

## LLM Providers

KontextMind supports multiple LLM providers for AI-powered features:

| Provider | Description |
|----------|-------------|
| `mock` | Built-in mock provider (no API key needed) |
| `openai-compatible` | Any OpenAI-compatible API (LM Studio, Ollama, LocalAI, Together AI, etc.) |
| `openai` | OpenAI API (future) |
| `anthropic` | Anthropic Claude API (future) |
| `ollama` | Ollama local models (future) |

### Quick Start (No API Key)

```bash
# Use mock provider for testing
kontextmind summarize --mock
kontextmind kb build --mock
```

### OpenAI-Compatible Setup

Configure `.kontextmind/providers.json`:

```json
{
  "providers": {
    "primary": {
      "provider": "openai-compatible",
      "apiKey": "your-api-key",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4"
    }
  }
}
```

For local models (LM Studio, Ollama):

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

See [docs/providers.md](docs/providers.md) for detailed setup instructions.

## MCP Server

KontextMind includes a full Model Context Protocol server:

```bash
# Start in stdio mode (for MCP clients)
kontextmind mcp

# Start in HTTP mode
kontextmind mcp --transport http --port 7332
```

## HTTP API

Start the HTTP API server:

```bash
kontextmind serve --port 7331 --host 127.0.0.1 --mode chatbot-readonly
```

Endpoints:
- `GET /health` - Health check
- `GET /status` - Project status
- `POST /ask` - Ask a question
- `GET /graph` - Knowledge graph
- `GET /file-summary` - Get file summary
- `GET /symbol` - Get symbol info
- `POST /kb/build` - Build knowledge base
- `GET /audit` - Audit information

## Obsidian Export

Export your project brain to Obsidian-compatible Markdown notes:

```bash
kontextmind obsidian export
kontextmind obsidian export --output ./my-notes --clean
```

This creates backlinks between notes and applies redaction automatically.

## Installation

### Prerequisites

- Node.js 20+
- pnpm (recommended)

### From Source

```bash
# Clone the repository
git clone https://github.com/nikzdevz/KontextMind.git
cd KontextMind

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Global CLI Installation

```bash
# From the kontextmind repository
cd apps/cli
pnpm link --global

# Then use anywhere
kontextmind --help
```

### Mock Mode (No API Key Required)

For testing without an LLM API key:

```bash
kontextmind summarize --mock
kontextmind kb build --mock
```

## Project Structure

After initialization:

```
project/
├── CLAUDE.md              # Claude Code instructions
├── AGENTS.md              # Generic agent instructions
├── README_AI.md           # AI agent guide
├── .toolignore            # Files to ignore

├── .context/              # Project memory
│   ├── handoff.md         # Session handoff
│   ├── current-state.md   # Project status
│   └── agent-policy.md    # Agent policy

├── .kontextmind/          # Configuration
│   ├── config.json       # Project configuration
│   ├── policy.json       # Security/operational rules
│   └── providers.json     # LLM providers

├── .kg/                   # Knowledge graph
├── .summaries/            # AI summaries
├── .sessions/             # Session tracking
├── .logs/                 # Audit logs
│   ├── audit-events.log
│   ├── security-events.log
│   ├── cost-events.log
│   └── ...
└── .obsidian-export/      # Obsidian export
```

## Architecture

KontextMind consists of several packages:

- **packages/core**: Core library with all functionality
- **packages/adapters**: Agent adapters
- **packages/server**: HTTP API server
- **packages/mcp**: MCP server implementation
- **apps/cli**: Command-line interface

## Known Limitations

- MVP parser is basic (TypeScript/JavaScript/Python)
- Knowledge graph is JSON-based (not production database)
- Chatbot mode answers from summaries, not raw code
- Mock provider used by default if no LLM configured
- No web UI yet
- MCP support depends on client compatibility

## Documentation

- [Architecture](docs/architecture.md)
- [CLI Reference](docs/cli.md)
- [Security](docs/security.md)
- [Chatbot Mode](docs/chatbot-mode.md)
- [MCP Server](docs/mcp.md)
- [Obsidian Export](docs/obsidian.md)
- [Roadmap](docs/roadmap.md)

## Contributing

Contributions welcome! Please read the docs and ensure:

```bash
pnpm build
pnpm test
pnpm typecheck
```

## License

MIT

---

**KontextMind — helping AI coding agents understand your project, one context at a time.**