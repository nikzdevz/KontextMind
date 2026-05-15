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

# Copy workspace packages into server's node_modules for resolution during build
RUN mkdir -p /app/packages/server/node_modules/@kontextmind && \
    ln -sf /app/packages/core /app/packages/server/node_modules/@kontextmind/core

# Build all packages (in correct order)
# 1. Build core first (no dependencies)
# 2. Build server (depends on core) - symlink to built core
# 3. Build mcp (depends on core) - symlink to built core
# 4. Build adapters (no dependencies)
# 5. Build CLI (depends on core and mcp)
ENV SHELL=/bin/bash
RUN cd packages/core && pnpm run build

# After core is built, set up proper symlinks for workspace packages
RUN rm -rf /app/node_modules/@kontextmind && mkdir -p /app/node_modules/@kontextmind && \
    ln -sf /app/packages/core /app/node_modules/@kontextmind/core && \
    ln -sf /app/packages/mcp /app/node_modules/@kontextmind/mcp && \
    ln -sf /app/packages/server /app/node_modules/@kontextmind/server 2>/dev/null || true

# Now build remaining packages - they'll find @kontextmind/* in node_modules
RUN cd packages/server && pnpm run build
RUN cd packages/mcp && pnpm run build
RUN cd packages/adapters && pnpm run build
RUN cd apps/cli && pnpm run build

# Install CLI globally using npm link
WORKDIR /app/apps/cli
RUN npm link

# Switch back to app directory
WORKDIR /app

# Create non-root user for security with home directory
RUN addgroup -g 1001 -S kontextmind && \
    adduser -S kontextmind -u 1001 -h /home/kontextmind && \
    mkdir -p /home/kontextmind && \
    chown -R kontextmind:kontextmind /home/kontextmind

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

# Copy entrypoint script and fix Windows line endings
COPY scripts/entrypoint.sh /tmp/entrypoint.sh
RUN sed -i 's/\r$//' /tmp/entrypoint.sh && mv /tmp/entrypoint.sh /entrypoint.sh && chmod +x /entrypoint.sh

# Switch to non-root user
USER kontextmind

# Expose port
EXPOSE 7331

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7331/health/live || exit 1

# Start server via entrypoint (configures global LLM from env vars)
ENTRYPOINT ["/entrypoint.sh"]