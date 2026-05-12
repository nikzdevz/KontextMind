# 07 — Phase 7 Prompt: MCP Server, Tools, Resources, Prompts

You are continuing KontextMind.

Phases 1–6 are complete.

This prompt is for **PHASE 7 ONLY**.

## Phase 7 Goal

Implement MCP-compatible server integration.

Add:

1. `kontextmind mcp`
2. MCP tool abstraction
3. MCP resources
4. MCP prompts
5. readonly policy checks
6. chatbot-readonly behavior where applicable
7. MCP logs
8. docs for connecting agents

## CLI Command

Implement:

```bash
kontextmind mcp
```

Options:

```bash
--mode readonly|chatbot-readonly|suggest|edit-with-approval
--transport stdio|http
--port 7332
```

Default:

```text
transport: stdio
mode: readonly
```

## MCP Tools

Expose conceptual tools:

```text
project.status
project.search
project.get_file_summary
project.get_symbol_summary
project.find_dependencies
project.find_callers
project.find_related_files
project.ask_readonly
project.create_handoff
project.refresh_summary
project.security_scan
```

In Phase 7, implement fully:

- `project.status`
- `project.search`
- `project.get_file_summary`
- `project.get_symbol_summary`
- `project.find_dependencies`
- `project.ask_readonly`

For tools not fully implemented, return clear "not implemented yet" only if unavoidable.

## MCP Resources

Expose:

```text
kontextmind://project/overview
kontextmind://project/architecture
kontextmind://project/current-state
kontextmind://graph/files
kontextmind://graph/symbols
kontextmind://handoff/latest
kontextmind://summaries/files
```

## MCP Prompts

Expose:

```text
explain_project
resume_last_task
review_impact
answer_without_code
find_bug_area
summarize_module
prepare_handoff
```

## Policy Enforcement

Every MCP tool must check `.kontextmind/policy.json`.

Readonly mode denies:

- write file
- patch file
- delete file
- run command
- install package

Chatbot-readonly denies:

- raw code access
- source code output
- secrets

## Logs

Write `.logs/mcp-events.log`:

- timestamp
- client if available
- tool/resource/prompt
- arguments summary
- result
- mode

Do not log raw source code or secrets.

## Config

Update `.mcp/server.json`, `.mcp/tools.json`, `.mcp/resources.json`, `.mcp/prompts.json`, `.mcp/permissions.json` to reflect implemented capabilities.

## Docs

Create/update:

```text
docs/mcp.md
```

Include:

- what MCP mode does
- how to start MCP server
- available tools/resources/prompts
- security modes
- Claude/Codex/agent usage notes

## Tests

Unit tests:

- MCP tool policy checks
- tool output shapes
- resource resolution
- prompt rendering

Integration tests:

- invoke MCP tool handlers directly
- verify readonly denies write-like tools
- verify ask_readonly uses chatbot/ask engine

## Acceptance Criteria

These work:

```bash
pnpm build
pnpm test
kontextmind mcp --mode readonly
```

And MCP tool handlers can return:

- status
- file summary
- symbol summary
- dependencies
- ask readonly response

At the end, summarize and mention Phase 8 can add deeper security, secret scanner, audit, and cost logs.
