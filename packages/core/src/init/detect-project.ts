import { readFileSync, existsSync } from 'fs';
import path from 'path';

export interface DetectedProject {
  name: string;
  root: string;
  hasPackageJson: boolean;
  hasGit: boolean;
}

export function detectProject(projectRoot: string = process.cwd()): DetectedProject {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const hasPackageJson = existsSync(packageJsonPath);

  let name = path.basename(projectRoot);

  if (hasPackageJson) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.name) {
        const scopedMatch = packageJson.name.match(/^@[^/]+\/(.+)$/);
        name = scopedMatch ? scopedMatch[1] : packageJson.name;
      }
    } catch {
      // Use folder name as fallback
    }
  }

  return {
    name,
    root: projectRoot,
    hasPackageJson,
    hasGit: existsSync(path.join(projectRoot, '.git')),
  };
}

export function detectGitAvailable(projectRoot: string = process.cwd()): boolean {
  return existsSync(path.join(projectRoot, '.git'));
}