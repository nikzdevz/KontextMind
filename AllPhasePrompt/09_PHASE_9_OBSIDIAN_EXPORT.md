# 09 — Phase 9 Prompt: Obsidian Export and Human Knowledge Notes

You are continuing KontextMind.

Phases 1–8 are complete.

This prompt is for **PHASE 9 ONLY**.

## Phase 9 Goal

Implement Obsidian-style export so humans can browse the project brain.

Add:

1. `kontextmind obsidian export`
2. Markdown export from project overview
3. Markdown export from file summaries
4. Markdown export from function summaries
5. Markdown export from API/graph/dependency data
6. Backlinks between notes
7. Decision/task/handoff notes
8. Status/doctor improvements

## CLI Command

Implement:

```bash
kontextmind obsidian export
```

Options:

```bash
--output .obsidian-export
--clean
--json
```

Output:

```text
.obsidian-export/
├── Project Overview.md
├── Architecture.md
├── Current State.md
├── Handoff.md
├── Files/
├── Functions/
├── APIs/
├── Modules/
├── Dependencies/
├── Decisions/
└── Index.md
```

## Note Style

Use Obsidian backlinks.

File note example:

```markdown
# src/auth/token.ts

Type: File
Language: TypeScript

## Purpose

...

## Symbols

- [[createAccessToken]]
- [[verifyAccessToken]]

## Dependencies

- [[jsonwebtoken]]
- [[src/config.ts]]

## Related Files

- [[src/auth/middleware.ts]]
```

Function note example:

```markdown
# createAccessToken

Type: Function
File: [[src/auth/token.ts]]

## Purpose

...

## Related Files

...
```

## Sanitization

Convert unsafe file paths to safe note names.

Do not include raw source code.

Do not include secrets.

Apply redaction.

## Index Note

Create `Index.md` linking to:

- Project Overview
- Architecture
- Files
- Functions
- APIs
- Dependencies
- Decisions
- Handoff

## Status/Doctor

Status should show:

- Obsidian export ready/not ready
- Last export time

Doctor should check export folder and warn if missing.

## Tests

Unit tests:

- backlink generation
- safe note names
- markdown rendering
- redaction before export

Integration tests:

- init + scan + index + summarize + obsidian export
- files exported
- index generated
- no code blocks/raw source included

## Acceptance Criteria

These work:

```bash
pnpm build
pnpm test
kontextmind obsidian export
```

Expected:

- `.obsidian-export/` generated
- notes contain backlinks
- no raw source code
- redaction applied

At the end, summarize and mention Phase 10 can polish docs, examples, packaging, and release readiness.
