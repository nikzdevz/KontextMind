#!/usr/bin/env pwsh
<#
.SYNOPSIS
    KontextMind One-Command Setup Script for Windows
.DESCRIPTION
    Sets up KontextMind on a new system with a single command:
    iwr https://raw.githubusercontent.com/kontextmind/setup/main/setup.ps1 | iex

    This script will:
    - Detect prerequisites (Node.js, pnpm, Git)
    - Clone or setup the project
    - Install dependencies
    - Create .env from template
    - Run initial scan
    - Configure MCP server
.NOTES
    Version: 1.0.0
    Author: KontextMind Team
#>

param(
    [string]$ProjectPath = $PWD,
    [string]$ProjectUrl = "",
    [switch]$SkipClone,
    [switch]$SkipMCP,
    [switch]$SkipScan,
    [switch]$SkipSummarize,
    [switch]$Interactive = $true
)

# Colors for output
function Write-Step { param([string]$Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-ErrorExit { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red; exit 1 }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Gray }

$ErrorActionPreference = "Stop"

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
    ║   One-Command Setup Script for Windows               ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Write-Info "Starting KontextMind setup..."
Write-Info "Project Path: $ProjectPath"

# ============================================================
# STEP 1: Detect Prerequisites
# ============================================================
Write-Step "Checking prerequisites..."

function Test-Command {
    param([string]$Command, [string]$Name, [string]$InstallHint)
    try {
        $result = Get-Command $Command -ErrorAction SilentlyContinue
        if ($result) {
            $version = & $Command --version 2>$null | Select-Object -First 1
            Write-Success "$Name found: $version"
            return $true
        }
    }
    catch { }
    Write-Warning "$Name not found. $InstallHint"
    return $false
}

$nodeOk = Test-Command "node" "Node.js" "Install from https://nodejs.org"
$pnpmOk = Test-Command "pnpm" "pnpm" "Run: npm install -g pnpm"
$gitOk = Test-Command "git" "Git" "Install from https://git-scm.com"

if (-not $nodeOk) { Write-ErrorExit "Node.js is required. Install from https://nodejs.org" }
if (-not $pnpmOk) { Write-Info "Installing pnpm..."; npm install -g pnpm }
if (-not $gitOk) { Write-ErrorExit "Git is required. Install from https://git-scm.com" }

# Check Node.js version
$nodeVersion = node --version -replace 'v', ''
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 18) {
    Write-ErrorExit "Node.js 18+ required. Current version: $nodeVersion"
}

# ============================================================
# STEP 2: Clone or Navigate to Project
# ============================================================
Write-Step "Setting up project..."

if (-not $SkipClone -and $ProjectUrl) {
    if (Test-Path $ProjectPath) {
        Write-Warning "Project directory exists. Pulling latest..."
        Push-Location $ProjectPath
        git pull
        Pop-Location
    }
    else {
        Write-Info "Cloning repository..."
        git clone $ProjectUrl $ProjectPath
    }
}
elseif (-not (Test-Path "$ProjectPath\package.json")) {
    Write-ErrorExit "No package.json found in $ProjectPath. Run setup from a KontextMind project directory."
}
else {
    Write-Success "Project already exists at $ProjectPath"
}

Set-Location $ProjectPath

# ============================================================
# STEP 3: Install Dependencies
# ============================================================
Write-Step "Installing dependencies..."

Write-Info "This may take a few minutes..."
& pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-ErrorExit "Failed to install dependencies. Try running: pnpm install"
}
Write-Success "Dependencies installed"

# ============================================================
# STEP 4: Build Project
# ============================================================
Write-Step "Building project..."

Write-Info "This may take a few minutes..."
& pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-ErrorExit "Failed to build project. Try running: pnpm build"
}
Write-Success "Project built"

# ============================================================
# STEP 5: Create .env from Template
# ============================================================
Write-Step "Configuring environment..."

if (Test-Path "$ProjectPath\.env.example") {
    if (-not (Test-Path "$ProjectPath\.env")) {
        Copy-Item "$ProjectPath\.env.example" "$ProjectPath\.env"
        Write-Success "Created .env from template"
        Write-Warning "IMPORTANT: Edit .env and add your API keys!"
    }
    else {
        Write-Info ".env already exists"
    }
}
else {
    Write-Warning "No .env.example found. Creating basic .env..."
    @"
# KontextMind Configuration
# Add your API keys below

# OpenAI (if using OpenAI models)
# OPENAI_API_KEY=sk-your-key-here

# Anthropic (if using Claude models)
# ANTHROPIC_API_KEY=sk-ant-your-key-here

# OpusMax (custom endpoint)
# OPUSMAX_API_KEY=your-key-here
"@ | Out-File -FilePath "$ProjectPath\.env" -Encoding UTF8
    Write-Success "Created .env"
}

