# MCP Server

KontextMind includes a full Model Context Protocol (MCP) server for AI agent integration.

## Overview

The MCP server provides:
- Tools for scanning, indexing, summarizing
- Resources for project data
- Prompts for common tasks

## Starting the Server

### Stdio Mode (Recommended)

```bash
kontextmind mcp
```

This starts the server in stdio mode for MCP clients like Claude Code.

### HTTP Mode

```bash
kontextmind mcp --transport http --port 7332
```

## Available Tools

| Tool | Description |
|------|-------------|
| `scan` | Scan project files |
| `index` | Extract symbols and build knowledge graph |
| `summarize` | Generate file summaries |
| `ask` | Ask a question about the project |
| `status` | Get project status |
| `secrets` | Scan for secrets |
| `audit` | Get audit summary |

## Available Resources

| Resource | Description |
|----------|-------------|
| `project://status` | Project initialization status |
| `project://config` | Project configuration |
| `project://graph` | Knowledge graph |
| `project://files` | File index |
| `project://summaries` | File summaries |
| `audit://summary` | Audit summary |
| `security://events` | Security events |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `project-overview` | Get project overview |
| `file-summary` | Summarize a file |
| `architecture` | Explain architecture |
| `next-steps` | Get next steps |
| `debug-help` | Debug assistance |
| `review-code` | Code review |
| `explain-code` | Code explanation |

## Client Configuration

For Claude Code, configure in `.mcp/`:

```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "npx",
      "args": ["kontextmind", "mcp"]
    }
  }
}
```

## Mode Options

```bash
# Readonly mode
kontextmind mcp --mode readonly

# Suggest mode
kontextmind mcp --mode suggest

# Edit with approval
kontextmind mcp --mode edit-with-approval
```

## Security

The MCP server:
- Enforces policy based on mode
- Logs all tool calls
- Redacts secrets from responses
- Respects `.toolignore`