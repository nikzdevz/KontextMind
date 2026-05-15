#!/usr/bin/env pwsh
# KontextMind Auto-Start Script
# Place this file in your Windows startup folder or use Task Scheduler

param(
    [string]$ProjectPath = "",
    [string]$Mode = "readonly",
    [switch]$MCP,
    [switch]$Serve,
    [int]$Port = 7331,
    [int]$MCPPort = 7332
)

# Find kontextmind CLI
$KontextmindCmd = "C:\Users\nikzdevz\AppData\Local\pnpm\global\5\node_modules\.bin\kontextmind.CMD"

if (-not (Test-Path $KontextmindCmd)) {
    Write-Error "KontextMind CLI not found at: $KontextmindCmd"
    Write-Host "Please run: cd d:\Projects\KontextMind && pnpm build && cd apps/cli && pnpm link --global"
    exit 1
}

# Change to project directory or specified path
if ($ProjectPath) {
    Set-Location $ProjectPath
} else {
    # Default to KontextMind directory
    Set-Location "d:\Projects\KontextMind"
}

Write-Host "Starting KontextMind MCP Server..."
Write-Host "Project: $(Get-Location)"
Write-Host "Mode: $Mode"
Write-Host ""

# Start MCP server in background
if ($MCP) {
    Write-Host "Starting MCP server on port $MCPPort..."
    Start-Process -FilePath $KontextmindCmd -ArgumentList "mcp", "--mode", $Mode, "--transport", "http", "--port", $MCPPort -NoNewWindow
}

# Start HTTP server in background
if ($Serve) {
    Write-Host "Starting HTTP server on port $Port..."
    Start-Process -FilePath $KontextmindCmd -ArgumentList "serve", "--port", $Port, "--host", "127.0.0.1", "--mode", $Mode -NoNewWindow
}

Write-Host ""
Write-Host "KontextMind auto-start complete!"
Write-Host "MCP: http://127.0.0.1:$MCPPort/mcp"
Write-Host "API: http://127.0.0.1:$Port"
Write-Host ""
Write-Host "To stop, close the PowerShell window or use Task Manager."
