# Release Checklist

## Pre-Release

- [ ] All phases implemented and tested
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (all unit tests)
- [ ] `pnpm typecheck` passes
- [ ] No TypeScript errors
- [ ] No lint errors

## Documentation

- [ ] README.md updated
- [ ] docs/architecture.md complete
- [ ] docs/cli.md complete
- [ ] docs/security.md complete
- [ ] docs/obsidian.md complete
- [ ] docs/roadmap.md updated
- [ ] docs/limitations.md complete

## Security

- [ ] No secrets in repository
- [ ] `pnpm secrets scan` passes (or only low severity)
- [ ] Audit logs implemented
- [ ] Secret redaction working
- [ ] .toolignore properly configured

## Package Metadata

- [ ] package.json version correct
- [ ] License present (MIT)
- [ ] Description accurate
- [ ] Repository URL correct
- [ ] Author information correct

## Examples

- [ ] Example project created
- [ ] Example README complete
- [ ] Example commands work

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass (if any)
- [ ] Manual E2E test completed

## CLI UX

- [ ] All commands have help text
- [ ] Error messages are helpful
- [ ] JSON output consistent
- [ ] Init guidance clear

## Final Steps

1. Update version in package.json
2. Create git tag
3. Run publish dry-run
4. Publish to npm (if public)

## Publish Commands

```bash
# Dry run (test without publishing)
npm publish --dry-run

# Publish
npm publish

# With specific tag
npm publish --tag beta
```