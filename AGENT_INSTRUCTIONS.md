# KontextMind Agent Configuration Instructions

**For AI coding agents (Claude Code, Codex, Continue, Cursor, etc.)**

---

## Quick Start

When you start working in a project, check if KontextMind is configured and set it up if needed.

### Decision Flow

```
Is .kontextmind/config.json present?
├── YES → KontextMind is configured → Continue with work
└── NO  → KontextMind not configured → Run setup (see below)
```

---

## Full Setup Instructions

### Step 1: Check if KontextMind is Configured

Run at the start of every session:

```bash
# Check if KontextMind exists
if [ -f ".kontextmind/config.json" ]; then
  echo "KontextMind is configured"
else
  echo "KontextMind not configured - initializing..."
  # Run initialization
fi
```

Or use the MCP tool (if available):

```typescript
// MCP: project.status will tell you if configured
await tools.project.status()
```

### Step 2: If Not Configured, Initialize

```bash
kontextmind init --yes --mode full-agent --agents claude,codex,generic
```

**What this creates:**

| File/Directory | Purpose |
|----------------|---------|
| `CLAUDE.md` | Claude Code instructions |
| `AGENTS.md` | Generic agent instructions |
| `README_AI.md` | AI agent guide |
| `.toolignore` | Files to ignore |
| `.context/` | Project memory directory |
| `.kontextmind/` | Configuration directory |
| `.kg/` | Knowledge graph directory |
| `.summaries/` | AI summaries directory |
| `.logs/` | Audit logs directory |

### Step 3: Build Complete Project Knowledge (Background)

**IMPORTANT:** Run these commands in the BACKGROUND and continue with your work. Summarization can take 30+ minutes for large projects.

```bash
# Run all build commands in BACKGROUND (use & to run in background)

# 1. Scan all files and create file index (fast - seconds)
kontextmind scan &

# Wait for scan to complete, then run index
wait  # Wait for background jobs
kontextmind index &

# Wait for index to complete
wait
```

### Step 4: Start Summarization in Background (Non-Blocking)

**This is critical:** Start summarization and continue working. Check progress periodically.

```bash
# Start summarization in background - THIS WILL TAKE TIME
kontextmind summarize --all > /tmp/kontextmind-summarize.log 2>&1 &

# Continue with your work immediately - DO NOT WAIT
# The summarization runs in background while you work

# Periodically check progress by running:
kontextmind status

# Or check if any summaries exist:
ls -la .summaries/ | head -20

# Watch the log file:
tail -f /tmp/kontextmind-summarize.log
```

### Step 5: Check Progress and Auto-Build KB

After summarization completes (or periodically during work), build the knowledge base:

```bash
# Check if summarization is still running
ps aux | grep "kontextmind summarize" | grep -v grep

# If summarization is complete (check for .summaries/*.md files)
if [ $(ls .summaries/ 2>/dev/null | wc -l) -gt 0 ]; then
    echo "Summaries complete, building knowledge base..."
    kontextmind kb build
fi

# Or run kb build in background after summarize completes
# Check progress periodically with:
kontextmind status
kontextmind doctor
```

### Step 6: Verify Setup

```bash
# Check project status
kontextmind status

# Check configuration health
kontextmind doctor
```

Expected output:
```
KontextMind Status
├── Initialized: yes
├── Mode: full-agent
├── Files indexed: XXX
├── Symbols indexed: XXX
├── Summaries generated: XXX/XXX
└── Knowledge base ready: yes/no (in progress)
```

---

## Complete Background Setup Command

For a NEW project, run this SEQUENCE and continue working:

```bash
# 1. Initialize (fast)
kontextmind init --yes --mode full-agent

# 2. Scan (fast - seconds)
kontextmind scan

# 3. Index (fast - seconds to minutes)
kontextmind index

# 4. Start summarization in BACKGROUND - DON'T WAIT
# This command blocks nothing and runs while you work
nohup kontextmind summarize --all > kontextmind-summarize.log 2>&1 &
echo "Summarization started in background. Check progress with: tail -f kontextmind-summarize.log"
echo "Or check with: kontextmind status"

# 5. Continue with your actual work
# You can ask questions about the project - partial summaries are better than none

# 6. Periodically check summarization progress:
# - Run: tail -f kontextmind-summarize.log
# - Or: watch -n 10 'ls .summaries/*.md 2>/dev/null | wc -l'

# 7. When summarization completes, build KB:
# Run: kontextmind kb build
```

