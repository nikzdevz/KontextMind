# 04 — Phase 4 Prompt: Summary Engine, Mock Provider, Stale Detection

You are continuing KontextMind.

Phases 1, 2, and 3 are complete.

This prompt is for **PHASE 4 ONLY**.

## Phase 4 Goal

Implement file/function/module summary generation and stale detection.

Add:

1. `kontextmind summarize`
2. Provider abstraction
3. Mock provider
4. Optional real provider placeholders
5. File-level summaries
6. Function-level summaries
7. Module-level summaries
8. Summary freshness/stale detection
9. `.summaries/` output
10. Summary metadata stored in JSON
11. Status/doctor improvements

Do not implement chatbot KB yet. That is Phase 5.

## CLI Command

Implement:

```bash
kontextmind summarize
```

Options:

```bash
--changed-only
--provider <provider>
--model <model>
--dry-run
--mock
--max-files <number>
--json
```

Behavior:

1. Ensure initialized.
2. Ensure scan and index have been run.
3. Load file index and symbol index.
4. Generate summaries.
5. Use mock provider if no provider configured.
6. Do not fail when no API key exists.
7. Store summaries under `.summaries/`.
8. Mark summaries as fresh/stale/missing/failed.
9. Log summary events and cost events.

## Provider Interface

Create:

```ts
interface ModelProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}
```

Implement:

- `MockProvider`
- `OpenAICompatibleProvider` placeholder
- `AnthropicProvider` placeholder
- `OllamaProvider` placeholder

Only MockProvider must fully work in Phase 4.

## Summary Files

For each file:

```text
.summaries/files/<safe-file-path>.json
```

Example:

```json
{
  "target_type": "file",
  "file_path": "src/auth/token.ts",
  "hash": "sha256...",
  "language": "typescript",
  "summary_status": "fresh",
  "provider": "mock",
  "model": "mock-summary",
  "confidence": 0.7,
  "purpose": "This TypeScript file contains 4 symbols and imports 2 dependencies.",
  "symbols": [
    {
      "name": "createAccessToken",
      "kind": "function",
      "summary": "Function createAccessToken defined in src/auth/token.ts."
    }
  ],
  "dependencies": [],
  "related_files": [],
  "created_at": "ISO_DATE",
  "updated_at": "ISO_DATE"
}
```

For each function:

```text
.summaries/functions/<safe-symbol-id>.json
```

## Stale Detection

A summary is fresh if:

```text
summary.hash == current file hash
```

If file hash changed, mark stale.

Add summary status values:

```text
fresh
stale
missing
failed
partial
```

Update file index records with summary status if practical.

## Dry Run

`--dry-run` should show which summaries would be generated/refreshed without writing.

## Changed Only

`--changed-only` should summarize only:

- missing summaries
- stale summaries
- changed files

## Status Update

Show:

- Fresh summaries
- Stale summaries
- Missing summaries
- Failed summaries
- Last summarize time

## Doctor Update

Check:

- summaries folder exists
- file summaries count
- stale summary count
- warn if no summaries generated

## Logs

Write:

- `.logs/summary-generation.log`
- `.logs/cost-events.log`

Never log full source code or secrets.

## Tests

Unit tests:

- mock provider
- summary path safe encoding
- stale detection
- dry-run behavior

Integration tests:

- init + scan + index + summarize --mock
- summaries created
- changed file marks summary stale
- changed-only regenerates only stale/missing summaries

## Acceptance Criteria

These must work:

```bash
pnpm build
pnpm test
kontextmind init --yes
kontextmind scan
kontextmind index
kontextmind summarize --mock
kontextmind status
kontextmind doctor
```

Expected:

- summaries created
- mock provider works
- stale detection works
- no API key required

At the end, summarize and mention Phase 5 can now add chatbot knowledge base and ask command.
