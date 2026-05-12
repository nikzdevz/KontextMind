# 03 — Phase 3 Prompt: Parser, Symbol Index, Dependency Index, Basic Knowledge Graph

You are continuing KontextMind implementation.

Phase 1 and Phase 2 are complete. Build on the current repository.

This prompt is for **PHASE 3 ONLY**.

## Phase 3 Goal

Implement code parsing, symbol extraction, dependency indexing, and the first version of the knowledge graph.

Add:

1. `kontextmind index`
2. Parser abstraction
3. TypeScript/JavaScript parser support
4. Basic Python parser support if practical
5. Symbol extraction
6. Import/export extraction
7. Dependency index
8. Basic graph nodes and edges
9. `.kg/symbol-index.json`
10. `.kg/dependency-index.json`
11. `.kg/graph.json`
12. Improved status/doctor

Do not implement LLM summaries yet. That is Phase 4.

## CLI Command

Implement:

```bash
kontextmind index
```

Options:

```bash
--changed-only
--language typescript,javascript,python,go
--json
```

Behavior:

1. Ensure project initialized.
2. Ensure `.kg/file-index.json` exists; if missing, tell user to run `kontextmind scan`.
3. Load indexed files.
4. Parse supported files.
5. Extract symbols.
6. Extract imports/exports.
7. Create dependency relationships.
8. Write symbol/dependency/graph indexes.
9. Log index events.

## Parser Design

Create parser abstraction:

```ts
interface CodeParser {
  supports(language: string): boolean;
  parse(file: IndexedFile, content: string): ParsedFile;
}
```

`ParsedFile` should include:

```ts
{
  filePath: string;
  language: string;
  imports: ImportRecord[];
  exports: ExportRecord[];
  symbols: SymbolRecord[];
  envReads: string[];
  apiRoutes: ApiRouteRecord[];
}
```

## MVP Symbol Extraction

For TypeScript/JavaScript extract:

- function declarations
- arrow function variable declarations
- class declarations
- methods if practical
- exported functions/classes
- import statements
- require statements
- basic Express routes if practical:
  - `app.get`
  - `router.get`
  - `router.post`
  - etc.

For Python extract basic:

- `def`
- `class`
- `import`
- `from x import y`

If parser limitations exist, use regex fallback and document it.

## Symbol Index

Write `.kg/symbol-index.json`:

```json
{
  "version": "1",
  "generated_at": "ISO_DATE",
  "symbols": [
    {
      "id": "symbol_id",
      "name": "getUser",
      "kind": "function",
      "file_path": "src/user.ts",
      "language": "typescript",
      "start_line": 10,
      "end_line": 25,
      "signature": "getUser(id)",
      "exported": true,
      "summary_status": "missing"
    }
  ]
}
```

## Dependency Index

Write `.kg/dependency-index.json`:

```json
{
  "version": "1",
  "generated_at": "ISO_DATE",
  "dependencies": [
    {
      "source_file": "src/index.ts",
      "target": "express",
      "kind": "package-import"
    },
    {
      "source_file": "src/routes.ts",
      "target": "src/controllers/user.ts",
      "kind": "local-import"
    }
  ]
}
```

## Graph Design

Write `.kg/graph.json`:

Nodes:

- Project
- Directory
- File
- Function
- Class
- Package
- API Endpoint
- Environment Variable

Edges:

- CONTAINS
- IMPORTS
- EXPORTS
- DEPENDS_ON
- EXPOSES_API
- READS_ENV

For MVP graph, JSON is enough.

## Status Update

Show:

- Files indexed
- Symbols indexed
- Dependencies indexed
- Graph nodes
- Graph edges
- Last index time

## Doctor Update

Check:

- `.kg/symbol-index.json`
- `.kg/dependency-index.json`
- `.kg/graph.json`
- warn if no index run
- warn if no symbols found

## Tests

Unit tests:

- JS/TS function extraction
- JS/TS import extraction
- Python def/class extraction
- graph node creation
- graph edge creation

Integration tests:

- scan + index fixture project
- generate symbol index
- generate dependency index
- generate graph

## Acceptance Criteria

These must work:

```bash
pnpm build
pnpm test
kontextmind init --yes
kontextmind scan
kontextmind index
kontextmind status
kontextmind doctor
```

Expected:

- symbol index created
- dependency index created
- graph created
- status shows symbols and graph stats
- no LLM required

At the end, summarize and mention Phase 4 can now add summary engine and stale detection.
