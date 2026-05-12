# KontextMind API Server
# Single-stage build for simplicity

FROM node:20-alpine

LABEL org.opencontainers.image.title="KontextMind API Server"
LABEL org.opencontainers.image.description="Multi-project knowledge base API for AI coding agents"
LABEL org.opencontainers.image.version="0.1.0"

WORKDIR /app

# Install git, pnpm and basic utilities
RUN apk add --no-cache git ca-certificates bash
RUN npm install -g pnpm

# Set up pnpm global directory
ENV PNPM_HOME=/app/.pnpm
ENV SHELL=/bin/bash
RUN /bin/bash -c "pnpm setup"
ENV PATH=/app/.pnpm/bin:$PATH

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/adapters/package.json ./packages/adapters/package.json
COPY packages/mcp/package.json ./packages/mcp/package.json
COPY packages/mcp/tsup.config.ts ./packages/mcp/tsup.config.ts
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/cli/tsup.config.ts ./apps/cli/tsup.config.ts

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build all packages (in correct order)
# First build MCP (dependency of CLI), then server, core, and CLI
ENV SHELL=/bin/bash
RUN cd packages/mcp && pnpm run build
RUN cd packages/server && pnpm run build
RUN cd packages/core && pnpm run build

# Link dependencies globally for CLI to use
RUN npm install -g /app/packages/mcp && npm install -g /app/packages/core

# Build CLI - replace workspace protocol with local paths for npm compatibility
RUN cd apps/cli && \
    sed -i 's|"@kontextmind/mcp": "workspace:\*"|"@kontextmind/mcp": "file:../packages/mcp"|' package.json && \
    sed -i 's|"@kontextmind/core": "workspace:\*"|"@kontextmind/core": "file:../packages/core"|' package.json && \
    npm install && npm run build

# Copy workspace packages into CLI's node_modules for runtime resolution
RUN mkdir -p /app/apps/cli/node_modules/@kontextmind && \
    rm -rf /app/apps/cli/node_modules/@kontextmind/core /app/apps/cli/node_modules/@kontextmind/mcp && \
    cp -r /app/packages/core /app/apps/cli/node_modules/@kontextmind/core && \
    cp -r /app/packages/mcp /app/apps/cli/node_modules/@kontextmind/mcp && \
    # Create symlinks to workspace node_modules for transitive deps
    for pkg in zod ignore glob; do \
      cp -r /app/node_modules/.pnpm/${pkg}*/node_modules/${pkg} /app/apps/cli/node_modules/ 2>/dev/null || true; \
    done

# Install CLI globally using npm link
WORKDIR /app/apps/cli
RUN npm link

# Switch back to app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S kontextmind && \
    adduser -S kontextmind -u 1001

# Create projects directory
RUN mkdir -p /kontextmind/projects && \
    chown -R kontextmind:kontextmind /kontextmind

# Set environment
ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
ENV PATH=/app/node_modules/.bin:$PATH
ENV PORT=7331
ENV HOST=0.0.0.0
ENV DATA_DIR=/kontextmind/projects

# Copy entrypoint script
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user
USER kontextmind

# Expose port
EXPOSE 7331

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7331/health/live || exit 1

# Start server via entrypoint (configures global LLM from env vars)
ENTRYPOINT ["/entrypoint.sh"]