---

## Configuration Reference

### Initialization Options

| Option | Description | Default |
|--------|-------------|---------|
| `--yes` | Skip all prompts | false |
| `--mode` | Agent mode (readonly, suggest, edit-with-approval, **full-agent**) | readonly |
| `--agents` | Comma-separated agent list | claude,codex,generic |
| `--git` | Git integration (auto, enabled, disabled) | auto |
| `--provider` | LLM provider (none, openai, anthropic, openai-compatible) | none |

### Build Commands

| Command | Duration | Background? | Output |
|---------|----------|-------------|--------|
| `kontextmind scan` | Seconds | No | `.kg/file-index.json` |
| `kontextmind index` | Seconds-Minutes | No | `.kg/symbol-index.json` |
| `kontextmind summarize --all` | 30-60+ minutes | YES | `.summaries/**/*.md` |
| `kontextmind kb build` | Minutes | No | `.kontextmind/chatbot/*.json` |
| `kontextmind secrets scan` | Seconds | No | `.logs/security-events.log` |

---

## Agent Workflow

### At Start of Every Session

```
1. Check for .kontextmind/config.json
2. If exists → Read .context/handoff.md and .context/current-state.md
3. If not exists → Run kontextmind init --yes --mode full-agent
4. Start scan/index in background if not done
5. Start summarize --all in BACKGROUND (non-blocking)
6. Continue with assigned tasks
7. Periodically check summarize progress
8. When summarize completes, run kb build
```

### During Work

```
1. Follow .kontextmind/policy.json rules
2. Update .context/handoff.md after significant changes
3. Use kontextmind ask for project questions (partial summaries work)
4. Use MCP tools if available (project.status, project.search, etc.)
5. Check summarize progress with: tail -f kontextmind-summarize.log
6. When summaries done, run: kontextmind kb build
```

### At End of Session

```
1. Update .context/handoff.md with:
   - Work completed
   - Summarization progress (X/757 files done)
   - Current state
   - Next steps
   - Pending decisions
2. Update .context/current-state.md with:
   - Recent activity
   - Summarization status
   - Project status changes
3. Commit changes to git
```

---

## MCP Server Setup (Recommended)

For MCP-enabled agents (Claude Code, Continue, etc.):

### Add to Claude Code Settings

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "kontextmind": {
      "command": "npx",
      "args": ["kontextmind", "mcp"]
    }
  }
}
```

### Available MCP Tools

Once MCP is connected, you have these tools:

```typescript
// Status and search
project.status()           // Get project configuration state
project.search(query)      // Search files and symbols

// File and symbol info
project.get_file_summary(path)    // Get file summary
project.get_symbol_summary(name)  // Get symbol info

// Dependency analysis
project.find_dependencies(path)   // Find file dependencies
project.find_callers(name)        // Find function callers
project.find_related_files(path)  // Find related files

// Q&A and handoff
project.ask_readonly(question)    // Ask question (no code)
project.create_handoff(summary)  // Create handoff document

