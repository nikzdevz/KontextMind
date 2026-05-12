# Quick Setup

Download the repository and run one of these files from the repository root to set up the KontextMind CLI.

## Option 1: Batch File (Windows CMD/PowerShell)
```
setup.bat
```

## Option 2: PowerShell Script (Recommended)
```
setup.ps1
```
If script execution is blocked, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

## What These Scripts Do

1. **Validate repository layout** - confirms required workspace files exist
2. **Check prerequisites** - requires Node.js 20+ and npm
3. **Install/configure pnpm** - uses corepack first, npm fallback if needed
4. **Configure PATH** - sets a pnpm global bin folder in the user PATH
5. **Install dependencies** - `pnpm install`
6. **Build the project** - `pnpm build`
7. **Link CLI globally** - `pnpm link --global` for `kontextmind`
8. **Verify installation** - runs `kontextmind --version`
9. **Write logs** - detailed logs go to `.logs/setup-*.log`

## Useful Options

```powershell
.\setup.ps1 -RunDoctor
.\setup.ps1 -MockKnowledgeBase
.\setup.ps1 -InstallPrerequisites
.\setup.ps1 -SkipInstall -SkipBuild
.\setup.ps1 -Help
```

## After Setup

1. **Close and reopen your terminal** (to refresh PATH)
2. **Verify installation:**
   ```cmd
   kontextmind --version
   ```
3. **Initialize project:**
   ```cmd
   kontextmind init --yes
   ```
4. **Build knowledge base (optional):**
   ```cmd
   kontextmind kb build --mock
   ```

## Common Commands

| Command | Description |
|---------|-------------|
| `kontextmind --help` | Show all commands |
| `kontextmind doctor` | Check setup health |
| `kontextmind status` | Show project status |
| `kontextmind ask "question"` | Ask questions about code |
| `kontextmind scan` | Scan and index files |
| `kontextmind mcp` | Start MCP server (for AI IDE integration) |
| `kontextmind serve` | Start HTTP API server |

## Troubleshooting

**"kontextmind is not recognized"**
- Make sure you closed and reopened your terminal after setup
- Run `setup.bat` again to re-link the CLI
- Check the latest `.logs/setup-*.log` file

**Still having issues?**
```cmd
cd apps\cli
pnpm link --global
```

Then restart your terminal.
