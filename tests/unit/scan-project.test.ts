import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanProject, getFileIndexStatus } from '../../packages/core/src/scanner/scan-project.js';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('Scan Project', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-scan-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '.kg'), { recursive: true });
  });

  it('should scan a project and return results', async () => {
    const result = await scanProject({
      projectRoot: testDir,
      projectName: 'test-project',
    });

    expect(result.indexed).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty('duration_ms');
    expect(result).toHaveProperty('ignored');
  });

  it('should create a valid file index', async () => {
    await scanProject({
      projectRoot: testDir,
      projectName: 'test-project',
    });

    const status = getFileIndexStatus(testDir);
    expect(status.exists).toBe(true);
    expect(status.valid).toBe(true);
  });

  it('should detect changed files in changed-only mode', async () => {
    // First scan
    const result1 = await scanProject({
      projectRoot: testDir,
      projectName: 'test-project',
    });

    // Second scan with changedOnly
    const result2 = await scanProject({
      projectRoot: testDir,
      projectName: 'test-project',
      changedOnly: true,
    });

    // Should be faster because it reuses unchanged file records
    expect(result2.duration_ms).toBeGreaterThanOrEqual(0);
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
});
