# KontextMind

**The Shared Project Brain for AI Coding Agents**

KontextMind is a CLI tool and HTTP API server that provides AI coding agents with a centralized knowledge base about your project. It indexes code, generates summaries, builds knowledge graphs, and enables Q&A functionality—all designed to help AI assistants understand and work with your codebase more effectively.

## Features

### Core Capabilities

- **Code Indexing** — Scans project files and builds a comprehensive file index with change detection
- **Symbol Extraction** — Parses code to extract functions, classes, interfaces, and their relationships
- **AI Summaries** — Generates natural language summaries for files, functions, and modules using LLM providers
- **Knowledge Graph** — Builds a graph of project entities and their dependencies
- **Chatbot KB** — A knowledge base that answers questions about your project without revealing code
- **Session Management** — Multi-turn conversations with persistent context
- **Dataset Preparation** — Export training-ready datasets from Q&A interactions

### Security & Privacy

- **No Code Exposure** — The chatbot never reveals source code, file paths, or directory structures
- **Secret Scanning** — Detects secrets and credentials committed to the repository
- **Privacy-First** — Designed to protect sensitive project information

### Integration Points

- **CLI** — Full-featured command-line interface
- **HTTP API** — REST API server for frontend applications
- **MCP Server** — Model Context Protocol server for AI agent integration

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/kontextmind.git
cd kontextmind

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Link CLI globally (optional)
pnpm link -g
```

### Requirements

- Node.js 18+
- pnpm 8+
- For AI features: An LLM provider (OpenAI, Anthropic, Ollama, or custom)

---

## Quick Start

### 1. Initialize a Project

```bash
cd your-project
kontextmind init
```

This creates:
- `.kontextmind/config.json` — Project configuration
- `CLAUDE.md` — Context for AI assistants
- `AGENTS.md` — Agent-specific instructions
- Policy and instruction files

### 2. Index Your Project

```bash
# Scan files and build index
kontextmind scan

# Extract symbols and build knowledge graph
kontextmind index

# Generate AI summaries (requires LLM provider)
kontextmind summarize --mock    # Use mock provider
kontextmind summarize           # Use configured provider
```

### 3. Build the Knowledge Base

```bash
# Build chatbot knowledge base
kontextmind kb build
```

### 4. Ask Questions

```bash
# Simple Q&A
kontextmind ask "What is this project about?"

# With JSON output
kontextmind ask "How does authentication work?" --json

# Session-based chat
kontextmind session create
kontextmind session chat <session-id> "What files handle user authentication?"
```

### 5. Start API Server

```bash
# Start HTTP API server
kontextmind serve --port 7331

# Or with custom settings
kontextmind serve --port 8080 --host 0.0.0.0
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                          │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────────────────┐  │
│  │   CLI  │  │ HTTP API │  │ MCP CLI │  │  Frontend / AI Agent   │  │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └───────────┬───────────┘  │
└───────┼───────────┼─────────────┼─────────────────────┼─────────────┘
        │           │            │                   │
        ▼           ▼            ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Core Package (@kontextmind/core)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │
│  │   Scanner    │  │   Parser    │  │  Summaries  │  │ Chatbot │  │
│  │   Index      │  │  Symbols    │  │  Knowledge  │  │   KB    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │
│  │   Session    │  │   Dataset    │  │   Security   │  │   Init  │  │
│  │   Manager    │  │   Pipeline   │  │   Audit     │  │  Config │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Packages

| Package | Description |
|---------|-------------|
| `@kontextmind/core` | Core functionality: scanner, parser, summaries, chatbot KB |
| `@kontextmind/cli` | Command-line interface |
| `@kontextmind/server` | HTTP API server |
| `@kontextmind/mcp` | MCP (Model Context Protocol) server |
| `@kontextmind/client` | JavaScript client library |

---

## Project Structure

```
kontextmind/
├── apps/
│   └── cli/                    # Command-line interface
├── packages/
│   ├── core/                   # Core functionality
│   │   └── src/
│   │       ├── chatbot/        # Chatbot knowledge base
│   │       │   ├── session-manager.ts   # Session management
│   │       │   ├── context-builder.ts  # Context building
│   │       │   └── kb-builder.ts       # Knowledge base builder
│   │       ├── dataset/        # Dataset preparation
│   │       │   ├── collector.ts        # Data collection
│   │       │   ├── quality-filter.ts  # Quality filtering
│   │       │   ├── versioning.ts       # Version control
│   │       │   └── formats/           # Export formats
│   │       ├── config/         # Configuration schemas
│   │       ├── filesystem/     # File utilities
│   │       ├── init/          # Project initialization
│   │       ├── obsidian/      # Obsidian export
│   │       ├── parser/        # Code parsing
│   │       ├── providers/     # LLM providers
│   │       ├── scanner/       # File scanning
│   │       ├── security/      # Security audit
│   │       ├── summaries/     # AI summaries
│   │       └── templates/     # Template rendering
│   ├── server/               # HTTP API server
│   │   └── src/
│   │       ├── routes/       # API routes
│   │       │   ├── ask.ts           # Ask endpoints
│   │       │   ├── sessions.ts      # Session endpoints
│   │       │   ├── feedback.ts      # Feedback endpoints
│   │       │   └── dataset.ts       # Dataset endpoints
│   │       └── services/     # Business logic
│   │           ├── ask-service.ts
│   │           ├── session-service.ts
│   │           ├── feedback-service.ts
│   │           └── dataset-service.ts
│   ├── mcp/                  # MCP server
│   ├── adapters/             # Provider adapters
│   └── client/               # Client library
├── docs/                    # Documentation
│   ├── cli-reference.md     # CLI commands reference
│   └── api-reference.md     # API endpoints reference
└── templates/               # Project templates
```

