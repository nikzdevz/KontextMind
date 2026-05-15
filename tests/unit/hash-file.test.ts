import { describe, it, expect, beforeEach } from 'vitest';
import { computeFileHash, getFileStats, isLargeFile, DEFAULT_HASH_ALGORITHM, MAX_FILE_SIZE_DEFAULT, verifyHash } from '../../packages/core/src/scanner/hash-file.js';
import { writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('File Hashing', () => {
  let testFile: string;
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-hash-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, 'test.txt');
  });

  it('should compute SHA-256 hash for a file', () => {
    writeFileSync(testFile, 'hello world');
    const result = computeFileHash(testFile);

    expect(result.hash).toBeDefined();
    expect(result.hash.length).toBe(64); // SHA-256 produces 64 hex chars
    expect(result.algorithm).toBe('sha256');
    expect(result.size_bytes).toBe(11); // "hello world" is 11 bytes
  });

  it('should produce consistent hashes', () => {
    writeFileSync(testFile, 'consistent content');
    const hash1 = computeFileHash(testFile).hash;
    const hash2 = computeFileHash(testFile).hash;

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    writeFileSync(testFile, 'content A');
    const hashA = computeFileHash(testFile).hash;

    writeFileSync(testFile, 'content B');
    const hashB = computeFileHash(testFile).hash;

    expect(hashA).not.toBe(hashB);
  });

  it('should get file stats correctly', () => {
    const content = 'test content';
    writeFileSync(testFile, content);

    const stats = getFileStats(testFile);

    expect(stats.size_bytes).toBe(content.length);
    expect(stats.modified_at).toBeDefined();
    expect(new Date(stats.modified_at).getTime()).toBeGreaterThan(0);
  });

  it('should verify hash matches', () => {
    writeFileSync(testFile, 'verify me');
    const { hash } = computeFileHash(testFile);

    expect(verifyHash(testFile, hash)).toBe(true);
    expect(verifyHash(testFile, 'invalid-hash')).toBe(false);
  });

  it('should detect large files', () => {
    expect(isLargeFile(3 * 1024 * 1024, MAX_FILE_SIZE_DEFAULT)).toBe(true); // 3MB
    expect(isLargeFile(1 * 1024 * 1024, MAX_FILE_SIZE_DEFAULT)).toBe(false); // 1MB
    expect(isLargeFile(500, MAX_FILE_SIZE_DEFAULT)).toBe(false); // 500 bytes
  });

  it('should support custom max file size', () => {
    const customMax = 1024; // 1KB
    expect(isLargeFile(2048, customMax)).toBe(true);
    expect(isLargeFile(512, customMax)).toBe(false);
  });

  afterEach(() => {
    try {
      if (existsSync(testFile)) unlinkSync(testFile);
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});
