# Obsidian Export

KontextMind can export your project brain to Obsidian-compatible Markdown notes with backlinks.

## Command

```bash
kontextmind obsidian
kontextmind obsidian --clean
kontextmind obsidian --output ./my-notes
kontextmind obsidian --json
```

## Output Structure

```
.obsidian-export/
├── Index.md
├── Project Overview.md
├── Architecture.md
├── Current State.md
├── Handoff.md
├── Files/
│   ├── Index.md
│   ├── src index.ts.md
│   ├── src app.ts.md
│   └── ...
├── Functions/
│   ├── Index.md
│   ├── createUser.md
│   ├── authenticate.md
│   └── ...
├── Modules/
│   ├── Index.md
│   ├── src.md
│   └── ...
├── Dependencies/
│   ├── Index.md
│   ├── express.md
│   └── ...
└── Decisions/
```

## Note Format

### File Note

```markdown
# src/auth/token.ts

Type: File
Language: TypeScript

## Purpose

This module handles JWT token generation and verification.

## Symbols

- [[createAccessToken]]
- [[verifyAccessToken]]

## Dependencies

- [[jsonwebtoken]]
- [[src/config.ts]]

## Related Files

- [[src/auth/middleware.ts]]

## Related

- [[Project Overview]]
```

### Function Note

```markdown
# createAccessToken

Type: Symbol
Kind: function
File: [[src/auth/token.ts]]

## Signature

```
function createAccessToken(user: User): string
```

## Related

- [[src/auth/token.ts]]
```

## Features

### Backlinks
All notes include backlinks to related content.

### Redaction
Secrets are automatically redacted from exported notes.

### No Raw Code
Only summaries and metadata are exported, not raw source code.

### Index Notes
Each directory has an index with links to all notes.

## Integration with Obsidian

1. Open Obsidian
2. Open the `.obsidian-export/` folder as a vault
3. Navigate using links

## Custom Export Directory

```bash
kontextmind obsidian --output ./docs/vault
```

## Clean Export

Remove existing export before creating new one:

```bash
kontextmind obsidian --clean
```