// Maintenance
project.refresh_summary(paths)   // Refresh stale summaries
project.security_scan()           // Scan for security issues
```

### MCP Resources

```typescript
// Access project data via URIs
kontextmind://project/overview        // Project overview
kontextmind://project/architecture    // Architecture docs
kontextmind://project/current-state   // Current state
kontextmind://graph/files            // File dependency graph
kontextmind://graph/symbols          // Symbol dependency graph
kontextmind://handoff/latest         // Latest handoff document
kontextmind://summaries/files        // All file summaries
```

---

## LLM Provider Configuration

For AI-powered features (summaries, chatbot), configure an LLM provider:

### OpenAI-Compatible (Recommended for most use cases)

```bash
# Set environment variables
export LLM_API_KEY=sk-your-openai-key
export LLM_PROVIDER=openai-compatible
export LLM_BASE_URL=https://api.openai.com/v1
export LLM_MODEL=gpt-4o
```

Or create `.kontextmind/providers.json`:

```json
{
  "selected_provider": "primary",
  "providers": {
    "primary": {
      "type": "openai-compatible",
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-your-key",
      "model": "gpt-4o"
    },
    "local": {
      "type": "openai-compatible",
      "base_url": "http://localhost:8080/v1",
      "api_key": "not-needed",
      "model": "llama-3"
    }
  }
}
```

### For Local Models (Ollama, LM Studio)

```json
{
  "providers": {
    "local": {
      "type": "openai-compatible",
      "base_url": "http://localhost:8080/v1",
      "api_key": "not-needed",
      "model": "llama-3"
    }
  }
}
```

---

## Mode Reference

| Mode | File Modifications | Description |
|------|-------------------|-------------|
| `readonly` | Prohibited | Summaries and context only |
| `suggest` | Prohibited | Suggestions without implementation |
| `edit-with-approval` | Requires approval | Implement with explicit approval |
| `full-agent` | Allowed | Act autonomously within policy |

**Recommendation:** Use `full-agent` mode for development, `readonly` mode for code review.

---

## Troubleshooting

### "KontextMind not configured"

Run:
```bash
kontextmind init --yes --mode full-agent
```

### "LLM not configured"

Run with provider:
```bash
kontextmind summarize --all --provider openai-compatible --model gpt-4o
```

Or set environment:
```bash
export LLM_API_KEY=your-key
kontextmind summarize --all
```

### "Project not found" (MCP error)

MCP must run from a project directory. Initialize the project first:
```bash
cd /your/project
kontextmind init --yes
```

### "Summaries not generating"

1. Check LLM provider is configured:
   ```bash
   kontextmind doctor
   ```

2. Check API key is valid:
   ```bash
   echo $LLM_API_KEY
   ```

3. Try mock mode for testing:
   ```bash
   kontextmind summarize --mock
   kontextmind kb build --mock
   ```

---

## Agent-Specific Instructions

### Claude Code

Claude Code automatically looks for `CLAUDE.md`. KontextMind creates this during init.

1. Claude Code reads `.context/handoff.md` at start of session
2. Claude Code follows `.kontextmind/policy.json` rules
3. Claude Code can use MCP tools if configured

### Codex / Copilot

1. Read `AGENTS.md` for generic agent instructions
2. Follow `.kontextmind/policy.json` rules
3. Update `.context/handoff.md` after work

### Continue / Cursor

1. Configure MCP server in IDE settings
2. Use MCP tools for project queries
3. Follow `.kontextmind/policy.json` rules

---

## File Reference

### Configuration Files

| File | Purpose |
|------|---------|
| `.kontextmind/config.json` | Project configuration |
| `.kontextmind/policy.json` | Security/operational rules |
| `.kontextmind/providers.json` | LLM provider settings |
| `.kontextmind/instructions.master.md` | Master agent instructions |

### Generated Files

| File/Directory | Purpose |
|----------------|---------|
| `.kg/file-index.json` | All project files with hashes |
| `.kg/symbol-index.json` | All code symbols |
| `.kg/dependency-graph.json` | Import/export relationships |
| `.summaries/*.md` | LLM-generated file summaries |
| `.kontextmind/chatbot/*.json` | Chatbot knowledge base |

### Memory Files

| File | Purpose |
|------|---------|
| `.context/handoff.md` | Session handoff notes |
| `.context/current-state.md` | Project status |
| `.context/conventions.md` | Coding conventions |
| `.logs/*.log` | Audit, security, cost events |

---

## Summary Checklist

When setting up a new project:

- [ ] Run `kontextmind init --yes --mode full-agent`
- [ ] Run `kontextmind scan` to index files
- [ ] Run `kontextmind index` to extract symbols
- [ ] Run `kontextmind summarize --all` (if LLM configured)
- [ ] Run `kontextmind kb build` to create chatbot KB
- [ ] Run `kontextmind secrets scan` (optional)
- [ ] Run `kontextmind status` to verify setup
- [ ] Read `.context/handoff.md` to understand project state

---

## Quick Reference Card

```bash
# Setup (run once per project)
kontextmind init --yes --mode full-agent

# Build knowledge (run in sequence)
kontextmind scan          # Index files
kontextmind index         # Extract symbols
kontextmind summarize --all  # Generate summaries
kontextmind kb build      # Build chatbot KB

# Query
kontextmind ask "question"

# Check status
kontextmind status
kontextmind doctor
```

---

**End of Agent Instructions**
## Summary-first KontextMind usage

Agents should treat generated summaries as the default project context layer. Before reading raw files, use `.summaries/*`, `.kontextmind/chatbot/*`, or MCP tools/resources. Prefer `project.search_summaries`, `project.get_file_summary`, `project.get_symbol_summary`, `project.get_module_summary`, `project.get_api_summary`, and `project.get_decision_summary`. Read source only when summaries are missing, stale, or insufficient, then refresh summaries and rebuild the KB after meaningful changes.
