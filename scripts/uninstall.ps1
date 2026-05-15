#!/usr/bin/env pwsh
<#
.SYNOPSIS
    KontextMind Uninstall Script for Windows
.DESCRIPTION
    Completely removes KontextMind from a project:
    .\uninstall.ps1

    This script will:
    - Stop any running MCP servers
    - Remove KontextMind files and directories
    - Optionally remove MCP configurations
    - Restore original files if backup exists
.NOTES
    Version: 1.0.0
    Author: KontextMind Team
#>

param(
    [switch]$RemoveAll,
    [switch]$RemoveMCP,
    [switch]$RemoveBackups,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Step { param([string]$Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-ErrorExit { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red; exit 1 }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Gray }

# Banner
Write-Host @"

    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ██╗    ██╗███████╗██╗  ██╗██╗   ██╗ ██████╗        ║
    ║   ██║    ██║██╔════╝██║  ██║██║   ██║██╔════╝        ║
    ║   ██║ █╗ ██║█████╗  ███████║██║   ██║██║  ███╗       ║
    ║   ██║███╗██║██╔══╝  ██╔══██║██║   ██║██║   ██║       ║
    ║   ╚███╔███╔╝███████╗██║  ██║╚██████╔╝╚██████╔╝       ║
    ║    ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝        ║
    ║                                                       ║
    ║   Uninstall Script for Windows                         ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Write-Warning "This will completely remove KontextMind from this project!"
Write-Warning "This action cannot be undone."
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Are you sure you want to continue? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Info "Uninstall cancelled."
        exit 0
    }
}

$PROJECT_PATH = $PWD

# ============================================================
# STEP 1: Stop Running MCP Servers
# ============================================================
Write-Step "Stopping running MCP servers..."

# Find and kill kontextmind processes
$kontextmindProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*kontextmind*" -or $_.CommandLine -like "*mcp*"
}

if ($kontextmindProcesses) {
    Write-Info "Found running KontextMind processes. Stopping..."
    $kontextmindProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Success "Processes stopped"
}
else {
    Write-Info "No running KontextMind processes found"
}

# ============================================================
# STEP 2: Create Backup
# ============================================================
Write-Step "Creating backup before uninstall..."

$BACKUP_DIR = "$PROJECT_PATH\.kontextmind-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

if (-not $RemoveBackups) {
    # Backup important files
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null

    # Backup key directories if they exist
    if (Test-Path "$PROJECT_PATH\.kontextmind") {
        Copy-Item "$PROJECT_PATH\.kontextmind" "$BACKUP_DIR\kontextmind" -Recurse -Force
        Write-Info "Backed up .kontextmind"
    }
    if (Test-Path "$PROJECT_PATH\.summaries") {
        Copy-Item "$PROJECT_PATH\.summaries" "$BACKUP_DIR\summaries" -Recurse -Force
        Write-Info "Backed up .summaries"
    }
    if (Test-Path "$PROJECT_PATH\.kg") {
        Copy-Item "$PROJECT_PATH\.kg" "$BACKUP_DIR\kg" -Recurse -Force
        Write-Info "Backed up .kg"
    }
    if (Test-Path "$PROJECT_PATH\.mcp.json") {
        Copy-Item "$PROJECT_PATH\.mcp.json" "$BACKUP_DIR\mcp.json"
        Write-Info "Backed up .mcp.json"
    }

    Write-Success "Backup created at: $BACKUP_DIR"
}
else {
    Write-Info "Skipping backup (--remove-backups specified)"
}

# ============================================================
# STEP 3: Remove KontextMind Directories
# ============================================================
Write-Step "Removing KontextMind directories..."

$directoriesToRemove = @(
    ".kontextmind",
    ".summaries",
    ".kg",
    ".memory",
    ".mental-model",
    ".context",
    ".sessions",
    ".logs",
    ".obsidian-export"
)

foreach ($dir in $directoriesToRemove) {
    $path = Join-Path $PROJECT_PATH $dir
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Success "Removed: $dir"
    }
}

# ============================================================
# STEP 4: Remove KontextMind Files
# ============================================================
Write-Step "Removing KontextMind configuration files..."

$filesToRemove = @(
    "kontextmind.json",
    "FIRSTPROMPT.md",
    "CLAUDE.md",
    "AGENTS.md",
    "README_AI.md",
    ".toolignore",
    ".mcp.json",
    ".roomodes",
    "mcp_settings.json"
)

foreach ($file in $filesToRemove) {
    $path = Join-Path $PROJECT_PATH $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Success "Removed: $file"
    }
}

# ============================================================
# STEP 5: Remove Context Files
# ============================================================
$contextFilesToRemove = @(
    "handoff.md",
    "current-state.md",
    "project.md",
    "architecture.md",
    "conventions.md",
    "decisions.md",
    "task-history.md",
    "agent-policy.md"
)

foreach ($file in $contextFilesToRemove) {
    $path = Join-Path "$PROJECT_PATH\.context" $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Success "Removed: .context\$file"
    }
}

# Remove .context if empty
$contextPath = Join-Path $PROJECT_PATH ".context"
if ((Test-Path $contextPath) -and (Get-ChildItem $contextPath -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
    Remove-Item $contextPath -Force
    Write-Success "Removed empty .context directory"
}

# ============================================================
# STEP 6: Remove Cursor/Roo Configurations
# ============================================================
if ($RemoveAll -or $RemoveMCP) {
    Write-Step "Removing MCP configurations..."

    $mcpConfigs = @(
        ".cursor\mcp.json",
        ".roo\mcp.json",
        ".codex\config.toml"
    )

    foreach ($config in $mcpConfigs) {
        $path = Join-Path $PROJECT_PATH $config
        if (Test-Path $path) {
            Remove-Item $path -Force
            Write-Success "Removed: $config"
        }
    }

    # Also check for .mcp folder
    $mcpFolder = Join-Path $PROJECT_PATH ".mcp"
    if (Test-Path $mcpFolder) {
        Remove-Item $mcpFolder -Recurse -Force
        Write-Success "Removed: .mcp folder"
    }
}
else {
    Write-Info "Keeping MCP configurations (use --remove-all or --remove-mcp to remove)"
}

# ============================================================
# STEP 7: Remove from package.json (optional scripts)
# ============================================================
Write-Step "Checking package.json..."

$pkgJsonPath = Join-Path $PROJECT_PATH "package.json"
if (Test-Path $pkgJsonPath) {
    $packageJson = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json

    # Check if kontextmind scripts exist
    if ($packageJson.scripts.kontextmind) {
        Write-Warning "Found kontextmind in scripts. Please remove manually."
        Write-Info "Remove 'kontextmind' entry from package.json scripts section."
    }
}

# ============================================================
# COMPLETION
# ============================================================
Write-Host ""
Write-Host -ForegroundColor Green @"

    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ✓ KontextMind Uninstalled Successfully!            ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

"@

if (-not $RemoveBackups) {
    Write-Host "Backup location: $BACKUP_DIR" -ForegroundColor Cyan
    Write-Host "To restore, copy the backup files back to their original locations." -ForegroundColor Gray
}

Write-Host ""
Write-Host "To reinstall KontextMind, run the setup script again:" -ForegroundColor White
Write-Host "  iwr https://raw.githubusercontent.com/kontextmind/setup/main/setup.ps1 | iex" -ForegroundColor Cyan