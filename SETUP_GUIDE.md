# KontextMind Setup Guide

A comprehensive guide for initializing KontextMind in any project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Initialization Options](#initialization-options)
4. [Best Practices](#best-practices)
5. [Quick Start for Different Project Types](#quick-start-for-different-project-types)
6. [Auto-Start Setup](#auto-start-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js 20+** - Required for the CLI
- **pnpm** (recommended) or npm/yarn
- **Git** (optional but recommended for version control integration)

### Check Installation

```bash
node --version    # Should be >= 20.0.0
pnpm --version    # Should be installed
git --version     # Optional
```

---

## Installation

### Step 1: Build and Link the CLI

```bash
# Clone or navigate to KontextMind directory
cd d:\Projects\KontextMind

# Install dependencies (if not already done)
pnpm install

# Build all packages
pnpm build

# Link CLI globally
cd apps/cli
pnpm link --global
```

### Step 2: Verify Installation

```bash
kontextmind --version
# Should output: 0.1.0
```

If you get "'kontextmind' is not recognized", create a shortcut:

```powershell
# Windows: Create cmd file in WindowsApps (already in PATH)
@"
@echo off
node "C:\Users\YOUR_USER\AppData\Local\pnpm\global\5\node_modules\@kontextmind\cli\dist\index.js" %*
"@ | Out-File -FilePath "C:\Users\YOUR_USER\AppData\Local\Microsoft\WindowsApps\kontextmind.cmd" -Encoding ASCII

# Replace YOUR_USER with your username
# Then test:
kontextmind --version
```

Or add pnpm global bin to PATH:

```powershell
# Add to PATH (add to $PROFILE for permanent)
$env:PATH += ";C:\Users\YOUR_USER\AppData\Local\pnpm\global\5\node_modules\.bin"
```

---

## Initialization Options

### Basic Initialization

```bash
# Initialize with defaults (readonly mode, all agents)
kontextmind init --yes

# Initialize with specific mode
kontextmind init --mode readonly --yes

# Force overwrite existing files
kontextmind init --force --yes
```

### Initialization Options Reference

| Option | Description | Default |
|--------|-------------|---------|
| `--yes` | Skip prompts and use defaults | false |
| `--force` | Overwrite existing files | false |
| `--agents` | Comma-separated agent list | claude,codex,roo,generic |
| `--mode` | Mode: readonly, suggest, edit-with-approval, full-agent | readonly |
| `--git` | Git integration: auto, enabled, disabled | auto |
| `--provider` | LLM provider: none, openai, anthropic, ollama, openai-compatible | none |

### Mode Options

| Mode | Description | Use Case |
|------|-------------|----------|
| `readonly` | No file modifications allowed | Safe exploration, documentation |
| `suggest` | Suggestions without implementation | Code review, architecture planning |
| `edit-with-approval` | Implementation requires explicit approval | Controlled development |
| `full-agent` | Act autonomously within policy | Experienced teams |

### Agent Support

| Agent | Option Value | Best For |
|-------|--------------|----------|
| Claude Code | `claude` | Claude users |
| Codex | `codex` | OpenAI's Codex |
| Roo Code | `roo` | Roo Code users |
| Cursor | `cursor` | Cursor IDE users |
| Google Antigravity | `antigravity` | Generic agentic IDE workflows |
| Continue | `continue` | Continue.dev users |
| GitHub Copilot | `copilot` | VS Code Copilot |
| Generic | `generic` | Any AI coding agent |

**Example for multiple agents:**
```bash
kontextmind init --agents claude,codex,roo,cursor --yes
```

---

## Best Practices

### 1. Start with Readonly Mode

For new projects or when introducing KontextMind to an existing codebase, start with `readonly` mode:

```bash
kontextmind init --mode readonly --yes
```

This allows AI agents to understand the project structure without making changes.

### 2. Build Knowledge Base Early

After initialization, build the knowledge base for Q&A functionality:

```bash
# Use mock mode (no API key required)
kontextmind kb build --mock

# Or with real LLM
kontextmind kb build
```

### 3. Configure LLM Provider for Summaries

For AI-powered features, configure an LLM provider:

**OpenAI-Compatible (recommended for most cases):**
```bash
# Edit .kontextmind/providers.json
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

**For Local Models (LM Studio, Ollama):**
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

### 4. Index Project Files

After initialization, index the project for symbol and dependency tracking:

```bash
# Index all supported languages
kontextmind index

# Index specific languages only
kontextmind index --language typescript,python

# Only re-index changed files (faster)
kontextmind index --changed-only
```

### 5. Generate Summaries

Generate AI summaries for better Q&A:

```bash
# With mock provider (no API key)
kontextmind summarize --mock

# With real LLM
kontextmind summarize

# Only summarize changed files
kontextmind summarize --changed-only
```

---

## Quick Start for Different Project Types

### TypeScript/JavaScript Project

```bash
kontextmind init --mode readonly --agents claude,codex --yes
kontextmind scan
kontextmind index
kontextmind kb build --mock
```

### Python Project

```bash
kontextmind init --mode readonly --agents claude,codex --yes
kontextmind scan
kontextmind index --language python
kontextmind kb build --mock
```

### Multi-Language Project

```bash
kontextmind init --mode readonly --agents claude,codex,generic --yes
kontextmind scan
kontextmind index --language typescript,python,go
kontextmind kb build --mock
```

### New Project (with full-agent mode)

```bash
kontextmind init --mode full-agent --agents claude --yes
kontextmind scan
kontextmind index
kontextmind summarize --mock
```

### Production Project (strict mode)

```bash
kontextmind init --mode readonly --agents claude --git enabled --yes
kontextmind scan
kontextmind index
kontextmind kb build
kontextmind audit --since 24h
```

---

## Auto-Start Setup

### Windows Task Scheduler Setup

```powershell
# Run from KontextMind directory
cd d:\Projects\KontextMind\startup

# Register auto-start
.\setup-autostart.ps1

# Verify registration
Get-ScheduledTask -TaskName "KontextMind-MCP-AutoStart"
```

### Remove Auto-Start

```powershell
.\setup-autostart.ps1 -Remove
```

### Manual Startup

```bash
# Start MCP server (stdio mode for MCP clients)
kontextmind mcp --mode readonly

# Start HTTP API server
kontextmind serve --port 7331 --host 127.0.0.1 --mode readonly

# Start MCP server in HTTP mode
kontextmind mcp --transport http --port 7332 --mode readonly
```

---

## Configuration Files

After initialization, these files are created:

```
project/
├── CLAUDE.md              # Claude Code instructions
├── AGENTS.md              # Generic agent instructions
├── README_AI.md           # AI agent guide
├── .mcp.json              # Claude/generic MCP project config
├── .roo/mcp.json          # Roo Code MCP project config
├── .roomodes              # Roo Code project modes
├── .codex/config.toml     # Codex project MCP config
├── .cursor/mcp.json       # Cursor MCP project config
├── .toolignore            # Files to ignore

├── .context/               # Project memory
│   ├── handoff.md         # Session handoff
│   ├── current-state.md   # Project status
│   └── agent-policy.md    # Agent policy

├── .kontextmind/           # Configuration
│   ├── config.json        # Project configuration
│   ├── policy.json        # Security/operational rules
│   ├── providers.json     # LLM providers
│   └── chatbot/           # Chatbot knowledge base
│       ├── project-overview.md
│       ├── architecture.md
│       └── ...

├── .kg/                    # Knowledge graph
├── .summaries/             # AI summaries
├── .sessions/              # Session tracking
├── .logs/                  # Audit logs
└── .mcp/                   # MCP server config
```

---

## Workflow Examples

### Daily Development Workflow

```bash
# Morning: Check project status
kontextmind status

# Ask questions about code
kontextmind ask "What does the authentication module do?"

# After making changes
kontextmind scan --changed-only
kontextmind summarize --changed-only
kontextmind audit --since 24h
```

### Code Review Workflow

```bash
# Check project overview
kontextmind ask "What is the main architecture of this project?"

# Search for specific patterns
kontextmind scan --include src/api/

# Review security
kontextmind secrets scan

# View recent activity
kontextmind audit --since 7d
```

### Handoff Workflow

```bash
# End of session: Update handoff
# Edit .context/handoff.md with:
# - What was done
# - What remains
# - Next steps

# Check knowledge base is up to date
kontextmind kb build --mock
```

---

## Troubleshooting

### "KontextMind is not initialized"

```bash
kontextmind init --yes
```

### "Command not found"

```bash
# Re-link the CLI
cd d:\Projects\KontextMind\apps\cli
pnpm link --global

# Or use full path
"C:/Users/nikzdevz/AppData/Local/pnpm/global/5/node_modules/.bin/kontextmind.CMD" --version
```

### Build Errors

```bash
# Clean and rebuild
cd d:\Projects\KontextMind
pnpm clean
pnpm install
pnpm build
```

### MCP Server Not Starting

```bash
# Check initialization status
kontextmind status

# Verify MCP server config
cat .mcp.json

# Try stdio mode directly
kontextmind mcp --mode readonly
```

### Provider Configuration Issues

```bash
# Verify providers.json syntax
cat .kontextmind/providers.json | jq .

# Test with mock mode
kontextmind kb build --mock
```

---

## Next Steps

After initialization:

1. **Build knowledge base**: `kontextmind kb build --mock`
2. **Ask questions**: `kontextmind ask "What is this project about?"`
3. **Start MCP server**: `kontextmind mcp`
4. **View status**: `kontextmind status`
5. **Run health check**: `kontextmind doctor`

---

## Additional Resources

- [README.md](README.md) - Full project documentation
- [docs/architecture.md](docs/architecture.md) - Architecture details
- [docs/mcp.md](docs/mcp.md) - MCP server documentation
- [docs/chatbot-mode.md](docs/chatbot-mode.md) - Chatbot Q&A guide
