import { describe, it, expect, beforeEach } from 'vitest';
import { createFileIndex, saveFileIndex, loadFileIndex, validateFileIndex } from '../../packages/core/src/scanner/file-index.js';
import { writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('File Index', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-index-' + Date.now());
    mkdirSync(join(testDir, '.kg'), { recursive: true });
  });

  it('should create an empty file index', () => {
    const index = createFileIndex({
      projectName: 'test-project',
      projectRoot: testDir,
    });

    expect(index.project).toBe('test-project');
    expect(index.files).toEqual([]);
    expect(index.version).toBe('1');
    expect(index.total_files_seen).toBe(0);
  });

  it('should save and load a file index', () => {
    const index = createFileIndex({
      projectName: 'test-project',
      projectRoot: testDir,
    });
    index.indexed_files = 5;
    index.files.push({
      path: 'test.ts',
      language: 'TypeScript',
      size_bytes: 100,
      hash: 'abc123',
      modified_at: new Date().toISOString(),
      indexed_at: new Date().toISOString(),
      summary_status: 'missing',
      ignored: false,
      ignore_reason: null,
    });

    saveFileIndex(index, testDir);
    const loaded = loadFileIndex(testDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.files.length).toBe(1);
    expect(loaded!.files[0].path).toBe('test.ts');
  });

  it('should validate a correct file index', () => {
    const index = createFileIndex({
      projectName: 'test',
      projectRoot: testDir,
    });

    expect(validateFileIndex(index)).toBe(true);
  });

  it('should reject invalid file index', () => {
    expect(validateFileIndex(null)).toBe(false);
    expect(validateFileIndex({})).toBe(false);
    expect(validateFileIndex({ version: '1' })).toBe(false);
  });

  afterEach(() => {
    try {
      const indexPath = join(testDir, '.kg', 'file-index.json');
      if (existsSync(indexPath)) {
        unlinkSync(indexPath);
      }
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});
