#!/usr/bin/env bash
#
# KontextMind Uninstall Script for macOS/Linux
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/kontextmind/setup/main/uninstall.sh | bash
#   OR download and run locally:
#   chmod +x uninstall.sh && ./uninstall.sh
#
# Options:
#   --remove-all       Remove all KontextMind files including MCP configs
#   --remove-mcp      Remove MCP configurations
#   --remove-backups   Don't create backups
#   --force            Skip confirmation prompt
#   --help             Show this help message

set -e

# Configuration
REMOVE_ALL=false
REMOVE_MCP=false
REMOVE_BACKUPS=false
FORCE=false
PROJECT_PATH="${PROJECT_PATH:-$PWD}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --remove-all)
            REMOVE_ALL=true
            shift
            ;;
        --remove-mcp)
            REMOVE_MCP=true
            shift
            ;;
        --remove-backups)
            REMOVE_BACKUPS=true
            shift
            ;;
        --force|-y)
            FORCE=true
            shift
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
    ║   Uninstall Script for macOS/Linux                    ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
BANNER
echo -e "${NC}"

echo -e "${YELLOW}This will completely remove KontextMind from this project!${NC}"
echo -e "${YELLOW}This action cannot be undone.${NC}"
echo ""

if [ "$FORCE" = false ]; then
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[yY]$ ]]; then
        echo -e "${CYAN}[INFO]${NC} Uninstall cancelled."
        exit 0
    fi
fi

cd "$PROJECT_PATH"

# ============================================================
# STEP 1: Stop Running MCP Servers
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Stopping running MCP servers..."

# Kill kontextmind node processes
pkill -f "kontextmind.*mcp" 2>/dev/null || true
pkill -f "node.*kontextmind" 2>/dev/null || true

echo -e "${CYAN}[INFO]${NC} No running KontextMind processes found"

# ============================================================
# STEP 2: Create Backup
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Creating backup before uninstall..."

if [ "$REMOVE_BACKUPS" = false ]; then
    BACKUP_DIR="$PROJECT_PATH/.kontextmind-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup important files
    [ -d ".kontextmind" ] && cp -r ".kontextmind" "$BACKUP_DIR/" && echo -e "${CYAN}[INFO]${NC} Backed up .kontextmind"
    [ -d ".summaries" ] && cp -r ".summaries" "$BACKUP_DIR/" && echo -e "${CYAN}[INFO]${NC} Backed up .summaries"
    [ -d ".kg" ] && cp -r ".kg" "$BACKUP_DIR/" && echo -e "${CYAN}[INFO]${NC} Backed up .kg"
    [ -f ".mcp.json" ] && cp ".mcp.json" "$BACKUP_DIR/" && echo -e "${CYAN}[INFO]${NC} Backed up .mcp.json"

    echo -e "${GREEN}[OK]${NC} Backup created at: $BACKUP_DIR"
else
    echo -e "${CYAN}[INFO]${NC} Skipping backup (--remove-backups specified)"
fi

# ============================================================
# STEP 3: Remove KontextMind Directories
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Removing KontextMind directories..."

directories=(
    ".kontextmind"
    ".summaries"
    ".kg"
    ".memory"
    ".mental-model"
    ".context"
    ".sessions"
    ".logs"
    ".obsidian-export"
)

for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        echo -e "${GREEN}[OK]${NC} Removed: $dir"
    fi
done

# ============================================================
# STEP 4: Remove KontextMind Files
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Removing KontextMind configuration files..."

files=(
    "kontextmind.json"
    "FIRSTPROMPT.md"
    "CLAUDE.md"
    "AGENTS.md"
    "README_AI.md"
    ".toolignore"
    ".mcp.json"
    ".roomodes"
    "mcp_settings.json"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo -e "${GREEN}[OK]${NC} Removed: $file"
    fi
done

# ============================================================
# STEP 5: Remove Context Files
# ============================================================
context_files=(
    "handoff.md"
    "current-state.md"
    "project.md"
    "architecture.md"
    "conventions.md"
    "decisions.md"
    "task-history.md"
    "agent-policy.md"
)

for file in "${context_files[@]}"; do
    if [ -f ".context/$file" ]; then
        rm -f ".context/$file"
        echo -e "${GREEN}[OK]${NC} Removed: .context/$file"
    fi
done

# Remove .context if empty
[ -d ".context" ] && [ -z "$(ls -A .context 2>/dev/null)" ] && rmdir ".context" && echo -e "${GREEN}[OK]${NC} Removed empty .context directory"

# ============================================================
# STEP 6: Remove Cursor/Roo Configurations
# ============================================================
if [ "$REMOVE_ALL" = true ] || [ "$REMOVE_MCP" = true ]; then
    echo ""
    echo -e "${BLUE}[STEP]${NC} Removing MCP configurations..."

    mcp_configs=(
        ".cursor/mcp.json"
        ".roo/mcp.json"
        ".codex/config.toml"
    )

    for config in "${mcp_configs[@]}"; do
        if [ -f "$config" ]; then
            rm -f "$config"
            echo -e "${GREEN}[OK]${NC} Removed: $config"
        fi
    done

    # Also check for .mcp folder
    [ -d ".mcp" ] && rm -rf ".mcp" && echo -e "${GREEN}[OK]${NC} Removed: .mcp folder"
else
    echo -e "${CYAN}[INFO]${NC} Keeping MCP configurations (use --remove-all or --remove-mcp to remove)"
fi

# ============================================================
# STEP 7: Check package.json
# ============================================================
echo ""
echo -e "${BLUE}[STEP]${NC} Checking package.json..."

if [ -f "package.json" ]; then
    if grep -q '"kontextmind"' package.json; then
        echo -e "${YELLOW}[WARN]${NC} Found kontextmind in scripts. Please remove manually."
        echo -e "${CYAN}[INFO]${NC} Remove 'kontextmind' entry from package.json scripts section."
    fi
fi

# ============================================================
# COMPLETION
# ============================================================
echo ""
echo -e "${GREEN}"
cat << 'COMPLETE'
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ✓ KontextMind Uninstalled Successfully!            ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
COMPLETE
echo -e "${NC}"

if [ "$REMOVE_BACKUPS" = false ]; then
    echo -e "${CYAN}Backup location:${NC} $BACKUP_DIR"
    echo -e "${CYAN}To restore:${NC} copy the backup files back to their original locations."
fi

echo ""
echo -e "To reinstall KontextMind, run the setup script again:"
echo -e "  curl -sSL https://raw.githubusercontent.com/kontextmind/setup/main/setup.sh | bash"