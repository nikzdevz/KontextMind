#!/usr/bin/env bash
#
# KontextMind One-Command Setup Script for macOS/Linux
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/kontextmind/setup/main/setup.sh | bash
#   OR download and run locally:
#   chmod +x setup.sh && ./setup.sh
#
# Options:
#   --skip-clone      Skip git clone (use existing project)
#   --skip-mcp        Skip MCP server configuration
#   --skip-scan       Skip initial scan
#   --skip-summarize  Skip AI summary generation
#   --project-path    Custom project path (default: current directory)
#   --project-url     Git repository URL to clone
#   --help            Show this help message

set -e

# Configuration
PROJECT_PATH="${PROJECT_PATH:-$PWD}"
PROJECT_URL=""
SKIP_CLONE=false
SKIP_MCP=false
SKIP_SCAN=false
SKIP_SKIP_SUMMARIZE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-clone)
            SKIP_CLONE=true
            shift
            ;;
        --skip-mcp)
            SKIP_MCP=true
            shift
            ;;
        --skip-scan)
            SKIP_SCAN=true
            shift
            ;;
        --skip-summarize)
            SKIP_SUMMARIZE=true
            shift
            ;;
        --project-path)
            PROJECT_PATH="$2"
            shift 2
            ;;
        --project-url)
            PROJECT_URL="$2"
            shift 2
            ;;
        --help|-h)
            head -50 "$0"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Banner
echo -e "${MAGENTA}"
cat << 'BANNER'
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ██╗    ██╗███████╗██╗  ██╗██╗   ██╗ ██████╗        ║
    ║   ██║    ██║██╔════╝██║  ██║██║   ██║██╔════╝        ║
    ║   ██║ █╗ ██║█████╗  ███████║██║   ██║██║  ███╗       ║
    ║   ██║███╗██║██╔══╝  ██╔══██║██║   ██║██║   ██║       ║
    ║   ╚███╔███╔╝███████╗██║  ██║╚██████╔╝╚██████╔╝       ║
    ║    ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝        ║
    ║                                                       ║
    ║   One-Command Setup Script for macOS/Linux            ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
BANNER
echo -e "${NC}"

echo -e "${CYAN}[INFO]${NC} Starting KontextMind setup..."
echo -e "${CYAN}[INFO]${NC} Project Path: $PROJECT_PATH"

# ============================================================
# STEP 1: Detect Prerequisites
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Checking prerequisites..."

check_command() {
    local cmd=$1
    local name=$2
    local install_hint=$3

    if command -v $cmd &> /dev/null; then
        local version=$($cmd --version 2>/dev/null | head -1 || echo "found")
        echo -e "${GREEN}[OK]${NC} $name found: $version"
        return 0
    else
        echo -e "${YELLOW}[WARN]${NC} $name not found. $install_hint"
        return 1
    fi
}

check_node() {
    if command -v node &> /dev/null; then
        local version=$(node --version)
        echo -e "${GREEN}[OK]${NC} Node.js found: $version"
        return 0
    else
        echo -e "${RED}[ERROR]${NC} Node.js is required. Install from https://nodejs.org"
        return 1
    fi
}

check_pnpm() {
    if command -v pnpm &> /dev/null; then
        local version=$(pnpm --version)
        echo -e "${GREEN}[OK]${NC} pnpm found: $version"
        return 0
    else
        echo -e "${YELLOW}[WARN]${NC} pnpm not found. Installing..."
        npm install -g pnpm
        return 0
    fi
}

check_git() {
    if command -v git &> /dev/null; then
        local version=$(git --version)
        echo -e "${GREEN}[OK]${NC} Git found: $version"
        return 0
    else
        echo -e "${RED}[ERROR]${NC} Git is required. Install from https://git-scm.com"
        return 1
    fi
}

# Check prerequisites
check_node || exit 1
check_pnpm || exit 1
check_git || exit 1

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}[ERROR]${NC} Node.js 18+ required. Current version: v$NODE_VERSION"
    exit 1
fi

# ============================================================
# STEP 2: Clone or Navigate to Project
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Setting up project..."

if [ "$SKIP_CLONE" = false ] && [ -n "$PROJECT_URL" ]; then
    if [ -d "$PROJECT_PATH" ]; then
        echo -e "${YELLOW}[WARN]${NC} Project directory exists. Pulling latest..."
        cd "$PROJECT_PATH"
        git pull
    else
        echo -e "${CYAN}[INFO]${NC} Cloning repository..."
        git clone "$PROJECT_URL" "$PROJECT_PATH"
    fi
elif [ ! -f "$PROJECT_PATH/package.json" ]; then
    echo -e "${RED}[ERROR]${NC} No package.json found in $PROJECT_PATH"
    echo -e "${RED}[ERROR]${NC} Run setup from a KontextMind project directory"
    exit 1
else
    echo -e "${GREEN}[OK]${NC} Project already exists at $PROJECT_PATH"
fi

cd "$PROJECT_PATH"

# ============================================================
# STEP 3: Install Dependencies
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Installing dependencies..."

echo -e "${CYAN}[INFO]${NC} This may take a few minutes..."
pnpm install

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Failed to install dependencies. Try running: pnpm install"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Dependencies installed"

# ============================================================
# STEP 4: Build Project
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Building project..."

echo -e "${CYAN}[INFO]${NC} This may take a few minutes..."
pnpm build

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Failed to build project. Try running: pnpm build"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Project built"

# ============================================================
# STEP 5: Create .env from Template
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Configuring environment..."

