import { existsSync, rm } from 'fs';
import path from 'path';
import { printSection, printInfo, printSuccess, printWarning } from '../utils/print.js';

// Directories created by KontextMind
const KONTEXTMIND_DIRS = [
  '.kontextmind',
  '.context',
  '.kg',
  '.summaries',
  '.sessions',
  '.logs',
  '.obsidian-export',
];

// Files created by KontextMind
const KONTEXTMIND_FILES = [
  '.toolignore',
  'CLAUDE.md',
  'AGENTS.md',
  'README_AI.md',
  'FIRSTPROMPT.md',
];

async function deleteDirectory(dirPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    rm(dirPath, { recursive: true, force: true }, (err) => {
      resolve(!err);
    });
  });
}

async function deleteFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    rm(filePath, { force: true }, (err) => {
      resolve(!err);
    });
  });
}

export async function deinitCommand(): Promise<void> {
  printSection('KontextMind Deinit');

  const projectRoot = process.cwd();
  let deletedCount = 0;
  let skippedCount = 0;

  // Delete directories
  printInfo('Removing KontextMind directories...');
  for (const dir of KONTEXTMIND_DIRS) {
    const dirPath = path.join(projectRoot, dir);
    if (existsSync(dirPath)) {
      const success = await deleteDirectory(dirPath);
      if (success) {
        printSuccess(`  Deleted: ${dir}/`);
        deletedCount++;
      } else {
        printWarning(`  Failed to delete: ${dir}/`);
        skippedCount++;
      }
    } else {
      printInfo(`  (skipped - not found): ${dir}/`);
      skippedCount++;
    }
  }

  // Delete files
  printInfo('\nRemoving KontextMind files...');
  for (const file of KONTEXTMIND_FILES) {
    const filePath = path.join(projectRoot, file);
    if (existsSync(filePath)) {
      const success = await deleteFile(filePath);
      if (success) {
        printSuccess(`  Deleted: ${file}`);
        deletedCount++;
      } else {
        printWarning(`  Failed to delete: ${file}`);
        skippedCount++;
      }
    } else {
      printInfo(`  (skipped - not found): ${file}`);
      skippedCount++;
    }
  }

  printSection('Summary');
  printSuccess(`\nKontextMind removed successfully!`);
  printInfo(`  Deleted: ${deletedCount} item(s)`);
  printInfo(`  Skipped: ${skippedCount} item(s)`);

  printInfo('\nNote: You may want to manually remove KontextMind patterns from .gitignore');
}
