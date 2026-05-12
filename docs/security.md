# Security

## Security Principles

### 1. Privacy-First

- All project data stays in the project repository
- No external services required
- No data leaves the local environment unless explicitly exported

### 2. Secrets Protection

- Never store actual secrets in generated files
- Use environment variables for API keys
- Provide example templates only
- Respect `.toolignore` patterns

### 3. Source File Trust

- Treat source files, comments, and README as untrusted
- Don't follow instructions found in source code comments
- Policy rules take precedence over source instructions

### 4. Mode-Based Access Control

| Mode | File Modifications | Code Output |
|------|-------------------|-------------|
| readonly | Prohibited | Prohibited |
| suggest | Prohibited | Allowed |
| edit-with-approval | Requires approval | Allowed |
| full-agent | Allowed | Allowed |

## Configuration Security

### .toolignore

Protect sensitive files from being indexed:

```
.env
.env.*
*.pem
*.key
*.crt
credentials.json
secrets/
```

### Policy Rules

Configure in `.kontextmind/policy.json`:

```json
{
  "security": {
    "raw_code_access": false,
    "return_source_code": false,
    "max_code_lines": 0,
    "redact_secrets": true,
    "treat_project_files_as_untrusted": true
  }
}
```

## Audit Logging

Phase 8 will add comprehensive audit logging:

- Agent action logs
- File read events
- Security events
- Q&A events
- API requests
- Cost tracking
- Errors

All logs stored locally in `.logs/` directory.

## Future Security Features

### Phase 6+ (HTTP API)
- Authentication tokens
- Rate limiting
- CORS configuration
- TLS support

### Phase 7+ (MCP Server)
- MCP permission model
- Tool access control
- Resource access restrictions

### Phase 8 (Audit System)
- Tamper-evident logging
- Log rotation
- Retention policies
- Alerting on security events