# 05 — Phase 5 Prompt: Chatbot Knowledge Base and Ask Command

You are continuing KontextMind.

Phases 1–4 are complete.

This prompt is for **PHASE 5 ONLY**.

## Phase 5 Goal

Implement chatbot knowledge base generation and safe Q&A from generated project context.

Add:

1. `kontextmind kb build`
2. `kontextmind ask`
3. Chatbot-readonly response policy
4. Pre-generated curated Q&A
5. Search across summaries and graph
6. No-code response enforcement
7. Q&A logs
8. Status/doctor improvements

Do not implement HTTP API yet. That is Phase 6.

## CLI Commands

### `kontextmind kb build`

Options:

```bash
--mode chatbot
--changed-only
--mock
--max-questions <number>
--json
```

Generate:

```text
.kontextmind/chatbot/project-overview.md
.kontextmind/chatbot/architecture.md
.kontextmind/chatbot/common-questions.json
.kontextmind/chatbot/api-flows.json
.kontextmind/chatbot/file-summaries.json
.kontextmind/chatbot/function-summaries.json
.kontextmind/chatbot/dependency-map.json
.kontextmind/chatbot/entity-map.json
.kontextmind/chatbot/troubleshooting.json
.kontextmind/chatbot/response-policy.json
```

Do not generate unlimited Q&A.

Generate curated Q&A categories:

- Project overview
- Architecture
- Setup
- API behavior
- Authentication
- Database
- Deployment
- Error handling
- Security
- Dependencies
- Impact analysis
- Troubleshooting
- Developer onboarding

### `kontextmind ask "question"`

Options:

```bash
--mode readonly|chatbot-readonly
--json
--no-code
```

Behavior:

1. Ensure KB exists.
2. Search pre-generated Q&A.
3. Search file summaries.
4. Search function summaries.
5. Search graph JSON.
6. Return best safe answer.
7. If provider configured, optionally use model with retrieved context.
8. Apply response policy.
9. Log Q&A event.

## Chatbot-Readonly Policy

In chatbot-readonly mode:

Allowed:

- project overview
- architecture summary
- file summaries
- function summaries
- knowledge graph
- pre-generated Q&A
- API flow summaries
- troubleshooting summaries

Denied:

- raw file reads
- file writes
- patches
- command execution
- package installation
- source code output
- secret output

Response policy:

```json
{
  "return_code": false,
  "max_code_lines": 0,
  "allow_file_names": true,
  "allow_function_names": true,
  "allow_architecture_explanation": true,
  "allow_high_level_steps": true
}
```

## Answer Format

For normal text:

```text
Answer:
...

Confidence:
0.82

Based on:
- file summaries
- dependency graph
- common questions
```

For JSON mode:

```json
{
  "answer": "...",
  "confidence": 0.82,
  "sources": [],
  "raw_code_access": false,
  "policy_applied": true
}
```

## No-Code Filter

Implement a simple response filter that blocks or redacts:

- fenced code blocks
- long source-like content
- secrets
- `.env`-style values

If no-code mode is active and answer includes code, replace with explanation.

## Search

Start simple:

- exact/keyword scoring
- search in Q&A questions
- search in summary purpose fields
- search in file names and function names
- search graph node labels

FTS/SQLite can be deferred unless already available.

## Logs

Write `.logs/qna-events.log` with:

- timestamp
- question hash or truncated question
- retrieved source types
- raw_code_access false
- mode
- confidence
- result

Do not log full private question by default if policy says not to.

## Status Update

Show:

- Chatbot KB ready/not ready
- Q&A count
- Last KB build time
- Last ask time if available

## Doctor Update

Check chatbot KB files and warn if missing.

## Tests

Unit tests:

- Q&A generation
- retrieval scoring
- no-code filter
- chatbot policy enforcement

Integration tests:

- init + scan + index + summarize + kb build
- ask returns answer
- chatbot-readonly does not return code
- logs Q&A event

## Acceptance Criteria

These work:

```bash
pnpm build
pnpm test
kontextmind kb build --mock
kontextmind ask "What is this project?" --mode chatbot-readonly
kontextmind ask "Which files handle authentication?" --mode chatbot-readonly --json
```

Expected:

- KB created
- ask command answers from generated context
- no raw code returned
- qna log written

At the end, summarize and mention Phase 6 can add HTTP API.
