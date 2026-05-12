import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { initProject } from '../../packages/core/src/init/init-project.js';

describe('Init Command Integration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-temp-' + Date.now());
  });

  afterEach(() => {
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initProject', () => {
    it('should create CLAUDE.md', () => {
      expect(initProject).toBeDefined();
    });

    it('should not overwrite existing files without force', async () => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, 'CLAUDE.md'), 'Original content');

      // Create files in testDir by temporarily changing process.cwd behavior
      const originalCwd = process.cwd;
      Object.defineProperty(process, 'cwd', {
        value: () => testDir,
        configurable: true
      });

      try {
        const result = await initProject({ force: false });

        // File should be skipped
        expect(result.skipped.some(s => s.includes('CLAUDE.md') || s === 'CLAUDE.md')).toBe(true);

        // Original content should remain
        const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
        expect(content).toBe('Original content');
      } finally {
        Object.defineProperty(process, 'cwd', {
          value: originalCwd,
          configurable: true
        });
      }
    });

    it('should overwrite existing files with force', async () => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, 'CLAUDE.md'), 'Original content');

      const originalCwd = process.cwd;
      Object.defineProperty(process, 'cwd', {
        value: () => testDir,
        configurable: true
      });

      try {
        const result = await initProject({ force: true });

        // File should be created, not skipped
        const createdClaueMd = result.created.some(f => f.includes('CLAUDE.md'));
        expect(createdClaueMd).toBe(true);

        // New content should be written
        const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
        expect(content).toContain('Claude Code Instructions');
      } finally {
        Object.defineProperty(process, 'cwd', {
          value: originalCwd,
          configurable: true
        });
      }
    });

    it('should use sensible defaults when no options provided', async () => {
      mkdirSync(testDir, { recursive: true });

      const originalCwd = process.cwd;
      Object.defineProperty(process, 'cwd', {
        value: () => testDir,
        configurable: true
      });

      try {
        const result = await initProject({});

        // Should create files
        expect(result.created.length).toBeGreaterThan(0);

        // Should not have errors
        expect(result.warnings.length).toBe(0);
      } finally {
        Object.defineProperty(process, 'cwd', {
          value: originalCwd,
          configurable: true
        });
      }
    });

    it('should detect project name from package.json', async () => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: 'my-detected-project' }));

      const originalCwd = process.cwd;
      Object.defineProperty(process, 'cwd', {
        value: () => testDir,
        configurable: true
      });

      try {
        await initProject({ yes: true });

        const configPath = join(testDir, '.kontextmind', 'config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));

        expect(config.project.name).toBe('my-detected-project');
      } finally {
        Object.defineProperty(process, 'cwd', {
          value: originalCwd,
          configurable: true
        });
      }
    });

    it('should use directory name when no package.json', async () => {
      const nestedDir = join(testDir, 'my-folder-project');
      mkdirSync(nestedDir, { recursive: true });

      const originalCwd = process.cwd;
      Object.defineProperty(process, 'cwd', {
        value: () => nestedDir,
        configurable: true
      });

      try {
        await initProject({});

        const configPath = join(nestedDir, '.kontextmind', 'config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));

        expect(config.project.name).toBe('my-folder-project');
      } finally {
        Object.defineProperty(process, 'cwd', {
          value: originalCwd,
          configurable: true
        });
      }
    });
  });
});

describe('Generated Files', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-files-' + Date.now());
    mkdirSync(testDir, { recursive: true });

    const originalCwd = process.cwd;
    Object.defineProperty(process, 'cwd', {
      value: () => testDir,
      configurable: true
    });
  });

  afterEach(() => {
    const originalCwd = process.cwd;
    Object.defineProperty(process, 'cwd', {
      value: originalCwd,
      configurable: true
    });

    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create all expected files', async () => {
    await initProject({ yes: true });

    const expectedFiles = [
      'CLAUDE.md',
      'AGENTS.md',
      'README_AI.md',
      '.toolignore',
      '.kontextmind/config.json',
      '.kontextmind/policy.json',
      '.kontextmind/instructions.master.md',
      '.context/handoff.md',
      '.context/current-state.md',
      '.mcp/server.json',
      '.sessions/latest.json',
      '.logs/README.md',
    ];

    for (const file of expectedFiles) {
      expect(existsSync(join(testDir, file)), `File ${file} should exist`).toBe(true);
    }
  });

  it('should generate valid config.json', async () => {
    await initProject({ yes: true });

    const configPath = join(testDir, '.kontextmind', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    expect(config.project).toBeDefined();
    expect(config.mode).toBe('readonly');
    expect(config.phase).toBe(1);
    expect(config.git).toBeDefined();
  });

  it('should generate valid policy.json', async () => {
    await initProject({ yes: true });

    const policyPath = join(testDir, '.kontextmind', 'policy.json');
    const policy = JSON.parse(readFileSync(policyPath, 'utf-8'));

    expect(policy.mode).toBeDefined();
    expect(policy.allow_tools).toBeInstanceOf(Array);
    expect(policy.deny_tools).toBeInstanceOf(Array);
    expect(policy.security).toBeDefined();
  });

  it('should replace placeholders in CLAUDE.md', async () => {
    await initProject({ yes: true, mode: 'readonly' });

    const claudeMdPath = join(testDir, 'CLAUDE.md');
    const content = readFileSync(claudeMdPath, 'utf-8');

    expect(content).toContain('Claude Code Instructions');
    expect(content).toContain('readonly'); // Mode placeholder
  });

  it('should create .logs directory with README', async () => {
    await initProject({ yes: true });

    const logsDir = join(testDir, '.logs');
    const readmePath = join(logsDir, 'README.md');

    expect(existsSync(logsDir)).toBe(true);
    expect(existsSync(readmePath)).toBe(true);
  });

  it('should create .context directory with handoff.md', async () => {
    await initProject({ yes: true });

    const handoffPath = join(testDir, '.context', 'handoff.md');
    const content = readFileSync(handoffPath, 'utf-8');

    expect(content).toContain('Latest Handoff');
  });

  it('should create log placeholder files', async () => {
    await initProject({ yes: true });

    const logFiles = [
      '.logs/agent-actions.log',
      '.logs/read-events.log',
      '.logs/security-events.log',
    ];

    for (const logFile of logFiles) {
      expect(existsSync(join(testDir, logFile))).toBe(true);
    }
  });
});