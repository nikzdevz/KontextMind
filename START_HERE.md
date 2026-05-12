# Start Here - KontextMind Clean Share Package

This is a clean source package for KontextMind. It excludes local secrets, generated runtime memory, build outputs, and dependency folders.

## Windows setup

1. Install Node.js 20+ or run setup with `-InstallPrerequisites` to try winget-based installation.
2. Open PowerShell or CMD in this folder.
3. Run:

```powershell
.\setup.bat
```

or:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Useful options:

```powershell
.\setup.ps1 -InstallPrerequisites
.\setup.ps1 -RunDoctor
.\setup.ps1 -MockKnowledgeBase
```

## After setup

```powershell
kontextmind --version
kontextmind doctor
kontextmind status
```

For a new target project, run:

```powershell
kontextmind init --yes --mode full-agent
kontextmind scan
kontextmind index
kontextmind summarize --all
kontextmind kb build --mock
```
