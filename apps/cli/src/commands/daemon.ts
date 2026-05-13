import { OptionValues } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { detectProject } from '@kontextmind/core';

// Platform-specific autostart paths
function getAutostartDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  } else if (process.platform === 'darwin') {
    return join(process.env.HOME || '', 'Library', 'LaunchAgents');
  } else {
    // Linux
    return join(process.env.HOME || '', '.config', 'autostart');
  }
}

function getAutostartFileName(): string {
  return process.platform === 'win32' ? 'KontextMindMCP.lnk' : 'kontextmind-mcp.desktop';
}

function getAutostartScriptPath(): string {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || '', 'KontextMind', 'kontextmind-daemon.bat');
  }
  return join(process.env.HOME || '', '.kontextmind', 'daemon.sh');
}

// Write autostart configuration
function writeAutostartConfig(scriptPath: string): void {
  const dir = dirname(scriptPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (process.platform === 'win32') {
    // Windows batch file
    const batchContent = '@echo off\ncd /d "%USERPROFILE%"\nstart "" "cmd /c kontextmind daemon"\n';
    writeFileSync(scriptPath, batchContent, 'utf-8');
  } else {
    // Unix shell script
    const shellContent = `#!/bin/bash\ncd "$HOME"\nkontextmind daemon &\n`;
    writeFileSync(scriptPath, shellContent, 'utf-8');
    try {
      // Make executable on Unix
      const { execSync } = require('child_process');
      execSync(`chmod +x "${scriptPath}"`);
    } catch {
      // Ignore chmod errors
    }
  }
}

// Create startup entry
function createAutostartEntry(): boolean {
  try {
    const scriptPath = getAutostartScriptPath();
    writeAutostartConfig(scriptPath);

    const autostartDir = getAutostartDir();
    const autostartFile = join(autostartDir, getAutostartFileName());

    if (process.platform === 'win32') {
      // On Windows, create a shortcut or batch file in startup
      const batchContent = `@echo off\n"${scriptPath}"\n`;
      writeFileSync(autostartFile, batchContent, 'utf-8');
    } else {
      // On Unix, create a .desktop file
      const desktopContent = `[Desktop Entry]
Type=Application
Name=KontextMind MCP
Comment=Start KontextMind MCP server on login
Exec=${scriptPath}
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
`;
      writeFileSync(autostartFile, desktopContent, 'utf-8');
    }

    return true;
  } catch (error) {
    console.error(chalk.red('Failed to create autostart entry:'), error);
    return false;
  }
}

// Remove startup entry
function removeAutostartEntry(): boolean {
  try {
    const autostartDir = getAutostartDir();
    const autostartFile = join(autostartDir, getAutostartFileName());

    if (existsSync(autostartFile)) {
      const { unlinkSync } = require('fs');
      unlinkSync(autostartFile);
    }

    return true;
  } catch (error) {
    console.error(chalk.red('Failed to remove autostart entry:'), error);
    return false;
  }
}

// Check if autostart is registered
function isAutostartEnabled(): boolean {
  const autostartDir = getAutostartDir();
  const autostartFile = join(autostartDir, getAutostartFileName());
  return existsSync(autostartFile);
}

// Daemon state
let daemonProcess: ChildProcess | null = null;
let mcpProcess: ChildProcess | null = null;
let isShuttingDown = false;

// PID file management
function getPidFile(): string {
  const pidDir = join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.kontextmind');
  if (!existsSync(pidDir)) {
    mkdirSync(pidDir, { recursive: true });
  }
  return join(pidDir, 'daemon.pid');
}

function writePidFile(pid: number): void {
  writeFileSync(getPidFile(), String(pid), 'utf-8');
}

function deletePidFile(): void {
  const pidFile = getPidFile();
  if (existsSync(pidFile)) {
    const { unlinkSync } = require('fs');
    try {
      unlinkSync(pidFile);
    } catch {
      // Ignore
    }
  }
}

function readPidFile(): number | null {
  const pidFile = getPidFile();
  if (!existsSync(pidFile)) return null;
  try {
    const content = readFileSync(pidFile, 'utf-8');
    return parseInt(content.trim(), 10) || null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    if (process.platform === 'win32') {
      // On Windows, use tasklist to check
      const { execSync } = require('child_process');
      execSync(`tasklist /FI "PID eq ${pid}" /NH`, { stdio: 'pipe' });
      return true;
    } else {
      // On Unix, use kill -0
      process.kill(pid, 0);
      return true;
    }
  } catch {
    return false;
  }
}

// Setup shutdown handlers
function setupShutdownHandlers(): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'];
  for (const signal of signals) {
    process.on(signal, () => {
      if (!isShuttingDown) {
        console.log(chalk.yellow('\nShutting down daemon...'));
        isShuttingDown = true;
        stopDaemon();
        process.exit(0);
      }
    });
  }
}

