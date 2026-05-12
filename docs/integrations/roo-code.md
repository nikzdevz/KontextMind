# Roo Code (Cline) Integration

Guide for configuring KontextMind MCP server with [Roo Code](https://github.com/RooCodeInc/Roo-Code) (formerly Roo Code for VS Code).

## What is Roo Code?

Roo Code is an AI coding agent for VS Code that utilizes MCP servers for enhanced capabilities. It was previously known as "Roo Code for VS Code" or "roo-cline".

## Configuration

### Option 1: Via VS Code Settings UI

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for "Roo Code" or "MCP"
3. Find "Roo: Mpc Servers" or "MCP Settings"
4. Click "Edit in settings.json"

### Option 2: Direct File Edit

The configuration file is located at:
```
c:\Users\<username>\AppData\Roaming\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\mcp_settings.json
```

Add this configuration:

```json
{
	"mcpServers": {
		"kontextmind": {
			"command": "npx",
			"args": [
				"kontextmind",
				"mcp",
				"--mode",
				"full-agent"
			],
			"alwaysAllow": [
				"project.status",
				"project.search",
				"project.get_file_summary",
				"project.get_symbol_summary",
				"project.find_dependencies",
				"project.find_callers",
				"project.find_related_files",
				"project.ask_readonly",
				"project.create_handoff",
				"project.refresh_summary",
				"project.security_scan"
			]
		}
	}
}
```

## Mode Options

| Mode | Description | Use Case |
|------|-------------|----------|
| `readonly` | No file modifications | Exploration, documentation |
| `chatbot-readonly` | Q&A only, no code | Learning, code review |
| `suggest` | Suggestions without implementation | Code review |
| `edit-with-approval` | Requires explicit approval | Controlled development |
| `full-agent` | Full autonomy | Experienced users, trusted projects |

## Available MCP Tools

When connected, Roo Code can use these KontextMind tools:

| Tool | Description | Always Allowed |
|------|-------------|----------------|
| `project.status` | Get project status | Yes |
| `project.search` | Search files/symbols | Yes |
| `project.get_file_summary` | Get file summary | Yes |
| `project.get_symbol_summary` | Get symbol info | Yes |
| `project.find_dependencies` | Find dependencies | Yes |
| `project.find_callers` | Find function callers | Yes |
| `project.find_related_files` | Find related files | Yes |
| `project.ask_readonly` | Ask questions (no code) | Yes |
| `project.create_handoff` | Create handoff doc | Yes |
| `project.refresh_summary` | Refresh stale summaries | Yes |
| `project.security_scan` | Scan for security issues | Yes |

## Setup Commands

After configuring, run these commands in Roo Code:

```bash
# Initialize project (if not already)
kontextmind init --mode full-agent --yes

# Index the project
kontextmind scan
kontextmind index

# Build knowledge base
kontextmind kb build --mock

# Learn the project
kontextmind summarize --mock
```

## Troubleshooting

### "Command not found" Error

If you get `npx: command not found` or similar:

**Solution 1:** Use full path to node/pnpm
```json
{
	"mcpServers": {
		"kontextmind": {
			"command": "node",
			"args": [
				"C:/Users/nikzdevz/AppData/Local/pnpm/global/5/node_modules/@kontextmind/cli/dist/index.js",
				"mcp",
				"--mode",
				"full-agent"
			]
		}
	}
}
```

**Solution 2:** Use pnpm dlx
```json
{
	"mcpServers": {
		"kontextmind": {
			"command": "pnpm",
			"args": [
				"dlx",
				"kontextmind",
				"mcp",
				"--mode",
				"full-agent"
			]
		}
	}
}
```

### Timeout Error (-32001)

Ensure you rebuilt the CLI after recent fixes:
```bash
cd d:\Projects\KontextMind
pnpm build
cd apps/cli
pnpm link --global
```

### NPM Config Warnings

If you see `auto-install-peers` warnings, rename `.npmrc` to `.pnpmrc`:
```bash
cd d:\Projects\KontextMind
mv .npmrc .pnpmrc
```

## Recommended Workflow with Roo Code

### New Project Setup
```
1. Open project folder in VS Code
2. Tell Roo Code:
   "Initialize KontextMind: run kontextmind init --mode full-agent --yes"
3. Tell Roo Code:
   "Run: kontextmind scan && kontextmind index && kontextmind kb build --mock"
4. Ask Roo Code:
   "What is this project about? Analyze the architecture."
```

### Daily Development
```
1. Start session with:
   "Read .context/handoff.md for project status"
2. Work on your task
3. End session with:
   "Update .context/handoff.md with what we accomplished"
```

### Project Learning
```
1. Tell Roo Code:
   "Read .context/boot-prompt.md and follow the instructions to learn this project"
2. This will:
   - Scan all files
   - Index symbols
   - Build knowledge base
   - Create project documentation
   - Provide comprehensive project overview
```

## Security Considerations

- **full-agent mode** allows file modifications - use only in trusted projects
- **readonly mode** is recommended for exploring new/unfamiliar codebases
- Review the `alwaysAllow` list and adjust based on your security needs
- All actions are logged in `.logs/` directory

## Getting Help

- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - General setup guide
- [.context/boot-prompt.md](../.context/boot-prompt.md) - Project learning guide
- [docs/mcp.md](../mcp.md) - MCP server documentation