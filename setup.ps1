#requires -Version 5.1
<#
.SYNOPSIS
    Robust Windows setup for the KontextMind CLI.

.DESCRIPTION
    Installs prerequisites that can be installed safely, installs workspace
    dependencies, builds all packages, links the CLI globally, updates the user
    PATH, and verifies that `kontextmind` is runnable.
#>
[CmdletBinding()]
param(
    [switch]$SkipNodeCheck,
    [switch]$InstallPrerequisites,
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$SkipLink,
    [switch]$SkipInit,
    [switch]$Init,
    [switch]$BuildKnowledgeBase,
    [switch]$MockKnowledgeBase,
    [switch]$RunDoctor,
    [switch]$NoPause,
    [switch]$Help,
    [string]$LogDir
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:CurrentStep = 'startup'
$script:Warnings = New-Object System.Collections.Generic.List[string]
$script:TranscriptStarted = $false

function Join-Lines {
    param([string[]]$Lines)
    return ($Lines -join [Environment]::NewLine)
}

function Show-Usage {
    Write-Host (Join-Lines @(
        'KontextMind setup',
        '',
        'Usage:',
        '  setup.bat [options]',
        '  powershell -ExecutionPolicy Bypass -File .\setup.ps1 [options]',
        '',
        'Options:',
        '  -SkipNodeCheck       Do not validate Node.js/npm.',
        '  -InstallPrerequisites Attempt Node.js install with winget if Node is missing/outdated.',
        '  -SkipInstall         Skip pnpm install.',
        '  -SkipBuild           Skip pnpm build.',
        '  -SkipLink            Skip global CLI linking.',
        '  -SkipInit            Do not initialize the current folder.',
        '  -Init                Run kontextmind init --yes if this folder is not initialized.',
        '  -BuildKnowledgeBase  Run kontextmind kb build after setup.',
        '  -MockKnowledgeBase   Run kontextmind kb build --mock after setup.',
        '  -RunDoctor           Run kontextmind doctor after setup.',
        '  -NoPause             Do not wait for a key at the end.',
        '  -LogDir <path>       Custom setup log directory.',
        '  -Help                Show this help.',
        '',
        'Required prerequisite:',
        '  Node.js 20 or newer must be installed and available in PATH.',
        '',
        'What setup does:',
        '  1. Validates repository layout and prerequisites.',
        '  2. Ensures pnpm is available, using corepack first and npm fallback.',
        '  3. Configures a pnpm global bin folder and user PATH.',
        '  4. Installs dependencies with pnpm install.',
        '  5. Builds the monorepo.',
        '  6. Links apps/cli globally as the kontextmind command.',
        '  7. Verifies kontextmind --version.'
    ))
}

if ($Help) {
    Show-Usage
    exit 0
}

function Write-Header {
    param([string]$Text)
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Magenta
    Write-Host "  $Text" -ForegroundColor Magenta
    Write-Host '============================================================' -ForegroundColor Magenta
}

function Write-Step {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[+] $Message" -ForegroundColor Green
}

function Write-WarnLine {
    param([string]$Message)
    $script:Warnings.Add($Message) | Out-Null
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-ErrorLine {
    param([string]$Message)
    Write-Host "[-] $Message" -ForegroundColor Red
}

function Add-UserPathEntry {
    param([Parameter(Mandatory = $true)][string]$PathToAdd)

    if ([string]::IsNullOrWhiteSpace($PathToAdd)) {
        throw 'Cannot add an empty path to PATH.'
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($PathToAdd.Trim())
    if (-not (Test-Path -LiteralPath $expanded)) {
        New-Item -ItemType Directory -Path $expanded -Force | Out-Null
    }

    $processEntries = @($env:Path -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $alreadyInProcess = $processEntries | Where-Object { $_.TrimEnd('\') -ieq $expanded.TrimEnd('\') } | Select-Object -First 1
    if (-not $alreadyInProcess) {
        $env:Path = "$expanded;$env:Path"
    }

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($null -eq $userPath) { $userPath = '' }
    $userEntries = @($userPath -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $alreadyInUser = $userEntries | Where-Object { $_.TrimEnd('\') -ieq $expanded.TrimEnd('\') } | Select-Object -First 1

    if ($alreadyInUser) {
        Write-Ok "PATH already contains $expanded"
        return
    }

    $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $expanded } else { "$expanded;$userPath" }
    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
    Write-Ok "Added to user PATH: $expanded"
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machinePath, $userPath) -join ';'
}

function Get-CommandPathOrNull {
    param([Parameter(Mandatory = $true)][string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$AllowFailure,
        [switch]$Quiet
    )

    $display = "$FilePath $($Arguments -join ' ')".Trim()
    if (-not $Quiet) { Write-Host "> $display" -ForegroundColor DarkGray }

    & $FilePath @Arguments
    $code = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "Command failed with exit code $code`: $display"
    }
    return $code
}

function Get-ExternalOutput {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$AllowFailure
    )

    $output = & $FilePath @Arguments 2>&1
    $code = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
    if ($code -ne 0 -and -not $AllowFailure) {
        $joined = ($output | Out-String).Trim()
        throw "Command failed with exit code $code`: $FilePath $($Arguments -join ' ')`n$joined"
    }
    return [pscustomobject]@{ ExitCode = $code; Output = @($output) }
}

function Assert-RepositoryLayout {
    param([string]$Root)
    $script:CurrentStep = 'checking repository layout'
    Write-Step 'Checking repository layout...'

    $required = @(
        'package.json',
        'pnpm-workspace.yaml',
        'apps\cli\package.json',
        'apps\cli\src\index.ts',
        'packages\core\package.json'
    )

    $missing = @()
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $relative))) {
            $missing += $relative
        }
    }

    if ($missing.Count -gt 0) {
        throw "This does not look like the KontextMind repository. Missing: $($missing -join ', ')"
    }

    Write-Ok "Repository root: $Root"
}

function Assert-Node {
    if ($SkipNodeCheck) {
        Write-WarnLine 'Skipping Node.js check by request.'
        return
    }

    $script:CurrentStep = 'checking Node.js'
    Write-Step 'Checking Node.js and npm...'

    if (-not (Get-CommandPathOrNull 'node')) {
        if ($InstallPrerequisites) {
            Install-NodeWithWinget
        }
    }

    if (-not (Get-CommandPathOrNull 'node')) {
        throw (Join-Lines @(
            'Node.js was not found in PATH.',
            '',
            'Install Node.js 20 LTS or newer, then reopen the terminal and rerun setup:',
            '  https://nodejs.org/',
            '',
            'If winget is available, you can install it with:',
            '  winget install OpenJS.NodeJS.LTS'
        ))
    }

    $nodeResult = Get-ExternalOutput -FilePath 'node' -Arguments @('-p', 'process.versions.node')
    $nodeText = ($nodeResult.Output | Select-Object -First 1).ToString().Trim()
    $nodeVersion = [Version]$nodeText
    if ($nodeVersion.Major -lt 20) {
        if ($InstallPrerequisites) {
            Install-NodeWithWinget
            $nodeResult = Get-ExternalOutput -FilePath 'node' -Arguments @('-p', 'process.versions.node')
            $nodeText = ($nodeResult.Output | Select-Object -First 1).ToString().Trim()
            $nodeVersion = [Version]$nodeText
        }
    }

    if ($nodeVersion.Major -lt 20) {
        throw "Node.js 20+ is required. Found $nodeText. Please install Node.js 20 LTS or newer."
    }
    Write-Ok "Node.js $nodeText"

    if (-not (Get-CommandPathOrNull 'npm')) {
        throw 'npm was not found in PATH. Reinstall Node.js with npm enabled.'
    }
    $npmResult = Get-ExternalOutput -FilePath 'npm' -Arguments @('--version')
    $npmVersion = ($npmResult.Output | Select-Object -First 1).ToString().Trim()
    Write-Ok "npm $npmVersion"
}

function Install-NodeWithWinget {
    $script:CurrentStep = 'installing Node.js prerequisite'
    Write-Step 'Attempting to install or upgrade Node.js LTS with winget...'

    if (-not (Get-CommandPathOrNull 'winget')) {
        throw (Join-Lines @(
            'Node.js is missing or outdated and winget is not available.',
            'Install Node.js 20 LTS manually from https://nodejs.org/, reopen the terminal, and rerun setup.'
        ))
    }

    $args = @(
        'install',
        'OpenJS.NodeJS.LTS',
        '--silent',
        '--accept-source-agreements',
        '--accept-package-agreements'
    )
    $code = Invoke-External -FilePath 'winget' -Arguments $args -AllowFailure
    if ($code -ne 0) {
        Write-WarnLine 'winget install did not complete cleanly. Trying winget upgrade for existing Node.js installations.'
        Invoke-External -FilePath 'winget' -Arguments @(
            'upgrade',
            'OpenJS.NodeJS.LTS',
            '--silent',
            '--accept-source-agreements',
            '--accept-package-agreements'
        ) -AllowFailure | Out-Null
    }

    Refresh-ProcessPath
    if (-not (Get-CommandPathOrNull 'node')) {
        throw 'Node.js installer finished, but node is not visible in this terminal. Close and reopen the terminal, then rerun setup.'
    }
}

function Ensure-Pnpm {
    $script:CurrentStep = 'checking pnpm'
    Write-Step 'Checking pnpm...'

    if (Get-CommandPathOrNull 'pnpm') {
        $pnpmResult = Get-ExternalOutput -FilePath 'pnpm' -Arguments @('--version')
        $pnpmVersion = ($pnpmResult.Output | Select-Object -First 1).ToString().Trim()
        Write-Ok "pnpm $pnpmVersion"
        return
    }

    Write-WarnLine 'pnpm was not found. Attempting installation.'

    if (Get-CommandPathOrNull 'corepack') {
        try {
            Write-Step 'Enabling pnpm through corepack...'
            Invoke-External -FilePath 'corepack' -Arguments @('enable')
            Invoke-External -FilePath 'corepack' -Arguments @('prepare', 'pnpm@latest', '--activate')
        } catch {
            Write-WarnLine "Corepack pnpm setup failed: $($_.Exception.Message)"
        }
    }

    if (-not (Get-CommandPathOrNull 'pnpm')) {
        Write-Step 'Installing pnpm globally with npm fallback...'
        Invoke-External -FilePath 'npm' -Arguments @('install', '-g', 'pnpm')
    }

    if (-not (Get-CommandPathOrNull 'pnpm')) {
        throw 'pnpm installation finished but pnpm is still not available in PATH. Reopen the terminal and rerun setup.'
    }

    $version = (Get-ExternalOutput -FilePath 'pnpm' -Arguments @('--version')).Output[0].ToString().Trim()
    Write-Ok "pnpm $version"
}

function Resolve-PnpmGlobalBin {
    $script:CurrentStep = 'configuring pnpm global bin'
    Write-Step 'Resolving pnpm global bin directory...'

    $candidates = New-Object System.Collections.Generic.List[string]

    $binResult = Get-ExternalOutput -FilePath 'pnpm' -Arguments @('bin', '-g') -AllowFailure
    if ($binResult.ExitCode -eq 0) {
        foreach ($line in $binResult.Output) {
            $value = $line.ToString().Trim()
            if ($value -and $value -notmatch 'undefined|error|ERR_PNPM' -and [System.IO.Path]::IsPathRooted($value)) {
                $candidates.Add($value) | Out-Null
            }
        }
    }

    $configured = Get-ExternalOutput -FilePath 'pnpm' -Arguments @('config', 'get', 'global-bin-dir', '--global') -AllowFailure
    if ($configured.ExitCode -eq 0) {
        foreach ($line in $configured.Output) {
            $value = $line.ToString().Trim()
            if ($value -and $value -notin @('undefined', 'null') -and [System.IO.Path]::IsPathRooted($value)) {
                $candidates.Add($value) | Out-Null
            }
        }
    }

    if ($env:PNPM_HOME -and [System.IO.Path]::IsPathRooted($env:PNPM_HOME)) {
        $candidates.Add($env:PNPM_HOME) | Out-Null
    }

    if ($env:LOCALAPPDATA) {
        $candidates.Add((Join-Path $env:LOCALAPPDATA 'pnpm')) | Out-Null
    } else {
        $candidates.Add((Join-Path $HOME '.pnpm')) | Out-Null
    }

    $globalBin = ($candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if (-not $globalBin) {
        throw 'Unable to determine pnpm global bin directory.'
    }

    New-Item -ItemType Directory -Path $globalBin -Force | Out-Null

    $currentConfigured = ''
    if ($configured.Output.Count -gt 0 -and $null -ne $configured.Output[0]) {
        $currentConfigured = $configured.Output[0].ToString().Trim()
    }
    if ($currentConfigured -ne $globalBin) {
        Invoke-External -FilePath 'pnpm' -Arguments @('config', 'set', 'global-bin-dir', $globalBin, '--global') | Out-Null
    }

    Add-UserPathEntry -PathToAdd $globalBin
    Write-Ok "pnpm global bin: $globalBin"
    return $globalBin
}

function Install-Dependencies {
    if ($SkipInstall) {
        Write-WarnLine 'Skipping dependency installation by request.'
        return
    }

    $script:CurrentStep = 'installing dependencies'
    Write-Step 'Installing workspace dependencies...'
    Invoke-External -FilePath 'pnpm' -Arguments @('install')
    Write-Ok 'Dependencies installed.'
}

function Build-Project {
    if ($SkipBuild) {
        Write-WarnLine 'Skipping build by request.'
        return
    }

    $script:CurrentStep = 'building project'
    Write-Step 'Building KontextMind packages...'
    Invoke-External -FilePath 'pnpm' -Arguments @('build')
    Write-Ok 'Project built successfully.'
}

function Link-Cli {
    param([string]$GlobalBin)

    if ($SkipLink) {
        Write-WarnLine 'Skipping global CLI link by request.'
        return
    }

    $script:CurrentStep = 'linking CLI globally'
    $cliDir = Join-Path $ScriptDir 'apps\cli'
    $cliDist = Join-Path $cliDir 'dist\index.js'

    if (-not (Test-Path -LiteralPath $cliDist)) {
        throw "CLI build output was not found at $cliDist. Run setup without -SkipBuild."
    }

    Write-Step 'Linking KontextMind CLI globally...'
    Push-Location $cliDir
    try {
        $code = Invoke-External -FilePath 'pnpm' -Arguments @('link', '--global') -AllowFailure
        if ($code -ne 0) {
            Write-WarnLine 'Initial pnpm global link failed. Reconfiguring global bin and retrying once.'
            Resolve-PnpmGlobalBin | Out-Null
            Invoke-External -FilePath 'pnpm' -Arguments @('link', '--global')
        }
    } finally {
        Pop-Location
    }

    $cmdShim = Join-Path $GlobalBin 'kontextmind.cmd'
    $psShim = Join-Path $GlobalBin 'kontextmind.ps1'
    if ((Test-Path -LiteralPath $cmdShim) -or (Test-Path -LiteralPath $psShim) -or (Get-CommandPathOrNull 'kontextmind')) {
        Write-Ok 'KontextMind CLI linked globally.'
    } else {
        throw "pnpm link completed, but no kontextmind shim was found in $GlobalBin."
    }
}

function Verify-Cli {
    param([string]$GlobalBin)

    $script:CurrentStep = 'verifying CLI'
    Write-Step 'Verifying kontextmind command...'

    $versionOutput = $null
    $cmd = Get-Command 'kontextmind' -ErrorAction SilentlyContinue
    if ($cmd) {
        $result = Get-ExternalOutput -FilePath 'kontextmind' -Arguments @('--version') -AllowFailure
        if ($result.ExitCode -eq 0) { $versionOutput = ($result.Output | Select-Object -First 1).ToString().Trim() }
    }

    if (-not $versionOutput) {
        $cmdShim = Join-Path $GlobalBin 'kontextmind.cmd'
        if (Test-Path -LiteralPath $cmdShim) {
            $result = Get-ExternalOutput -FilePath $cmdShim -Arguments @('--version') -AllowFailure
            if ($result.ExitCode -eq 0) {
                $versionOutput = ($result.Output | Select-Object -First 1).ToString().Trim()
                Write-WarnLine 'kontextmind works through the shim, but the current shell may need to be reopened for PATH refresh.'
            }
        }
    }

    if (-not $versionOutput) {
        throw (Join-Lines @(
            "Unable to run 'kontextmind --version'.",
            '',
            'Try closing and reopening the terminal, then run:',
            '  kontextmind --version',
            '',
            'If it still fails, run:',
            '  pnpm --dir apps/cli link --global'
        ))
    }

    Write-Ok "KontextMind CLI verified: $versionOutput"
}

function Initialize-ProjectIfRequested {
    if ($SkipInit) {
        Write-WarnLine 'Skipping project initialization by request.'
        return
    }

    $script:CurrentStep = 'checking project initialization'
    Write-Step 'Checking KontextMind project initialization...'

    $configPath = Join-Path $ScriptDir '.kontextmind\config.json'
    if (Test-Path -LiteralPath $configPath) {
        Write-Ok 'This repository is already initialized for KontextMind.'
        return
    }

    if (-not $Init) {
        Write-WarnLine 'This folder is not initialized. Run setup.ps1 -Init or run kontextmind init --yes later.'
        return
    }

    Write-Step 'Initializing this folder with kontextmind init --yes...'
    Invoke-External -FilePath 'kontextmind' -Arguments @('init', '--yes')
    Write-Ok 'Project initialized.'
}

function Optional-PostSetupChecks {
    if ($RunDoctor) {
        $script:CurrentStep = 'running doctor'
        Write-Step 'Running kontextmind doctor...'
        Invoke-External -FilePath 'kontextmind' -Arguments @('doctor')
    }

    if ($BuildKnowledgeBase -or $MockKnowledgeBase) {
        $script:CurrentStep = 'building chatbot knowledge base'
        $args = @('kb', 'build')
        if ($MockKnowledgeBase) { $args += '--mock' }
        Write-Step "Running kontextmind $($args -join ' ')..."
        Invoke-External -FilePath 'kontextmind' -Arguments $args
    }
}

function Pause-IfNeeded {
    param([int]$ExitCode)
    if (-not $NoPause -and $Host.Name -eq 'ConsoleHost') {
        Write-Host ''
        if ($ExitCode -eq 0) {
            Write-Host 'Press any key to exit...' -ForegroundColor DarkGray
        } else {
            Write-Host 'Press any key to exit after reviewing the error above...' -ForegroundColor Yellow
        }
        try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { Read-Host 'Press Enter to exit' | Out-Null }
    }
}

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ScriptDir = (Resolve-Path -LiteralPath $ScriptDir).Path

if ([string]::IsNullOrWhiteSpace($LogDir)) {
    $LogDir = Join-Path $ScriptDir '.logs'
}
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $LogDir "setup-$timestamp.log"

try {
    Start-Transcript -Path $logPath -Force | Out-Null
    $script:TranscriptStarted = $true
} catch {
    Write-WarnLine "Could not start transcript log: $($_.Exception.Message)"
}

$exitCode = 0
try {
    Write-Header 'KONTEXTMIND SETUP'
    Write-Host 'Installing and configuring the KontextMind CLI for this Windows user.' -ForegroundColor White
    Write-Host "Log file: $logPath" -ForegroundColor DarkGray
    Write-Host ''

    Set-Location -LiteralPath $ScriptDir
    Assert-RepositoryLayout -Root $ScriptDir
    Assert-Node
    Ensure-Pnpm
    $globalBin = Resolve-PnpmGlobalBin
    Install-Dependencies
    Build-Project
    Link-Cli -GlobalBin $globalBin
    Verify-Cli -GlobalBin $globalBin
    Initialize-ProjectIfRequested
    Optional-PostSetupChecks

    Write-Header 'SETUP COMPLETE'
    Write-Host 'KontextMind CLI is installed for this user.' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Next commands:' -ForegroundColor Yellow
    Write-Host '  kontextmind --version' -ForegroundColor White
    Write-Host '  kontextmind doctor' -ForegroundColor White
    Write-Host '  kontextmind status' -ForegroundColor White
    Write-Host '  kontextmind init --yes --mode full-agent   # inside a new project' -ForegroundColor White
    Write-Host '  kontextmind scan && kontextmind index' -ForegroundColor White
    Write-Host '  kontextmind summarize --all' -ForegroundColor White
    Write-Host '  kontextmind kb build --mock' -ForegroundColor White
    Write-Host ''

    if ($script:Warnings.Count -gt 0) {
        Write-Host 'Warnings:' -ForegroundColor Yellow
        foreach ($warning in $script:Warnings) { Write-Host "  - $warning" -ForegroundColor Yellow }
        Write-Host ''
    }

    Write-Host "Detailed log: $logPath" -ForegroundColor DarkGray
} catch {
    $exitCode = 1
    Write-Header 'SETUP FAILED'
    Write-ErrorLine "Failed while $script:CurrentStep."
    Write-ErrorLine $_.Exception.Message
    Write-Host ''
    Write-Host 'Troubleshooting:' -ForegroundColor Yellow
    Write-Host '  1. Make sure Node.js 20+ is installed and the terminal was reopened.' -ForegroundColor White
    Write-Host '  2. Check internet/proxy access if pnpm install failed.' -ForegroundColor White
    Write-Host '  3. If PATH was updated, close and reopen the terminal.' -ForegroundColor White
    Write-Host '  4. Rerun with: powershell -ExecutionPolicy Bypass -File .\setup.ps1' -ForegroundColor White
    Write-Host "  5. Review the log: $logPath" -ForegroundColor White
} finally {
    if ($script:TranscriptStarted) {
        try { Stop-Transcript | Out-Null } catch { }
    }
    Pause-IfNeeded -ExitCode $exitCode
}

exit $exitCode
