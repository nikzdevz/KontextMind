#!/usr/bin/env pwsh
# KontextMind Auto-Start Registration Script
# This script registers KontextMind to start automatically when Windows boots

param(
    [string]$ProjectPath = "d:\Projects\KontextMind",
    [string]$Mode = "readonly",
    [int]$MCPort = 7332,
    [int]$ServePort = 7331,
    [switch]$Remove,
    [switch]$Silent
)

$ErrorActionPreference = "Stop"

# Find kontextmind CLI
$KontextmindCmd = "C:\Users\nikzdevz\AppData\Local\pnpm\global\5\node_modules\.bin\kontextmind.CMD"
$TaskName = "KontextMind-MCP-AutoStart"
$TaskDescription = "Starts KontextMind MCP server automatically at Windows startup"

function Write-Status {
    param([string]$Message, [string]$Type = "info")
    if (-not $Silent) {
        switch ($Type) {
            "success" { Write-Host "[+] $Message" -ForegroundColor Green }
            "warning" { Write-Host "[!] $Message" -ForegroundColor Yellow }
            "error" { Write-Host "[-] $Message" -ForegroundColor Red }
            default { Write-Host "[*] $Message" -ForegroundColor Cyan }
        }
    }
}

# Check if CLI exists
if (-not (Test-Path $KontextmindCmd)) {
    Write-Status "KontextMind CLI not found at: $KontextmindCmd" "error"
    Write-Status "Please run the following first:" "warning"
    Write-Status "  cd d:\Projects\KontextMind" ""
    Write-Status "  pnpm build" ""
    Write-Status "  cd apps/cli" ""
    Write-Status "  pnpm link --global" ""
    exit 1
}

if ($Remove) {
    # Remove the scheduled task
    Write-Status "Removing KontextMind auto-start task..." "info"
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Status "Auto-start task removed successfully!" "success"
    } catch {
        Write-Status "Task was not registered or already removed." "warning"
    }
    exit 0
}

# Create PowerShell script for the task
$ScriptPath = Join-Path $env:TEMP "kontextmind-autostart-task.ps1"
$ScriptContent = @"
`$ErrorActionPreference = "SilentlyContinue"
Set-Location "$ProjectPath"
& "$KontextmindCmd" mcp --mode $Mode --transport http --port $MCPort
"@

Write-Status "Creating auto-start script..." "info"
$ScriptContent | Out-File -FilePath $ScriptPath -Encoding UTF8

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Create action
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Create trigger (at logon)
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# Create settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Create principal (run as current user)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# Register the task
Write-Status "Registering KontextMind auto-start task..." "info"
try {
    # Use current executable path
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false
    $Principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType ServiceAccount -RunLevel Limited

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $TaskDescription | Out-Null
    Write-Status "KontextMind auto-start registered successfully!" "success"
    Write-Status "" ""
    Write-Status "Task Details:" "info"
    Write-Status "  Name: $TaskName" ""
    Write-Status "  Project: $ProjectPath" ""
    Write-Status "  Mode: $Mode" ""
    Write-Status "  Port: $MCPort" ""
    Write-Status "" ""
    Write-Status "The MCP server will start when you log in to Windows." "info"
    Write-Status "" ""
    Write-Status "To remove auto-start, run:" "info"
    Write-Status "  .\setup-autostart.ps1 -Remove" ""
} catch {
    Write-Status "Failed to register task: $_" "error"
    Write-Status "You may need to run PowerShell as Administrator." "warning"
    exit 1
}
