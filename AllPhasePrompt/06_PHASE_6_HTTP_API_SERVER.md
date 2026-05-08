# 06 — Phase 6 Prompt: Local HTTP API Server

You are continuing KontextMind.

Phases 1–5 are complete.

This prompt is for **PHASE 6 ONLY**.

## Phase 6 Goal

Implement the local HTTP API server for frontend/backend integration.

Add:

1. Fastify server package
2. `kontextmind serve`
3. `/health`
4. `/status`
5. `/ask`
6. `/graph`
7. `/file-summary`
8. `/symbol`
9. `/audit`
10. `/kb/build`
11. request logging
12. policy enforcement

Do not implement MCP yet. That is Phase 7.

## Dependencies

Add Fastify to server package.

Keep server local by default:

```text
host: 127.0.0.1
port: 7331
```

## CLI Command

Implement:

```bash
kontextmind serve
```

Options:

```bash
--port 7331
--host 127.0.0.1
--mode readonly|chatbot-readonly|suggest|edit-with-approval|full-agent
```

Default:

```text
mode: readonly
port: 7331
host: 127.0.0.1
```

## Routes

### `GET /health`

Return:

```json
{
  "ok": true,
  "service": "kontextmind",
  "phase": 6
}
```

### `GET /status`

Return same data as CLI status.

### `POST /ask`

Body:

```json
{
  "question": "string",
  "mode": "readonly|chatbot-readonly",
  "no_code": true
}
```

Response:

```json
{
  "answer": "string",
  "confidence": 0.0,
  "sources": [],
  "raw_code_access": false,
  "policy_applied": true
}
```

### `GET /graph`

Return graph summary or graph JSON.

### `GET /file-summary?path=src/index.ts`

Return summary if exists. Respect policy.

### `GET /symbol?name=functionName`

Return symbol summary or symbol metadata.

### `POST /kb/build`

Run KB build.

### `GET /audit`

Return audit summary.

## Security

Default bind only to `127.0.0.1`.

Add request body limits.

Apply policy before each action.

In chatbot-readonly mode:

- deny raw code access
- deny source code output
- do not expose secrets

## Logs

Write `.logs/api-events.log`:

- timestamp
- endpoint
- method
- status
- latency_ms
- mode

Do not log secrets or raw code.

## Status/Doctor

Status should show server config.

Doctor should check if server config is valid.

## Tests

Unit tests:

- route handlers
- policy middleware
- response shape

Integration tests:

- start server on random port
- GET /health
- GET /status
- POST /ask
- chatbot-readonly no-code enforcement

## Acceptance Criteria

These work:

```bash
pnpm build
pnpm test
kontextmind serve --mode chatbot-readonly --port 7331
```

API works:

```bash
curl http://127.0.0.1:7331/health
curl -X POST http://127.0.0.1:7331/ask -H "Content-Type: application/json" -d '{"question":"What is this project?","mode":"chatbot-readonly","no_code":true}'
```

At the end, summarize and mention Phase 7 can add MCP server.