# ============================================================
# STEP 6: Initialize KontextMind (if not already)
# ============================================================
Write-Step "Initializing KontextMind..."

if (Test-Path "$ProjectPath\kontextmind.json") {
    Write-Info "KontextMind already initialized"
}
else {
    Write-Info "Running kontextmind init..."
    & pnpm kontextmind init --mode full-agent --yes 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorExit "Failed to initialize KontextMind"
    }
    Write-Success "KontextMind initialized"
}

# ============================================================
# STEP 7: Run Initial Scan
# ============================================================
if (-not $SkipScan) {
    Write-Step "Running initial scan..."

    Write-Info "Scanning files..."
    & pnpm kontextmind scan
    Write-Success "Files scanned"

    Write-Info "Indexing symbols..."
    & pnpm kontextmind index
    Write-Success "Symbols indexed"
}

# ============================================================
# STEP 8: Generate Summaries
# ============================================================
if (-not $SkipSummarize) {
    Write-Step "Generating AI summaries..."

    Write-Warning "This uses LLM API and may incur costs. Press Ctrl+C to cancel..."
    Start-Sleep -Seconds 3

    Write-Info "Generating summaries (this may take several minutes)..."
    & pnpm kontextmind summarize
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Summaries generated"
    }
    else {
        Write-Warning "Summarization failed or was cancelled. Run 'kontextmind summarize' later."
    }

    Write-Info "Building knowledge base..."
    & pnpm kontextmind kb build
    Write-Success "Knowledge base built"
}

# ============================================================
# STEP 9: Configure MCP Server
# ============================================================
if (-not $SkipMCP) {
    Write-Step "Configuring MCP server..."

    # Detect Claude Code installation
    $mcpConfigPath = "$HOME\AppData\Local\Programs\Claude\config.json"
    $claudeDesktopConfig = "$env:APPDATA\Claude\settings.json"

    if (Test-Path $mcpConfigPath -or Test-Path $claudeDesktopConfig) {
        Write-Info "Detected Claude Desktop. Configuring MCP..."
        # Claude Desktop uses settings.json
        $targetConfig = if (Test-Path $claudeDesktopConfig) { $claudeDesktopConfig } else { $mcpConfigPath }
        Write-Info "Claude Desktop config: $targetConfig"
        # Note: Claude Desktop requires manual config or restart
    }

    # Create/update .mcp.json for Claude Code
    $mcpJson = @{
        mcpServers = @{
            kontextmind = @{
                command = "kontextmind"
                args = @("mcp", "--mode", "full-agent")
                cwd = $ProjectPath
                env = @{
                    DATA_DIR = ".kontextmind"
                }
            }
        }
    } | ConvertTo-Json -Depth 3

    Set-Content -Path "$ProjectPath\.mcp.json" -Value $mcpJson -Encoding UTF8
    Write-Success "Created .mcp.json"
}

# ============================================================
# STEP 10: Verify Installation
# ============================================================
Write-Step "Verifying installation..."

Write-Info "Checking kontextmind..."
$version = & pnpm kontextmind --version 2>$null
Write-Success "KontextMind v$version installed"

Write-Info "Checking project status..."
& pnpm kontextmind status 2>$null | Select-Object -First 15

# ============================================================
# COMPLETION
# ============================================================
Write-Host @"

    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ✓ KontextMind Setup Complete!                       ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env and add your API keys" -ForegroundColor White
Write-Host "  2. Start MCP server: kontextmind mcp --mode full-agent" -ForegroundColor White
Write-Host "  3. Ask a question: kontextmind ask 'what does this project do?'" -ForegroundColor White
Write-Host "  4. Read CLAUDE.md for usage instructions" -ForegroundColor White
Write-Host ""

if (-not $SkipMCP) {
    Write-Host "MCP Server Configuration:" -ForegroundColor Cyan
    Write-Host "  .mcp.json has been created for Claude Code" -ForegroundColor White
    Write-Host "  Restart Claude Code to use KontextMind MCP tools" -ForegroundColor White
    Write-Host ""
}

Write-Host "For help: kontextmind --help" -ForegroundColor Gray
Write-Host "For issues: https://github.com/kontextmind/kontextmind/issues" -ForegroundColor Gray