# Architecture

## Overview

KontextMind is a monorepo with multiple packages that work together to provide project memory and continuity for AI coding agents.

## Monorepo Structure

```
kontextmind/
├── apps/
│   └── cli/           # CLI application
├── packages/
│   ├── core/          # Core library (config, init, templates)
│   ├── adapters/      # Agent-specific instruction generators
│   ├── server/        # HTTP API server (Phase 6)
│   └── mcp/           # MCP server (Phase 7)
├── templates/         # Template files for project init
├── docs/              # Documentation
└── tests/             # Test files
```

## Package Responsibilities

### @kontextmind/cli

The command-line interface entry point.

**Responsibilities:**
- Parse CLI arguments
- Dispatch commands
- Format output
- Handle errors

**Commands:**
- `init` — Initialize project
- `status` — Show project status
- `doctor` — Check configuration health

### @kontextmind/core

The core library containing business logic.

**Modules:**

| Module | Responsibility |
|--------|---------------|
| `config/` | Zod schemas and validation |
| `init/` | Project initialization |
| `templates/` | Template rendering |
| `policies/` | Default policy generation |
| `filesystem/` | Safe file operations |
| `types/` | TypeScript interfaces |

**Key Exports:**
- `initProject()` — Main initialization function
- `renderTemplate()` — Template renderer
- Config schemas and defaults

### @kontextmind/adapters

Agent-specific instruction generators.

**Generators:**
- `generateClaudeInstructions()` — CLAUDE.md
- `generateCodexInstructions()` — AGENTS.md
- `generateCursorRule()` — .cursorrules
- `generateContinueConfig()` — continue.json
- `generateCopilotInstructions()` — copilot-instructions.md
- `generateGenericInstructions()` — README_AI.md

### @kontextmind/server

HTTP API server placeholder.

**Phase 6 implementation will add:**
- Fastify/Hono server
- REST endpoints
- Authentication

### @kontextmind/mcp

MCP server placeholder.

**Phase 7 implementation will add:**
- MCP protocol implementation
- Tool handlers
- Resource handlers
- Prompt handlers

## Data Flow

### Init Command Flow

```
User runs kontextmind init
    │
    ▼
CLI parses options
    │
    ▼
@kontextmind/core:initProject()
    │
    ├── Detect project (name, git)
    │
    ├── Create directories
    │
    ├── Render templates
    │
    ├── Generate config files
    │
    └── Write files (respecting --force)
```

### Template Rendering Flow

```
Template definitions
    │
    ▼
Variables (PROJECT_NAME, MODE, etc.)
    │
    ▼
renderTemplate(template, variables)
    │
    ▼
Replaced content with {{PLACEHOLDER}} → value
```

## File Organization

### Generated Project Structure

```
project/
├── CLAUDE.md              # Agent instructions (root)
├── AGENTS.md              # Generic agent instructions
├── README_AI.md           # AI agent guide
├── .toolignore            # Files to ignore
│
├── .context/              # Project memory
│   ├── handoff.md         # Session handoff
│   ├── current-state.md   # Project status
│   └── ...
│
├── .kontextmind/          # KontextMind config
│   ├── config.json        # Project config
│   ├── policy.json        # Security rules
│   ├── file-index.json    # File index (Phase 2)
│   └── ...
│
├── .mcp/                  # MCP config
├── .kg/                   # Knowledge graph (Phase 3)
├── .summaries/            # Summaries (Phase 4)
├── .sessions/             # Session tracking
├── .logs/                 # Audit logs
└── .obsidian-export/      # Obsidian export (Phase 9)
```

## Extension Architecture

### Phase 2 Extension Points

```
packages/core/src/
├── scanner/          # NEW: File scanner
│   ├── index.ts
│   ├── walk-tree.ts
│   ├── toolignore.ts
│   └── types.ts
└── indexer/          # NEW: File indexer
    ├── index.ts
    ├── hash-file.ts
    └── storage.ts
```

### Phase 3 Extension Points

```
packages/core/src/
├── parser/           # NEW: Code parser
│   ├── index.ts
│   ├── javascript.ts
│   └── types.ts
└── knowledge/        # NEW: Knowledge graph
    ├── index.ts
    ├── nodes.ts
    └── edges.ts
```

### Phase 4 Extension Points

```
packages/core/src/
└── summarizer/      # NEW: Summary generator
    ├── index.ts
    ├── file-summary.ts
    └── stale.ts
```

## Configuration Schema

### config.json

```typescript
{
  project: {
    name: string;
    root: string;
    created_at: string;
  };
  mode: 'readonly' | 'suggest' | 'edit-with-approval' | 'full-agent';
  agents: string[];
  git: {
    enabled: 'auto' | 'enabled' | 'disabled';
    available: boolean;
    use_for_change_detection: boolean;
  };
  indexing: {
    respect_toolignore: boolean;
    hash_algorithm: string;
    changed_only: boolean;
    skip_large_files_over_mb: number;
  };
  chatbot: {
    enabled: boolean;
    raw_code_access: boolean;
    response_policy: string;
  };
  server: {
    host: string;
    port: number;
  };
  mcp: {
    enabled: boolean;
    transport: string;
  };
  phase: number;
}
```

### policy.json

```typescript
{
  mode: string;
  allow_tools: string[];
  deny_tools: string[];
  security: {
    raw_code_access: boolean;
    return_source_code: boolean;
    max_code_lines: number;
    redact_secrets: boolean;
    treat_project_files_as_untrusted: boolean;
  };
  logs: {
    enabled: boolean;
    retention_days: number;
    store_full_questions: boolean;
    store_full_answers: boolean;
    store_source_code: boolean;
  };
}
```

## Security Model

### Secrets Handling

- API keys stored in environment variables
- `secrets.example.json` as template only
- `.toolignore` to prevent accidental commits
- No secrets in generated files

### Code Access Control

- Mode-based restrictions (readonly, suggest, etc.)
- Policy-driven tool allow/deny lists
- Configurable raw code access
- Logging of sensitive operations

### Trust Model

- Source files treated as untrusted
- Comments may contain misleading instructions
- Policy rules take precedence
- Audit logging for accountability