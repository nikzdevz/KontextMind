# Prompt Templates for AI Agents

Ready-to-use prompts for AI agents after MCP configuration.

---

## For New Projects (First Time Setup)

```
This project has KontextMind configured as an MCP server. Initialize and learn it:
1. Run: kontextmind init --mode full-agent --yes
2. Run: kontextmind scan && kontextmind index && kontextmind kb build --mock
3. Run: kontextmind summarize --mock
4. Read .context/boot-prompt.md and follow all steps to fully understand this project
5. Update .context/handoff.md with complete project overview
6. Answer: What is this project, what does it do, and what are the key components?
```

---

## For Existing Projects (Already Initialized)

```
Read .context/boot-prompt.md and follow it to learn this project completely.
Focus on understanding the architecture, key files, and dependencies.
Update the handoff file with your findings.
```

---

## For Quick Status Check

```
Run kontextmind status and kontextmind doctor to check project health.
Summarize the current state and any issues.
```

---

## For Code Understanding

```
Use kontextmind to understand this codebase:
- Ask: "What is the architecture of this project?"
- Ask: "What are the main components and how do they interact?"
- Ask: "What is the tech stack and main dependencies?"
- Ask: "How do I build and run this project?"
```

---

## For Development Work

```
Before making changes:
1. Read .context/handoff.md for current project state
2. Read .context/current-state.md for project status
3. Run kontextmind ask "What was the last work done?"
4. Understand the affected files with kontextmind ask "Explain [filename]"

After completing work:
1. Update .context/handoff.md with what was done
2. Run kontextmind scan --changed-only
3. Run kontextmind summarize --changed-only
4. Summarize the changes made
```

---

## One-Liner Prompts

### Full Learning
```
Use the boot prompt at .context/boot-prompt.md to learn this project.
```

### Quick Start
```
Initialize KontextMind, scan all files, and give me a project overview.
```

### Architecture
```
Explain the architecture of this project using kontextmind tools.
```

### Start Working
```
Read .context/handoff.md, then summarize the current state and any pending work.
```

---

## For Roo Code / Cline Specific

```
@CLAUDE.md rules apply. This project uses KontextMind.
1. Read .context/handoff.md
2. Read .context/boot-prompt.md
3. Follow the boot prompt to learn the project
4. Update documentation with findings

Ask if you need clarification on anything.
```