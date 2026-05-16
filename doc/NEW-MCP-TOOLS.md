# New MCP Tools (Phase 11+) - Complete Usage Guide

**70+ MCP tools now available** | Previously: 40 tools

---

## Table of Contents

1. [Learning & Adaptation Tools](#1-learning--adaptation-tools)
2. [Agent Awareness Tools](#2-agent-awareness-tools)
3. [Task Detection Tools](#3-task-detection-tools)
4. [Analytics Tools](#4-analytics-tools)
5. [Quality Tools](#5-quality-tools)
6. [Context & Insights Tools](#6-context--insights-tools)
7. [Summary Retrieval Tools](#7-summary-retrieval-tools)
8. [Dependency Analysis Tools](#8-dependency-analysis-tools)
9. [Session & Continuity Tools](#9-session--continuity-tools)
10. [Write Operations](#10-write-operations)
11. [CLI Equivalents](#11-cli-equivalents)

---

## 1. Learning & Adaptation Tools

### project.learn_sync
Trigger a manual learning sync to extract knowledge from summaries and Q&A history.

```typescript
// MCP call
mcp__kontextmind__project.learn_sync {}

// Response
{
  "patternsLearned": number,
  "decisions": string[],
  "successRate": number,
  "message": string
}
```

**Use Case:** Trigger learning sync at end of session or before important task.

---

### project.learn_import
Import learning data from another KontextMind project.

```typescript
// MCP call
mcp__kontextmind__project.learn_import {
  "sourceProject": "/path/to/other/project",
  "dataTypes": ["summaries", "decisions"]
}

// Response
{
  "imported": { summaries: number, decisions: number },
  "message": string
}
```

**Use Case:** Share learned patterns across projects.

---

### project.learn_stats
Get learning statistics including outcomes, success rates, and patterns learned.

```typescript
// MCP call
mcp__kontextmind__project.learn_stats {}

// Response
{
  "totalOutcomes": number,
  "successfulOutcomes": number,
  "successRate": number,
  "patternsLearned": number,
  "lastSync": string
}
```

**Use Case:** Check learning progress and effectiveness.

---

### project.learn_patterns
Get learned success and failure patterns for a task type.

```typescript
// MCP call
mcp__kontextmind__project.learn_patterns {
  "taskType": "code_write"  // code_write, debug, refactor, review, etc.
}

// Response
{
  "taskType": string,
  "patterns": [
    {
      "type": "success" | "failure",
      "description": string,
      "frequency": number,
      "confidence": number
    }
  ]
}
```

**Use Case:** Understand what approaches work best for different tasks.

---

### project.learn_suggestions
Get improvement suggestions based on learned patterns.

```typescript
// MCP call
mcp__kontextmind__project.learn_suggestions {
  "limit": 10,
  "category": "skill"  // skill, pattern, approach, documentation
}

// Response
{
  "suggestions": [
    {
      "id": string,
      "category": string,
      "title": string,
      "description": string,
      "priority": "high" | "medium" | "low"
    }
  ]
}
```

**Use Case:** Get actionable improvements based on past experience.

---

### project.learn_export
Export learning data for training purposes.

```typescript
// MCP call
mcp__kontextmind__project.learn_export {
  "taskType": "code_write",
  "minConfidence": 0.7
}

// Response
{
  "exportId": string,
  "recordCount": number,
  "format": string,
  "data": object[]
}
```

**Use Case:** Export training data for fine-tuning or analysis.

---

## 2. Agent Awareness Tools

### project.agent_state
Get current agent state including current task, goals, blockers, and energy level.

```typescript
// MCP call
mcp__kontextmind__project.agent_state {}

// Response
{
  "currentTask": string | null,
  "goals": string[],
  "blockers": string[],
  "energyLevel": "high" | "medium" | "low",
  "mode": "readonly" | "chatbot" | "suggest" | "edit" | "full-agent",
  "lastActivity": string
}
```

**Use Case:** Understand current context and blockers before starting work.

---

### project.agent_capabilities
Get agent capability profile including strengths, weak areas, and preferred approaches.

```typescript
// MCP call
mcp__kontextmind__project.agent_capabilities {}

// Response
{
  "strengths": string[],
  "weakAreas": string[],
  "successRates": {
    "code_write": number,
    "debug": number,
    "refactor": number,
    "review": number
  },
  "preferredApproaches": string[]
}
```

**Use Case:** Understand what the agent does well and where it struggles.

---

### project.agent_antipatterns
Get anti-patterns the agent has learned to avoid.

```typescript
// MCP call
mcp__kontextmind__project.agent_antipatterns {}

// Response
{
  "antiPatterns": [
    {
      "pattern": string,
      "description": string,
      "impact": "high" | "medium" | "low"
    }
  ]
}
```

**Use Case:** Avoid repeating past mistakes.

---

### project.agent_assess
Self-assess current state and get suggestions for improvement.

```typescript
// MCP call
mcp__kontextmind__project.agent_assess {
  "taskDescription": "Implementing user authentication",
  "timeSpent": 300000,  // milliseconds
  "recentErrors": ["TypeError: undefined"]
}

// Response
{
  "selfAssessment": {
    "efficiency": number,
    "quality": number,
    "blockers": string[],
    "suggestions": string[]
  },
  "confidence": number,
  "estimatedTimeRemaining": number
}
```

**Use Case:** Get help when stuck or struggling with a task.

---

## 3. Task Detection Tools

### project.task_detect
Detect current task boundaries and context from recent activity.

```typescript
// MCP call
mcp__kontextmind__project.task_detect {}

// Response
{
  "taskId": string,
  "title": string,
  "goal": string,
  "progress": string,
  "pending": string[],
  "filesModified": string[],
  "sessionId": string
}
```

**Use Case:** Start a new session and understand what was being worked on.

---

### project.task_complete
Mark current task as completed.

```typescript
// MCP call
mcp__kontextmind__project.task_complete {
  "taskId": "task-123"
}

// Response
{
  "success": boolean,
  "taskId": string,
  "completedAt": string
}
```

**Use Case:** Mark task done at end of work session.

---

### project.task_update_pending
Update pending work for a task.

```typescript
// MCP call
mcp__kontextmind__project.task_update_pending {
  "taskId": "task-123",
  "pendingWork": "Write tests, update documentation"
}

// Response
{
  "success": boolean,
  "taskId": string,
  "updatedAt": string
}
```

**Use Case:** Track remaining work for handoff.

---

## 4. Analytics Tools

### project.ask_stats
Get Q&A statistics including cache hit rate, response times, and tier distribution.

```typescript
// MCP call
mcp__kontextmind__project.ask_stats {
  "period": "daily"  // daily | weekly
}

// Response
{
  "totalQuestions": number,
  "cacheHits": number,
  "cacheHitRate": number,
  "averageResponseTime": number,
  "tierDistribution": {
    "direct": number,
    "retrieved": number,
    "generated": number
  }
}
```

**Use Case:** Understand Q&A performance and cache effectiveness.

---

### project.ask_top_questions
Get the most frequently asked questions.

```typescript
// MCP call
mcp__kontextmind__project.ask_top_questions {
  "limit": 10
}

// Response
{
  "questions": [
    {
      "question": string,
      "count": number,
      "lastAsked": string
    }
  ]
}
```

**Use Case:** Identify common questions for documentation improvement.

---

### project.ask_quality
Get answer quality metrics and cache coverage.

```typescript
// MCP call
mcp__kontextmind__project.ask_quality {}

// Response
{
  "cacheCoverage": number,
  "qualityScore": number,
  "responseQuality": {
    "accuracy": number,
    "completeness": number,
    "relevance": number
  }
}
```

**Use Case:** Track answer quality over time.

---

## 5. Quality Tools

### project.quality_trends
Get quality trends over a time period.

```typescript
// MCP call
mcp__kontextmind__project.quality_trends {
  "days": 7
}

// Response
{
  "current": {
    "averageQuality": number,
    "totalQuestions": number,
    "cacheHitRate": number
  },
  "previous": { ... },
  "trends": {
    "quality": "improving" | "declining" | "stable",
    "volume": "increasing" | "decreasing" | "stable"
  }
}
```

**Use Case:** Track quality improvements or regressions.

---

### project.quality_report
Generate a comprehensive quality report.

```typescript
// MCP call
mcp__kontextmind__project.quality_report {
  "period": "weekly"  // daily | weekly
}

// Response
{
  "summary": string,
  "statistics": {
    "totalQuestions": number,
    "cacheHits": number,
    "averageResponseTime": number,
    "qualityScore": number
  },
  "recommendations": string[]
}
```

**Use Case:** Generate periodic quality reports.

---

### project.quality_performance
Get performance statistics including latency and token usage.

```typescript
// MCP call
mcp__kontextmind__project.quality_performance {}

// Response
{
  "averageResponseTime": number,
  "p50": number,
  "p95": number,
  "p99": number,
  "tokenUsage": {
    "promptTokens": number,
    "completionTokens": number,
    "totalTokens": number
  }
}
```

**Use Case:** Monitor performance metrics.

---

## 6. Context & Insights Tools

### project.context_stats
Get dynamic context engine statistics.

```typescript
// MCP call
mcp__kontextmind__project.context_stats {}

// Response
{
  "tokensUsed": number,
  "budget": number,
  "utilizationPercent": number,
  "compressionRatio": number,
  "lastCompress": string
}
```

**Use Case:** Understand context window usage.

---

### project.context_export
Export current context window for debugging or analysis.

```typescript
// MCP call
mcp__kontextmind__project.context_export {}

// Response
{
  "exportId": string,
  "timestamp": string,
  "messageCount": number,
  "tokenCount": number,
  "summary": string
}
```

**Use Case:** Debug context issues or analyze conversation.

---

### project.session_insights
Get cross-session insights and patterns.

```typescript
// MCP call
mcp__kontextmind__project.session_insights {
  "days": 30
}

// Response
{
  "totalSessions": number,
  "totalMessages": number,
  "commonTopics": string[],
  "patterns": [
    {
      "pattern": string,
      "frequency": number
    }
  ],
  "productivity": {
    "tasksCompleted": number,
    "filesModified": number
  }
}
```

**Use Case:** Understand long-term project trends.

---

## 7. Summary Retrieval Tools

### project.get_file_summary
Get summary for a specific file.

```typescript
// MCP call
mcp__kontextmind__project.get_file_summary {
  "path": "src/services/user-service.ts"
}

// Response
{
  "path": string,
  "summary": string,
  "lastUpdated": string,
  "stale": boolean
}
```

---

### project.get_function_summary
Get summary for a function.

```typescript
// MCP call
mcp__kontextmind__project.get_function_summary {
  "symbolId": "user-service.ts::UserService.getProfile"
}

// Response
{
  "symbolId": string,
  "summary": string,
  "parameters": string[],
  "returnType": string
}
```

---

### project.get_module_summary
Get summary for a module/directory.

```typescript
// MCP call
mcp__kontextmind__project.get_module_summary {
  "path": "src/services"
}

// Response
{
  "path": string,
  "summary": string,
  "fileCount": number,
  "exports": string[]
}
```

---

### project.get_all_summaries
Get all summaries with optional filtering.

```typescript
// MCP call
mcp__kontextmind__project.get_all_summaries {
  "type": "files",  // files, functions, modules, apis, decisions, blockers, all
  "limit": 50
}

// Response
{
  "summaries": [
    {
      "id": string,
      "type": string,
      "path": string,
      "summary": string
    }
  ],
  "total": number
}
```

---

## 8. Dependency Analysis Tools

### project.find_dependencies
Find files that import or depend on a given file.

```typescript
// MCP call
mcp__kontextmind__project.find_dependencies {
  "path": "src/services/user-service.ts"
}

// Response
{
  "path": string,
  "dependencies": [
    {
      "file": string,
      "imports": string[]
    }
  ]
}
```

---

### project.find_callers
Find functions that call a given function.

```typescript
// MCP call
mcp__kontextmind__project.find_callers {
  "name": "getUserProfile"
}

// Response
{
  "name": string,
  "callers": [
    {
      "file": string,
      "line": number,
      "context": string
    }
  ]
}
```

---

### project.find_related_files
Find files related to a given file based on imports and dependencies.

```typescript
// MCP call
mcp__kontextmind__project.find_related_files {
  "path": "src/services/user-service.ts"
}

// Response
{
  "path": string,
  "relatedFiles": [
    {
      "file": string,
      "relationship": "imports" | "imported_by" | "calls" | "called_by",
      "strength": number
    }
  ]
}
```

---

## 9. Session & Continuity Tools

### project.get_session_index
Get all sessions with metadata for cross-session search.

```typescript
// MCP call
mcp__kontextmind__project.get_session_index {
  "days": 30,
  "limit": 20,
  "topic": "authentication"
}

// Response
{
  "sessions": [
    {
      "id": string,
      "title": string,
      "createdAt": string,
      "lastActivity": string,
      "topics": string[],
      "filesTouched": string[]
    }
  ],
  "total": number
}
```

---

### project.should_continue
Check if there is work to continue from previous sessions.

```typescript
// MCP call
mcp__kontextmind__project.should_continue {}

// Response
{
  "shouldContinue": boolean,
  "reasons": string[],
  "pendingTasks": [
    {
      "taskId": string,
      "title": string,
      "lastActivity": string
    }
  ]
}
```

**Use Case:** Start of new session to check for pending work.

---

### project.get_continuity_suggestions
Get suggestions for continuing from where you left off.

```typescript
// MCP call
mcp__kontextmind__project.get_continuity_suggestions {}

// Response
{
  "suggestions": [
    {
      "type": "task" | "summary" | "blocker",
      "title": string,
      "description": string,
      "priority": "high" | "medium" | "low"
    }
  ]
}
```

---

## 10. Write Operations

### project.create_handoff
Create a handoff document for context transfer.

```typescript
// MCP call
mcp__kontextmind__project.create_handoff {
  "summary": "Completed user authentication implementation",
  "next_steps": "1. Add unit tests\n2. Update documentation"
}

// Response
{
  "handoffId": string,
  "createdAt": string,
  "summary": string
}
```

**Use Case:** End of session to create context for next developer.

---

### project.write_task_summary
Write a task summary for tracking completed work.

```typescript
// MCP call
mcp__kontextmind__project.write_task_summary {
  "title": "Implement user authentication",
  "goal": "Add OAuth 2.0 authentication flow",
  "progress": "Completed OAuth flow with JWT tokens",
  "filesTouched": ["src/auth/oauth.ts", "src/auth/jwt.ts"],
  "decisions": ["Used JWT for session tokens"],
  "pending": "Add refresh token logic",
  "nextSteps": "1. Add unit tests\n2. Update API docs"
}

// Response
{
  "taskId": string,
  "title": string,
  "updatedAt": string
}
```

---

### project.write_session_summary
Write a session summary for tracking work across a session.

```typescript
// MCP call
mcp__kontextmind__project.write_session_summary {
  "goals": "Implement user authentication",
  "tasksCompleted": ["Added OAuth flow", "Added JWT validation"],
  "filesModified": ["src/auth/oauth.ts", "src/auth/jwt.ts"],
  "decisions": ["Used JWT for session tokens"],
  "pending": "Add refresh token logic",
  "handoff": "Continue with refresh token implementation"
}

// Response
{
  "sessionId": string,
  "summary": string,
  "completedAt": string
}
```

---

## 11. CLI Equivalents

Some MCP tools have CLI equivalents:

```bash
# Learning
kontextmind learn sync                    # Equivalent to learn_sync
kontextmind learn stats                    # Shows learn_stats
kontextmind learn patterns code_write      # Shows learn_patterns
kontextmind learn export                   # Exports learning data

# Analytics
kontextmind analytics --period daily      # Shows ask_stats

# Quality
kontextmind quality report --period weekly # Shows quality_report
kontextmind quality trends --days 7        # Shows quality_trends

# Agent Awareness
kontextmind agent                         # Shows agent_state and capabilities

# Session Management
kontextmind session list                  # Shows get_session_index
kontextmind session stats <id>            # Shows get_session_stats

# Task Management
kontextmind task list                     # Shows get_current_task
kontextmind task complete <id>            # Calls task_complete

# Context
kontextmind insights --days 30            # Shows session_insights

# Handoff
kontextmind handoff                       # Creates handoff document
```

---

## MCP Tool Naming Convention

When calling tools in code:

```
mcp__kontextmind__project.{tool_name}
```

Examples:
```
mcp__kontextmind__project.learn_sync
mcp__kontextmind__project.agent_state
mcp__kontextmind__project.task_detect
mcp__kontextmind__project.ask_stats
mcp__kontextmind__project.quality_trends
```

---

## Quick Reference Table

| Tool | Category | Description |
|------|----------|-------------|
| `project.learn_sync` | Learning | Trigger learning sync |
| `project.learn_stats` | Learning | Get learning statistics |
| `project.learn_patterns` | Learning | Get success/failure patterns |
| `project.learn_suggestions` | Learning | Get improvement suggestions |
| `project.learn_export` | Learning | Export training data |
| `project.learn_import` | Learning | Import from another project |
| `project.agent_state` | Awareness | Current agent state |
| `project.agent_capabilities` | Awareness | Capability profile |
| `project.agent_antipatterns` | Awareness | Patterns to avoid |
| `project.agent_assess` | Awareness | Self-assessment |
| `project.task_detect` | Detection | Detect task boundaries |
| `project.task_complete` | Detection | Mark task complete |
| `project.task_update_pending` | Detection | Update pending work |
| `project.ask_stats` | Analytics | Q&A statistics |
| `project.ask_top_questions` | Analytics | Most asked questions |
| `project.ask_quality` | Analytics | Answer quality |
| `project.quality_trends` | Quality | Quality trends |
| `project.quality_report` | Quality | Quality report |
| `project.quality_performance` | Quality | Performance stats |
| `project.context_stats` | Context | Context engine stats |
| `project.context_export` | Context | Export context |
| `project.session_insights` | Insights | Cross-session insights |

---

## Total Tool Count

| Category | Count |
|----------|-------|
| Learning | 6 |
| Agent Awareness | 4 |
| Task Detection | 3 |
| Analytics | 3 |
| Quality | 3 |
| Context & Insights | 3 |
| Summary Retrieval | 8 |
| Dependency Analysis | 5 |
| Session Management | 4 |
| Continuity | 4 |
| Task Management | 8 |
| Write Operations | 3 |
| Status & Search | 6 |
| Q&A | 2 |
| Refresh & Scan | 3 |
| **Total** | **70+** |

---

*Document generated: 2026-05-16*
*Total MCP tools: 70+*