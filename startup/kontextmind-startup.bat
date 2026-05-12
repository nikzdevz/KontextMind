@echo off
REM KontextMind Auto-Start Batch File
REM Usage: Place in Windows Startup folder or schedule with Task Scheduler

REM Set default project path
set PROJECT_PATH=d:\Projects\KontextMind

REM Change to project directory
cd /d "%PROJECT_PATH%"

REM Start MCP server in background
start "KontextMind MCP" cmd /c "pnpm exec kontextmind mcp --mode readonly"

REM Wait a moment
timeout /t 2 >nul

REM Start HTTP server in background
start "KontextMind API" cmd /c "pnpm exec kontextmind serve --port 7331 --host 127.0.0.1 --mode readonly"

echo KontextMind servers started!
pause