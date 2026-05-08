# Providers

KontextMind supports multiple LLM providers for AI-powered features like summarization and Q&A.

## Supported Providers

| Provider | Description |
|----------|-------------|
| `mock` | Built-in mock provider (no API key needed) |
| `openai-compatible` | Any OpenAI-compatible API (LM Studio, Ollama, LocalAI, etc.) |
| `openai` | OpenAI API (future) |
| `anthropic` | Anthropic Claude API (future) |
| `ollama` | Ollama local models (future) |
| `bedrock` | AWS Bedrock (future) |

## OpenAI-Compatible Provider

The `openai-compatible` provider works with any API that implements the OpenAI chat completions format.

### Supported Services

- **LM Studio** - Local LLM with OpenAI-compatible API
- **Ollama** - Local models with `/v1/chat/completions` endpoint
- **LocalAI** - Self-hosted OpenAI-compatible API
- **Together AI** - Cloud API with OpenAI format
- **Anyscale** - Managed endpoints
- **Custom servers** - Any service implementing the OpenAI API spec

### Configuration

Edit `.kontextmind/providers.json`:

```json
{
  "providers": {
    "primary": {
      "provider": "openai-compatible",
      "apiKey": "your-api-key",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4"
    }
  }
}
```

### Without API Key (Local Models)

For local models like LM Studio or Ollama:

```json
{
  "providers": {
    "primary": {
      "provider": "openai-compatible",
      "apiKey": "not-needed",
      "baseUrl": "http://localhost:8080/v1",
      "model": "llama-3"
    }
  }
}
```

### LM Studio Setup

1. Download [LM Studio](https://lmstudio.ai/)
2. Download a model (e.g., Llama 3, Mistral)
3. Start the local server (click "Start Server" in LM Studio)
4. Default URL: `http://localhost:8080/v1`

### Ollama Setup

1. Install [Ollama](https://ollama.ai/)
2. Pull a model: `ollama pull llama3`
3. Enable the API: Ollama automatically serves at `http://localhost:11434/v1`
4. Use model name: `llama3`

### Environment Variable

You can also set the API key via environment variable:

```bash
export OPENAI_API_KEY="your-key-here"
```

Then in providers.json:

```json
{
  "providers": {
    "primary": {
      "provider": "openai-compatible",
      "apiKey": "${OPENAI_API_KEY}",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4"
    }
  }
}
```

## Mock Provider

The mock provider is useful for:

- Testing without API credentials
- CI/CD pipelines
- Demo/evaluation purposes

```bash
# Use mock provider
kontextmind summarize --mock
kontextmind kb build --mock
```

## Provider Selection

### In `config.json`

```json
{
  "provider": "openai-compatible"
}
```

### Via Command Line

```bash
kontextmind summarize --provider openai-compatible --model gpt-4
```

## Cost Tracking

All provider calls are logged with:

- Provider name
- Model used
- Input/output tokens
- Estimated cost
- Duration

View costs with:

```bash
kontextmind audit
```

## Troubleshooting

### Connection Errors

If you get connection errors:

1. Check the `baseUrl` is correct
2. Ensure the server is running
3. Verify network/firewall settings

### API Key Issues

- Local models (LM Studio, Ollama): Set `apiKey` to any value or "not-needed"
- Cloud APIs: Set actual API key

### Rate Limiting

For rate-limited APIs, consider:

- Adding delays between requests
- Using a local model
- Implementing retry logic (future feature)