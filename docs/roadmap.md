# Roadmap

## Overview

KontextMind is developed in phases, starting with a minimal foundation and adding capabilities incrementally.

## Phase 1: Foundation and Init ✓

**Status:** Complete

### Included
- CLI application with init, status, doctor commands
- Monorepo structure with packages
- TypeScript configuration
- Template rendering system
- Agent instruction file generation
- Config and policy file generation
- Project-local folder scaffolding

### Deliverables
- Working `kontextmind init` command
- Generated CLAUDE.md, AGENTS.md, README_AI.md
- Generated `.kontextmind/` config files
- Generated `.context/` memory files
- Generated `.mcp/` placeholder config

## Phase 2: Scanner, Index, Hash Tracking

### Planned
- File scanner that walks project directory
- `.toolignore` parsing and matching
- File hash generation (SHA-256)
- File index storage (`.kontextmind/file-index.json`)
- SQLite database for metadata
- Improved `status` command with scan stats
- Improved `doctor` command with index checks
- Git optional metadata detection

### Extension Points
```
packages/core/src/
├── scanner/
│   ├── index.ts
│   ├── walk-tree.ts
│   ├── toolignore.ts
│   └── filter-files.ts
└── indexer/
    ├── index.ts
    ├── file-hash.ts
    └── index-storage.ts
```

## Phase 3: Parser, Symbol Index, Basic Graph

### Planned
- Code parser for JavaScript/TypeScript/Python/Go
- Symbol extraction (functions, classes, interfaces)
- Module dependency detection
- Basic knowledge graph structure
- Node storage (`.kg/nodes/`)
- Edge storage (`.kg/edges/`)

### Extension Points
```
packages/core/src/
├── parser/
│   ├── index.ts
│   ├── javascript.ts
│   ├── python.ts
│   └── types.ts
└── knowledge/
    ├── index.ts
    ├── node-store.ts
    └── edge-store.ts
```

## Phase 4: Summary Engine and Stale Detection

### Planned
- AI-powered file summarization
- Function/method summarization
- Module summarization
- API endpoint summarization
- Decision summarization
- Stale detection for old summaries
- Summary storage (`.summaries/`)

### Extension Points
```
packages/core/src/
├── summarizer/
│   ├── index.ts
│   ├── file-summarizer.ts
│   ├── function-summarizer.ts
│   └── stale-detector.ts
```

## Phase 5: Chatbot Knowledge Base and Ask Command

### Planned
- Natural language Q&A about codebase
- Semantic search over summaries
- Security-safe response generation
- `kontextmind ask` command
- Chatbot knowledge base
- No raw code in responses (configurable)

### Extension Points
```
packages/core/src/
├── chatbot/
│   ├── index.ts
│   ├── qa-engine.ts
│   ├── semantic-search.ts
│   └── response-generator.ts
```

## Phase 6: HTTP API

### Planned
- Local HTTP server
- REST endpoints for:
  - Project status
  - File search
  - Summary retrieval
  - Knowledge graph queries
  - Q&A endpoints
- Authentication (optional)
- CORS configuration

### Extension Points
```
packages/server/src/
├── index.ts
├── routes/
│   ├── project.ts
│   ├── search.ts
│   ├── summaries.ts
│   ├── graph.ts
│   └── qa.ts
└── middleware/
```

## Phase 7: MCP Server

### Planned
- Model Context Protocol server
- stdio transport
- HTTP transport (optional)
- Tool implementations:
  - project.status
  - project.search
  - project.get_file_summary
  - project.get_symbol_summary
  - project.find_dependencies
  - project.find_callers
  - project.ask_readonly
  - project.create_handoff
- Resource handlers
- Prompt templates

### Extension Points
```
packages/mcp/src/
├── index.ts
├── tools/
├── resources/
├── prompts/
└── transport/
```

## Phase 8: Audit, Security, Cost Logs

### Planned
- Structured JSONL logging
- Agent action logging
- File read event logging
- Summary generation logging
- Security event logging
- Q&A event logging
- API event logging
- Cost tracking (token usage)
- Error logging
- Log rotation/retention

### Extension Points
```
packages/core/src/
├── logging/
│   ├── index.ts
│   ├── agent-actions.ts
│   ├── read-events.ts
│   ├── security.ts
│   └── cost-tracking.ts
```

## Phase 9: Obsidian Export

### Planned
- Export to Obsidian-compatible Markdown
- Bidirectional sync (optional)
- Graph view export
- Decision log export
- Handoff export

### Extension Points
```
packages/export/
├── index.ts
├── obsidian.ts
└── graph-export.ts
```

## Phase 10: Polish, Docs, Examples

### Planned
- Comprehensive documentation
- Tutorial guides
- Example projects
- Video demonstrations
- Community templates
- CI/CD integrations
- IDE extensions

## Implementation Notes

### Each Phase Should:
1. Build successfully
2. Pass all tests
3. Not break previous phases
4. Extend, not replace, existing functionality
5. Be verifiable with acceptance criteria

### Extension Points Are:
- Directory structures for new packages/modules
- Interfaces/types for future implementations
- Placeholder functions that throw "coming in Phase X"
- Configuration options in schema

### Phase Transitions Should:
1. Run existing tests to ensure nothing broke
2. Add new tests for new functionality
3. Update documentation
4. Create migration guide if needed