// Start MCP server as daemon
async function startMcpDaemon(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Try to find kontextmind executable
    const exePath = process.execPath;
    const isPnpm = exePath.includes('pnpm') || exePath.includes('node_modules');
    const command = isPnpm ? 'kontextmind' : process.argv[0];

    console.log(chalk.cyan('Starting MCP server daemon...'));

    // Start MCP server in stdio mode
    mcpProcess = spawn(command, ['mcp', '--transport', 'stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env, KONTEXTMIND_DAEMON: 'true' },
    });

    let initialized = false;

    mcpProcess.stdout?.on('data', (data) => {
      if (!initialized) {
        // Wait for protocol version response
        try {
          const msg = JSON.parse(data.toString());
          if (msg.result?.protocolVersion) {
            initialized = true;
            console.log(chalk.green('MCP server daemon started successfully'));
            console.log(chalk.gray('MCP server ready - waiting for client connections...'));
          }
        } catch {
          // Not JSON yet, continue waiting
        }
      }
    });

    mcpProcess.stderr?.on('data', (data) => {
      // Log stderr for debugging
      const output = data.toString().trim();
      if (output && !output.includes('DeprecationWarning')) {
        console.error(chalk.gray('[MCP stderr]:'), output);
      }
    });

    mcpProcess.on('error', (error) => {
      console.error(chalk.red('MCP daemon error:'), error.message);
      reject(error);
    });

    mcpProcess.on('exit', (code) => {
      if (!isShuttingDown && code !== 0) {
        console.error(chalk.red(`MCP daemon exited with code ${code}`));
      }
      mcpProcess = null;
    });

    // Give it a moment to start
    setTimeout(() => {
      if (mcpProcess && !initialized) {
        initialized = true; // Consider it started even without protocol response
        console.log(chalk.green('MCP server daemon started'));
      }
      resolve();
    }, 1000);
  });
}

// Stop daemon
function stopDaemon(): void {
  if (mcpProcess) {
    try {
      mcpProcess.kill('SIGTERM');
    } catch {
      // Process might already be dead
    }
    mcpProcess = null;
  }

  if (daemonProcess) {
    try {
      daemonProcess.kill('SIGTERM');
    } catch {
      // Ignore
    }
    daemonProcess = null;
  }

  deletePidFile();
}

// Main daemon command
export async function daemonCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();

  // Handle autostart options
  if (options.removeAutostart) {
    if (removeAutostartEntry()) {
      console.log(chalk.green('Removed from system autostart'));
    } else {
      console.log(chalk.red('Failed to remove from autostart'));
    }
    return;
  }

  if (options.autostart) {
    if (createAutostartEntry()) {
      console.log(chalk.green('Registered with system autostart'));
    } else {
      console.log(chalk.red('Failed to register autostart'));
    }
    return;
  }

  // Check for existing daemon
  const existingPid = readPidFile();
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(chalk.yellow(`Daemon already running with PID ${existingPid}`));
    console.log(`  Run: kill ${existingPid} to stop it`);
    return;
  }

  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    console.log(`Run: ${chalk.cyan('kontextmind init')}`);
    process.exit(1);
  }

  const mcpPort = parseInt(String(options.port || '7332'), 10);
  const apiPort = parseInt(String(options.apiPort || '7331'), 10);

  console.log(chalk.bold('KontextMind Daemon'));
  console.log(`Project: ${project.name}`);
  console.log(`MCP Port: ${mcpPort}`);
  console.log(`API Port: ${apiPort}`);
  console.log('');

  // Setup shutdown handlers
  setupShutdownHandlers();

  // Write PID file
  writePidFile(process.pid);
  console.log(chalk.gray(`PID: ${process.pid}`));

  // Check autostart status
  if (isAutostartEnabled()) {
    console.log(chalk.green('✓ Autostart enabled'));
  } else {
    console.log(chalk.gray('○ Autostart disabled (run with --autostart to enable)'));
  }

  console.log('');

  try {
    // Start MCP daemon
    await startMcpDaemon(mcpPort);

    console.log(chalk.green('\nKontextMind daemon is running'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
  } catch (error) {
    console.error(chalk.red('Failed to start daemon:'), error);
    process.exit(1);
  }
}