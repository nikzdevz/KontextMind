import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { walkDirectory } from '../../packages/core/src/scanner/walk-files.js';
import { writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('Walk Files', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-walk-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  it('should discover files in directory', () => {
    writeFileSync(join(testDir, 'test.ts'), 'const x = 1;');
    writeFileSync(join(testDir, 'README.md'), '# Test');

    const result = walkDirectory(testDir);

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files).toContain('test.ts');
    expect(result.files).toContain('README.md');
  });

  it('should skip .git directory', () => {
    mkdirSync(join(testDir, '.git'), { recursive: true });
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, '.git', 'config'), '[core]');
    writeFileSync(join(testDir, 'src', 'app.js'), 'console.log("hello");');

    const result = walkDirectory(testDir);

    expect(result.files.some(f => f.includes('.git'))).toBe(false);
    expect(result.files.some(f => f.includes('src/app.js'))).toBe(true);
  });

  it('should skip secret-sensitive files', () => {
    mkdirSync(join(testDir, 'secrets'), { recursive: true });
    writeFileSync(join(testDir, 'secrets', 'config.json'), '{"key":"value"}');
    writeFileSync(join(testDir, 'server.pem'), '-----BEGIN CERTIFICATE-----');
    writeFileSync(join(testDir, 'app.js'), 'console.log("hello");');

    const result = walkDirectory(testDir);

    expect(result.secretSkipped.length).toBeGreaterThan(0);
    expect(result.secretSkipped).toContain('server.pem');
    expect(result.files).toContain('app.js');
  });

  it('should skip large files', () => {
    const largeContent = 'x'.repeat(3 * 1024 * 1024); // 3MB
    writeFileSync(join(testDir, 'large.js'), largeContent);
    writeFileSync(join(testDir, 'small.js'), 'console.log("hi");');

    const result = walkDirectory(testDir, { maxFileSizeBytes: 2 * 1024 * 1024 });

    expect(result.largeSkipped).toContain('large.js');
    expect(result.files).toContain('small.js');
  });

  it('should respect toolignore patterns', () => {
    mkdirSync(join(testDir, 'temp'), { recursive: true });
    writeFileSync(join(testDir, 'include.ts'), 'export const x = 1;');
    writeFileSync(join(testDir, 'exclude.log'), 'log entry');
    writeFileSync(join(testDir, 'temp', 'file.tmp'), 'temp data');

    const toolignoreContent = '*.log\ntemp/';
    const result = walkDirectory(testDir, { toolignoreContent });

    expect(result.files).toContain('include.ts');
    expect(result.ignored.some(i => i.path === 'exclude.log')).toBe(true);
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
