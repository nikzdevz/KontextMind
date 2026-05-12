@echo off
setlocal EnableExtensions DisableDelayedExpansion

REM ============================================================
REM KontextMind Windows Setup Launcher
REM Delegates to setup.ps1 so errors are logged and reported well.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "PS_EXE="
set "PS_EXTRA=-NoPause"
set "BATCH_NO_PAUSE=0"

for %%A in (%*) do (
    if /I "%%~A"=="-NoPause" (
        set "PS_EXTRA="
        set "BATCH_NO_PAUSE=1"
    )
    if /I "%%~A"=="/NoPause" (
        set "PS_EXTRA="
        set "BATCH_NO_PAUSE=1"
    )
    if /I "%%~A"=="-Help" (
        set "BATCH_NO_PAUSE=1"
    )
    if /I "%%~A"=="/?" (
        set "BATCH_NO_PAUSE=1"
    )
)

where pwsh.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 set "PS_EXE=pwsh.exe"

if not defined PS_EXE (
    where powershell.exe >nul 2>&1
    if %ERRORLEVEL% EQU 0 set "PS_EXE=powershell.exe"
)

if not defined PS_EXE (
    echo.
    echo [ERROR] PowerShell was not found on this computer.
    echo KontextMind setup requires Windows PowerShell 5.1 or PowerShell 7+.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   KONTEXTMIND SETUP
echo   Launching robust PowerShell setup
echo ============================================================
echo.
echo Using: %PS_EXE%
echo.

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup.ps1" %PS_EXTRA% %*
set "SETUP_EXIT=%ERRORLEVEL%"

if not "%SETUP_EXIT%"=="0" (
    echo.
    echo ============================================================
    echo   KONTEXTMIND SETUP FAILED ^(exit code %SETUP_EXIT%^)
    echo ============================================================
    echo.
    echo Read the error above and the log under .logs\setup-*.log.
    echo.
) else (
    echo.
    echo KontextMind setup finished successfully.
)

if /I not "%KONTEXTMIND_SETUP_NO_PAUSE%"=="1" if "%BATCH_NO_PAUSE%"=="0" (
    echo.
    pause
)

exit /b %SETUP_EXIT%
