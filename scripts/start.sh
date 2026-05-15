#!/bin/sh
# KontextMind API Server Startup Script
#
# Usage:
#   ./scripts/start.sh              # Start with defaults
#   ./scripts/start.sh development # Start in dev mode
#   ./scripts/start.sh production   # Start in production mode

set -e

# Configuration
PORT="${PORT:-7331}"
HOST="${HOST:-0.0.0.0}"
DATA_DIR="${DATA_DIR:-/kontextmind/projects}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
check_env() {
    log_info "Checking environment configuration..."

    if [ -z "$LLM_API_KEY" ]; then
        log_warn "LLM_API_KEY is not set. Ask functionality will not work."
    fi

    if [ -z "$GITHUB_TOKEN" ]; then
        log_warn "GITHUB_TOKEN is not set. Git clone functionality will not work."
    fi

    if [ -z "$API_KEY" ]; then
        log_warn "API_KEY is not set. API will run in development mode (no auth)."
    fi

    log_info "Environment check complete."
}

# Ensure data directory exists
ensure_data_dir() {
    log_info "Ensuring data directory exists: $DATA_DIR"
    mkdir -p "$DATA_DIR"
}

# Get mode from argument or default to production
MODE="${1:-production}"

# Print startup banner
print_banner() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   KontextMind API Server                                  ║"
    echo "║   ───────────────────                                    ║"
    echo "║   Mode:     $MODE                                           ║"
    echo "║   Port:     $PORT                                           ║"
    echo "║   Host:     $HOST                                           ║"
    echo "║   Data:     $DATA_DIR                               ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
}

# Start the server
start_server() {
    log_info "Starting KontextMind API Server..."

    # Check if dist exists
    if [ ! -f "packages/server/dist/index.js" ]; then
        log_error "Server not built. Run 'pnpm run build' first."
        exit 1
    fi

    # Start the server
    node packages/server/dist/index.js
}

# Main execution
main() {
    check_env
    ensure_data_dir
    print_banner
    start_server
}

main "$@"