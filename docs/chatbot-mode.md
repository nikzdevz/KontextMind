# Chatbot Mode

KontextMind's chatbot mode provides natural language Q&A about your project using generated summaries and a knowledge base.

## Modes

### Chatbot-Readonly Mode

In chatbot-readonly mode:
- No code is output
- Answers come from summaries only
- Clean, formatted responses

```bash
kontextmind ask "What is this project?" --mode chatbot-readonly
```

## Knowledge Base

The chatbot uses a curated knowledge base:

```bash
# Build knowledge base
kontextmind kb build --mock
```

This generates:
- Curated Q&A pairs
- Project overview
- Key concepts
- Common patterns

## Response Format

### Readonly Mode
Provides summaries and context:
```
The project is a Node.js REST API built with Express.
Key files include:
- src/index.ts (main entry)
- src/routes/ (API routes)
- src/middleware/ (Express middleware)
```

### Chatbot-Readonly Mode
Clean, friendly responses:
```
This is a task management API built with Express.js.
It provides endpoints for creating, listing, and
completing tasks. The API uses SQLite for storage.
```

## No Code Filter

Use `--no-code` to filter out code snippets:

```bash
kontextmind ask "How does authentication work?" --no-code
```

## Limitations

- Answers based on summaries, not live code
- Summary quality depends on LLM
- Mock mode uses simplified responses

## API Server

Start a server for programmatic access:

```bash
kontextmind serve --mode chatbot-readonly
```

Then query via HTTP:

```bash
curl -X POST http://127.0.0.1:7331/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this project?"}'
```