---

## Configuration

### Project Configuration (.kontextmind/config.json)

```json
{
  "project": {
    "name": "my-project",
    "description": "Description of what this project does"
  },
  "mode": "readonly",
  "phase": 1,
  "agents": ["claude", "cursor", "copilot"],
  "git": {
    "enabled": true,
    "mode": "auto"
  }
}
```

### Providers Configuration (.kontextmind/providers.json)

```json
{
  "selected_provider": "openai",
  "providers": {
    "openai": {
      "type": "openai",
      "api_key_env": "OPENAI_API_KEY",
      "model": "gpt-4"
    },
    "ollama": {
      "type": "ollama",
      "base_url": "http://localhost:11434",
      "model": "llama3"
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_DIR` | Directory for project data | `/kontextmind/projects` |
| `LOG_LEVEL` | Logging level | `info` |

---

## Modes

KontextMind operates in four modes:

| Mode | File Modifications | Description |
|------|-------------------|-------------|
| `readonly` | Prohibited | Summaries and context only |
| `suggest` | Prohibited | Suggestions without implementation |
| `edit-with-approval` | Requires approval | Implement with explicit approval |
| `full-agent` | Allowed | Act autonomously within policy |

---

## Session-Based Chat

KontextMind supports multi-turn conversations with persistent context.

### How It Works

1. **Create a Session** — Each conversation gets a unique ID
2. **Build Context** — The system tracks topics, entities, and conversation history
3. **Enhanced Responses** — Questions are answered with conversation context
4. **Link to Dataset** — Session data enriches the training dataset

### Benefits

- **No Context Repeating** — Users don't need to re-explain the project
- **Better Answers** — The LLM has conversation history
- **Rich Dataset** — Follow-up questions show engagement patterns
- **Topic Tracking** — Sessions track what topics were discussed

### Example Flow

```bash
# Create session
kontextmind session create
# Session created: abc-123-xyz

# Ask first question
kontextmind session chat abc-123-xyz "How does auth work?"
# Returns answer with conversationTurn: 1

# Ask follow-up
kontextmind session chat abc-123-xyz "Show me the relevant files"
# Returns answer with conversationTurn: 2

# List all sessions
kontextmind session list

# View session details
kontextmind session show abc-123-xyz
```

---

## Dataset Preparation

KontextMind collects Q&A interactions for training AI models.

### Data Collection

The system automatically collects:

1. **Q&A Events** — Questions and answers with metadata
2. **Feedback** — Like/dislike signals from users
3. **Session Data** — Multi-turn conversation context
4. **Quality Scores** — Computed from confidence and feedback

### Quality Filtering

Records are filtered by:

- **Confidence Threshold** — Minimum confidence score (default: 0.5)
- **Source Priority** — API > MCP > CLI (better feedback quality)
- **Code Request Detection** — Auto-negative for code requests
- **Deduplication** — Remove duplicate questions
- **Age Filter** — Records older than 90 days excluded by default

### Export Formats

| Format | Use Case |
|--------|----------|
| `jsonl` | Line-oriented training (Llama, Mistral) |
| `json` | Batch processing |
| `chatml` | Chat-based models |
| `sharegpt` | ShareGPT compatible |

### Version Control

Datasets are versioned for tracking changes:

```bash
# Export dataset
kontextmind dataset export --format jsonl --output dataset.jsonl

# View statistics
kontextmind dataset stats

# Validate quality
kontextmind dataset validate --min-quality 0.6

# List versions
kontextmind dataset version list
```

---

## Security

### No Code Exposure

The chatbot is configured with strict policies:

- **No source code** in responses
- **No file paths** or directory structures
- **No code formatting** in output

### Secret Scanning

```bash
# Scan for secrets
kontextmind secrets --fail-on-critical

# Output as JSON
kontextmind secrets --json
```

### Audit Logging

```bash
# View audit summary
kontextmind audit --since 24h

# Export audit log
kontextmind audit --json
```

---

## MCP Server

KontextMind includes an MCP server for AI agent integration.

### Starting MCP Server

```bash
# STDIO transport (default)
kontextmind mcp

# HTTP transport
kontextmind mcp --transport http --port 7332
```

---

## Development

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @kontextmind/core build
```

### Testing

```bash
# Run tests
pnpm test

# Run specific package tests
pnpm --filter @kontextmind/core test
```

---

## Documentation

- [CLI Reference](docs/cli-reference.md) — All CLI commands with examples
- [API Reference](docs/api-reference.md) — All API endpoints with examples

---

## License

MIT