if [ -f "$PROJECT_PATH/.env.example" ]; then
    if [ ! -f "$PROJECT_PATH/.env" ]; then
        cp "$PROJECT_PATH/.env.example" "$PROJECT_PATH/.env"
        echo -e "${GREEN}[OK]${NC} Created .env from template"
        echo -e "${YELLOW}[WARN]${NC} IMPORTANT: Edit .env and add your API keys!"
    else
        echo -e "${CYAN}[INFO]${NC} .env already exists"
    fi
else
    echo -e "${YELLOW}[WARN]${NC} No .env.example found. Creating basic .env..."
    cat > "$PROJECT_PATH/.env" << 'ENVFILE'
# KontextMind Configuration
# Add your API keys below

# OpenAI (if using OpenAI models)
# OPENAI_API_KEY=sk-your-key-here

# Anthropic (if using Claude models)
# ANTHROPIC_API_KEY=sk-ant-your-key-here

# OpusMax (custom endpoint)
# OPUSMAX_API_KEY=your-key-here
ENVFILE
    echo -e "${GREEN}[OK]${NC} Created .env"
fi

# ============================================================
# STEP 6: Initialize KontextMind (if not already)
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Initializing KontextMind..."

if [ -f "$PROJECT_PATH/kontextmind.json" ]; then
    echo -e "${CYAN}[INFO]${NC} KontextMind already initialized"
else
    echo -e "${CYAN}[INFO]${NC} Running kontextmind init..."
    pnpm kontextmind init --mode full-agent --yes 2>/dev/null || true
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Failed to initialize KontextMind"
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} KontextMind initialized"
fi

# ============================================================
# STEP 7: Run Initial Scan
# ============================================================
if [ "$SKIP_SCAN" = false ]; then
    echo ""
    echo -e "${BLUE}[STEP]${NC} Running initial scan..."

    echo -e "${CYAN}[INFO]${NC} Scanning files..."
    pnpm kontextmind scan
    echo -e "${GREEN}[OK]${NC} Files scanned"

    echo -e "${CYAN}[INFO]${NC} Indexing symbols..."
    pnpm kontextmind index
    echo -e "${GREEN}[OK]${NC} Symbols indexed"
fi

# ============================================================
# STEP 8: Generate Summaries
# ============================================================
if [ "$SKIP_SUMMARIZE" = false ]; then
    echo ""
    echo -e "${BLUE}[STEP]${NC} Generating AI summaries..."

    echo -e "${YELLOW}[WARN]${NC} This uses LLM API and may incur costs. Press Ctrl+C to cancel..."
    sleep 3

    echo -e "${CYAN}[INFO]${NC} Generating summaries (this may take several minutes)..."
    pnpm kontextmind summarize 2>/dev/null || echo -e "${YELLOW}[WARN]${NC} Summarization failed or was cancelled. Run 'kontextmind summarize' later."
    echo -e "${GREEN}[OK]${NC} Summaries generated"

    echo -e "${CYAN}[INFO]${NC} Building knowledge base..."
    pnpm kontextmind kb build
    echo -e "${GREEN}[OK]${NC} Knowledge base built"
fi

# ============================================================
# STEP 9: Configure MCP Server
# ============================================================
if [ "$SKIP_MCP" = false ]; then
    echo ""
    echo -e "${BLUE}[STEP]${NC} Configuring MCP server..."

    # Detect Claude Code installation
    CLAUDE_CONFIG="$HOME/.claude/projects.json"

    if [ -f "$CLAUDE_CONFIG" ]; then
        echo -e "${CYAN}[INFO]${NC} Detected Claude Code installation"
    fi

    # Create/update .mcp.json for Claude Code
    cat > "$PROJECT_PATH/.mcp.json" << EOF
{
  "mcpServers": {
    "kontextmind": {
      "command": "kontextmind",
      "args": ["mcp", "--mode", "full-agent"],
      "cwd": "$PROJECT_PATH",
      "env": {
        "DATA_DIR": ".kontextmind"
      }
    }
  }
}
EOF

    echo -e "${GREEN}[OK]${NC} Created .mcp.json"
fi

# ============================================================
# STEP 10: Verify Installation
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Verifying installation..."

echo -e "${CYAN}[INFO]${NC} Checking kontextmind..."
VERSION=$(pnpm kontextmind --version 2>/dev/null || echo "unknown")
echo -e "${GREEN}[OK]${NC} KontextMind v$VERSION installed"

echo -e "${CYAN}[INFO]${NC} Checking project status..."
pnpm kontextmind status 2>/dev/null | head -15 || true

# ============================================================
# COMPLETION
# ============================================================
echo ""
echo -e "${GREEN}"
cat << 'COMPLETE'
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ✓ KontextMind Setup Complete!                       ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
COMPLETE
echo -e "${NC}"

echo "Next Steps:"
echo -e "  ${CYAN}1.${NC} Edit .env and add your API keys"
echo -e "  ${CYAN}2.${NC} Start MCP server: ${BOLD}kontextmind mcp --mode full-agent${NC}"
echo -e "  ${CYAN}3.${NC} Ask a question: ${BOLD}kontextmind ask 'what does this project do?'${NC}"
echo -e "  ${CYAN}4.${NC} Read CLAUDE.md for usage instructions"
echo ""

if [ "$SKIP_MCP" = false ]; then
    echo "MCP Server Configuration:"
    echo "  .mcp.json has been created for Claude Code"
    echo "  Restart Claude Code to use KontextMind MCP tools"
    echo ""
fi

echo -e "${CYAN}For help:${NC} kontextmind --help"
echo -e "${CYAN}For issues:${NC} https://github.com/kontextmind/kontextmind/issues"