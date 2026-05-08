# 02 — Phase 2 Prompt: Scanner, File Index, Hash Tracking, Toolignore, Optional Git

You are continuing the KontextMind implementation.

Phase 1 is already complete. Do not restructure the repository. Build on the existing Phase 1 modules.

This prompt is for **PHASE 2 ONLY**.

## Phase 2 Goal

Implement the project scanner and file index system.

Phase 2 should add:

1. `kontextmind scan`
2. Real `.toolignore` matching
3. File discovery
4. File metadata collection
5. SHA-256 file hash generation
6. File language detection
7. Large file skipping
8. Secret-sensitive file skipping
9. Optional Git detection
10. `file-index.json`
11. Improved status command
12. Improved doctor command
13. Tests for scanner and file ignore behavior

Do not implement symbol parsing, knowledge graph, summaries, MCP server, HTTP server, chatbot KB, or Obsidian export yet.

## New CLI Command

Implement:

```bash
kontextmind scan
```

Options:

```bash
--changed-only
--include <path>
--exclude <path>
--json
```

Behavior:

1. Ensure project is initialized.
2. Load `.kontextmind/config.json`.
3. Load `.toolignore`.
4. Walk project directory recursively.
5. Skip ignored paths.
6. Skip heavy/vendor folders.
7. Skip secrets and sensitive files.
8. Skip files larger than configured limit.
9. Compute SHA-256 hash.
10. Detect language.
11. Store index to `.kg/file-index.json`.
12. Update `.kontextmind/registry.json`.
13. Write scan events to `.logs/agent-actions.log` or `.logs/read-events.log`.

## File Index Format

Generate `.kg/file-index.json`:

```json
{
  "version": "1",
  "generated_at": "ISO_DATE",
  "project": "PROJECT_NAME",
  "root": ".",
  "total_files_seen": 0,
  "indexed_files": 0,
  "ignored_files": 0,
  "large_files_skipped": 0,
  "secret_sensitive_files_skipped": 0,
  "files": [
    {
      "path": "src/index.ts",
      "language": "typescript",
      "size_bytes": 1234,
      "hash": "sha256...",
      "modified_at": "ISO_DATE",
      "indexed_at": "ISO_DATE",
      "summary_status": "missing",
      "ignored": false,
      "ignore_reason": null
    }
  ],
  "ignored": [
    {
      "path": ".env",
      "reason": "secret-sensitive"
    }
  ]
}
```

## Ignore Rules

Respect `.toolignore`.

Always skip by default:

```text
.git/
node_modules/
venv/
.venv/
dist/
build/
coverage/
target/
vendor/
.env
.env.*
*.pem
*.key
*.crt
id_rsa
id_rsa.pub
credentials.json
secrets/
*.min.js
.DS_Store
.cache/
tmp/
temp/
```

Use a reliable glob library such as `ignore` or `minimatch`.

## Secret-Sensitive File Rules

Do not index files like:

```text
.env
.env.production
*.pem
*.key
*.crt
id_rsa
credentials.json
secrets/*
```

In Phase 2, do not implement deep secret scanning yet. Only skip sensitive paths and names.

Deep secret scanning comes in Phase 8.

## Language Detection

Detect common languages by extension:

```text
.ts -> typescript
.tsx -> typescript-react
.js -> javascript
.jsx -> javascript-react
.py -> python
.go -> go
.java -> java
.rb -> ruby
.php -> php
.cs -> csharp
rs -> rust
json -> json
yaml/yml -> yaml
md -> markdown
html -> html
css -> css
sh -> shell
```

Unknown should be `unknown`.

## Changed-Only Behavior

If `.kg/file-index.json` exists and `--changed-only` is passed:

- Reuse unchanged file records if hash is same.
- Reindex changed files.
- Mark missing/deleted files as removed or omit them with count.
- Do not fail if previous file index is missing.

## Optional Git

Git must remain optional.

If `.git` exists:

- Mark git available true.
- Capture current branch if possible.
- Capture latest commit hash if possible.

If Git does not exist:

- Continue normally.
- Use file hashes for change tracking.

Do not require Git CLI to be available.

## Improved Status

Update `kontextmind status` to show:

- Initialized
- Project
- Mode
- Phase
- Git mode
- Git available
- Files indexed
- Ignored files
- Last scan time
- File index status
- Scanner phase ready

Support `--json`.

## Improved Doctor

Update `kontextmind doctor` to check:

- `.kg/file-index.json` exists
- file-index format valid
- `.toolignore` loaded
- last scan exists
- warn if no scan has been run
- warn if file index has zero files

## Core Modules to Add

In `packages/core/src/scanner/`:

```text
scan-project.ts
walk-files.ts
ignore-rules.ts
language-detect.ts
hash-file.ts
file-index.ts
git-info.ts
```

Add relevant types.

## Tests

Unit tests:

- ignore matching
- language detection
- hash generation
- file index serialization
- git detection fallback

Integration tests:

- scan a fixture project
- skip node_modules
- skip .env
- skip large files
- create `.kg/file-index.json`
- changed-only reuses unchanged records

## Acceptance Criteria

These must work:

```bash
pnpm build
pnpm test
kontextmind init --yes
kontextmind scan
kontextmind status
kontextmind doctor
```

Expected:

- `.kg/file-index.json` created
- secrets skipped
- `.toolignore` respected
- status shows indexed file count
- doctor validates Phase 2 health

At the end, summarize implementation and mention that Phase 3 can now add parser, symbol index, and basic graph.
