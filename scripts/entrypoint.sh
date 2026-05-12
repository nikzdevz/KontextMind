#!/bin/bash
# KontextMind Container Entrypoint
# Configures global LLM settings from environment variables, then starts the server

set -e

echo "[ENTRYPOINT] Configuring KontextMind..."

# Configure global LLM provider from environment variables
if [ -n "$LLM_API_KEY" ]; then
    LLM_PROVIDER_NAME="${LLM_PROVIDER_NAME:-opusmax}"
    LLM_PROVIDER_TYPE="${LLM_PROVIDER:-openai-compatible}"
    LLM_BASE_URL_VAL="${LLM_BASE_URL:-https://api.anthropic.com}"
    LLM_MODEL_VAL="${LLM_MODEL:-claude-opus-4-7}"

    echo "[ENTRYPOINT] Setting up global provider: $LLM_PROVIDER_NAME"

    # Add provider with type, baseUrl, and model (one-time setup)
    node /app/apps/cli/dist/index.js config add \
        --name "$LLM_PROVIDER_NAME" \
        --type "$LLM_PROVIDER_TYPE" \
        --baseUrl "$LLM_BASE_URL_VAL" \
        --model "$LLM_MODEL_VAL" \
        --global 2>/dev/null || true

    # Set API key separately (same as user running: kontextmind config set-api-key --name X --apiKey Y --global)
    node /app/apps/cli/dist/index.js config set-api-key \
        --name "$LLM_PROVIDER_NAME" \
        --apiKey "$LLM_API_KEY" \
        --global 2>/dev/null || true

    # Set as default provider
    node /app/apps/cli/dist/index.js config set "$LLM_PROVIDER_NAME" --global 2>/dev/null || true

    echo "[ENTRYPOINT] Global LLM provider configured: $LLM_PROVIDER_NAME"
else
    echo "[ENTRYPOINT] Warning: LLM_API_KEY not set, Ask functionality may not work"
fi

echo "[ENTRYPOINT] Starting KontextMind server..."
exec node packages/server/dist/index.js "$@"