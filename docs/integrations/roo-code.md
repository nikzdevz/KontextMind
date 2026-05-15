# Roo Code Integration

KontextMind supports Roo Code through the Model Context Protocol (MCP). Roo Code can load a project-level MCP config from `.roo/mcp.json`, so this repo ships a ready-to-use project config plus optional Roo custom modes in `.roomodes`.

> Note: the checked-in source-tree config assumes you have run `pnpm build` so `apps/cli/dist/index.js` exists. If KontextMind is later published as an npm package, you can switch the command to `npx -y kontextmind mcp --mode full-agent`.

## Recommended project config

File: `.roo/mcp.json`

```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "node",
      "args": ["apps/cli/dist/index.js", "mcp", "--mode", "full-agent"],
      "env": {
        "DATA_DIR": ".kontextmind"
      },
      "alwaysAllow": [
        "project.status",
        "project.search",
        "project.get_file_summary",
        "project.get_symbol_summary",
        "project.find_dependencies",
        "project.find_callers",
        "project.find_related_files",
        "project.ask_readonly",
        "project.get_recent_tasks",
        "project.get_last_session",
        "project.get_session_index",
        "project.get_session_stats",
        "project.search_sessions",
        "project.get_recent_activity",
        "project.get_continuity_suggestions",
        "project.analyze_continuity"
      ],
      "timeout": 60,
      "disabled": false
    }
  }
}
```

## Setup

```bash
pnpm install
pnpm build
kontextmind init --mode full-agent --agents claude,codex,roo,cursor --yes
kontextmind scan
kontextmind index
kontextmind kb --mock
```

Then open Roo Code MCP settings and verify the `kontextmind` server is connected. If Roo cannot find `node` or the relative CLI path, replace `command`/`args` with an absolute local path.

## Custom modes

This repo also provides `.roomodes` with two project modes:

- `kontextmind-research` — read-only architecture, impact, and debugging research with MCP access.
- `kontextmind-implementation` — focused implementation mode with edit, command, and MCP access for validation.

Project-specific rules live in `.roo/rules-kontextmind/rules.md`.

## Safe auto-approved tools

The default `alwaysAllow` list intentionally contains read/continuity tools. Write tools such as `project.create_handoff`, `project.write_task_summary`, and `project.write_session_summary` are available from the MCP server in `full-agent` mode, but are not auto-approved by default. Add them only for trusted workspaces.

## Troubleshooting

### Server starts but tools do not appear

Run:

```bash
pnpm build
node apps/cli/dist/index.js mcp --mode full-agent
```

If the command fails, fix the local build before reconnecting Roo.

### Project not initialized

Run:

```bash
kontextmind init --mode full-agent --agents claude,codex,roo,cursor --yes
```

### Use globally installed CLI instead

If `kontextmind` is installed globally, this shorter config also works:

```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "kontextmind",
      "args": ["mcp", "--mode", "full-agent"],
      "env": { "DATA_DIR": ".kontextmind" },
      "timeout": 60,
      "disabled": false
    }
  }
}
```

## Security notes

- Use `readonly` mode for unfamiliar projects.
- Keep `DATA_DIR` project-local unless you intentionally want shared state.
- Do not commit `.env` or provider secrets.
- Review `alwaysAllow` before enabling write tools.
