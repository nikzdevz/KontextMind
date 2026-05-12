import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { GitInfo } from './scan-types.js';

export function detectGitInfo(projectRoot: string): GitInfo {
  const gitDir = join(projectRoot, '.git');
  const result: GitInfo = {
    available: false,
    branch: null,
    commit: null,
  };

  // Check if .git directory exists
  if (!existsSync(gitDir)) {
    return result;
  }

  result.available = true;

  // Try to get branch name
  try {
    const headPath = join(gitDir, 'HEAD');
    if (existsSync(headPath)) {
      const headContent = readFileSync(headPath, 'utf-8').trim();

      if (headContent.startsWith('ref: refs/heads/')) {
        result.branch = headContent.replace('ref: refs/heads/', '');
      } else {
        // Detached HEAD state
        result.branch = null;
      }
    }
  } catch {
    // Ignore errors reading HEAD
  }

  // Try to get latest commit hash
  try {
    // Try using execSync for git rev-parse
    const commit = execSync('git rev-parse HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (commit && commit.length === 40) {
      result.commit = commit.substring(0, 8);
    }
  } catch {
    // Git might not be available or we're not in a git repo
    // Fall back to reading .git/refs/heads/<branch>
    try {
      if (result.branch) {
        const branchFile = join(gitDir, 'refs', 'heads', result.branch);
        if (existsSync(branchFile)) {
          const commit = readFileSync(branchFile, 'utf-8').trim();
          if (commit && commit.length === 40) {
            result.commit = commit.substring(0, 8);
          }
        }
      }

      // Try HEAD file as fallback
      const headFile = join(gitDir, 'refs', 'heads', 'main');
      if (!result.commit && existsSync(headFile)) {
        const commit = readFileSync(headFile, 'utf-8').trim();
        if (commit && commit.length === 40) {
          result.commit = commit.substring(0, 8);
        }
      }
    } catch {
      // Ignore all git read errors
    }
  }

  return result;
}

export function isGitAvailable(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.git'));
}

export function getGitBranch(projectRoot: string): string | null {
  const { branch } = detectGitInfo(projectRoot);
  return branch;
}

export function getGitCommit(projectRoot: string): string | null {
  const { commit } = detectGitInfo(projectRoot);
  return commit;
}