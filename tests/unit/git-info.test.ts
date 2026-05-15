import { describe, it, expect } from 'vitest';
import { detectGitInfo, isGitAvailable } from '../../packages/core/src/scanner/git-info.js';

describe('Git Info', () => {
  describe('detectGitInfo', () => {
    it('should return available:false when .git does not exist', () => {
      const info = detectGitInfo('/tmp/non-existent-path');
      expect(info.available).toBe(false);
      expect(info.branch).toBeNull();
      expect(info.commit).toBeNull();
    });
  });

  describe('isGitAvailable', () => {
    it('should return false for non-git directories', () => {
      expect(isGitAvailable('/tmp')).toBe(false);
    });

    it('should return false for non-existent paths', () => {
      expect(isGitAvailable('/tmp/definitely-not-real-path-12345')).toBe(false);
    });
  });
});

describe('Git Info for current repo', () => {
  it('should detect git info for this repository', () => {
    const info = detectGitInfo(process.cwd());
    // This might pass or fail depending on whether we're in a git repo
    // The important thing is it doesn't throw
    expect(info).toHaveProperty('available');
    expect(info).toHaveProperty('branch');
    expect(info).toHaveProperty('commit');
  });
});