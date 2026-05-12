# KontextMind Limitations

## Current Limitations

### MVP Parser

The current parser implementation has basic functionality:

- **TypeScript/JavaScript**: Full support
- **Python**: Basic support
- **Other languages**: Limited or no support

The parser extracts:
- Function definitions
- Class definitions
- Import statements
- Basic type information

It does not:
- Extract detailed type annotations
- Parse complex generics
- Handle all syntax edge cases

### Knowledge Graph

The knowledge graph is stored as JSON files:
- `.kg/file-index.json`
- `.kg/symbol-index.json`

This is suitable for small to medium projects. For large projects:
- Consider using a database backend (future enhancement)
- File size may become a concern

### MCP Support

MCP support depends on client compatibility:
- Claude Code MCP: Full support
- Other MCP clients: May work with stdio transport
- HTTP transport: Basic support

### Chatbot Mode

In chatbot-readonly mode:
- Answers come from summaries, not raw code
- Summary quality depends on LLM provider
- Mock mode uses simplified responses

### LLM Configuration

Without an API key:
- Mock provider used by default
- Limited functionality
- Summaries not generated

### No Web UI

Currently, KontextMind is CLI-only:
- No browser interface
- No mobile app
- All interaction via command line

### Security Considerations

- Secrets detection is pattern-based, not comprehensive
- Redaction may miss edge cases
- Audit logs grow indefinitely (no rotation)

## Workarounds

### Parser Limitations
- Focus on TypeScript/JavaScript/Python projects
- Use inline comments for documentation
- Manually update symbol information

### Knowledge Graph Size
- Regular cleanup with `kontextmind scan --changed-only`
- Export to Obsidian for analysis
- Consider `.toolignore` for large directories

### MCP Compatibility
- Use stdio transport for Claude Code
- Test with specific MCP clients
- Report issues for fixes

### Chatbot Quality
- Generate good summaries with `--mock` or real provider
- Keep summaries updated
- Use `--no-code` filter for non-technical users

## Future Improvements

See [roadmap.md](roadmap.md) for planned enhancements.