# KontextMind Master Instructions

## Overview

This is the master instruction template that KontextMind uses to generate agent-specific instruction files.

## Variables

- `{{PROJECT_NAME}}` - Project name
- `{{CREATED_AT}}` - ISO timestamp
- `{{MODE}}` - Current mode (readonly, suggest, edit-with-approval, full-agent)
- `{{GIT_MODE}}` - Git integration mode (auto, enabled, disabled)
- `{{GIT_AVAILABLE}}` - Whether git is available (true/false)
- `{{PROVIDER}}` - LLM provider (none, openai, anthropic, ollama, bedrock, openai-compatible)
- `{{AGENTS}}` - Comma-separated agent list
- `{{KONTEXTMIND_VERSION}}` - KontextMind version

## Generated Files

From this template:
- `.kontextmind/instructions.master.md`
- `CLAUDE.md`
- `AGENTS.md`
- `README_AI.md`

## Placeholder Format

Use `{{VARIABLE_NAME}}` format for all variables.