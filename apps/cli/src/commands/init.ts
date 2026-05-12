import path from 'path';
import { existsSync, rm } from 'fs';
import { OptionValues } from 'commander';
import { initProject } from '@kontextmind/core';
import { printInfo, printSuccess, printWarning, printSection } from '../utils/print.js';
import { handleError } from '../utils/errors.js';

// Recursive directory deletion helper
async function deleteDirectory(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    rm(dirPath, { recursive: true, force: true }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function initCommand(options: OptionValues): Promise<void> {
  printSection('KontextMind Init');

  const reset = Boolean(options.reset);

  if (reset) {
    printInfo('Reset mode: Deleting existing KontextMind data...');
    // Delete all KontextMind directories
    const kmDirs = [
      '.kontextmind',
      '.context',
      '.kg',
      '.summaries',
      '.sessions',
      '.logs',
      '.obsidian-export',
    ];

    for (const dir of kmDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (existsSync(dirPath)) {
        try {
          // Use rimraf-like recursive delete
          await deleteDirectory(dirPath);
          printSuccess(`  Deleted: ${dir}`);
        } catch (error) {
          printWarning(`  Failed to delete ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    printSuccess('Reset complete. Proceeding with initialization...\n');
  }

  const cliOptions = {
    yes: Boolean(options.yes),
    force: reset ? true : Boolean(options.force), // Force on reset to overwrite
    agents: options.agents ? String(options.agents).split(',').map(a => a.trim()) : undefined,
    mode: options.mode as 'readonly' | 'suggest' | 'edit-with-approval' | 'full-agent' | undefined,
    git: options.git as 'auto' | 'enabled' | 'disabled' | undefined,
    provider: options.provider as 'none' | 'openai' | 'anthropic' | 'ollama' | 'bedrock' | 'openai-compatible' | undefined,
  };

  try {
    const result = await initProject(cliOptions);

    printSection('Summary');

    if (result.created.length > 0) {
      printSuccess(`Created ${result.created.length} file(s):`);
      for (const file of result.created) {
        printInfo(`  • ${file}`);
      }
    }

    if (result.skipped.length > 0) {
      printWarning(`Skipped ${result.skipped.length} existing file(s):`);
      for (const file of result.skipped) {
        printInfo(`  • ${file}`);
      }
    }

    if (result.warnings.length > 0) {
      printWarning('Warnings:');
      for (const warning of result.warnings) {
        printInfo(`  • ${warning}`);
      }
    }

    printSuccess('\nKontextMind initialized successfully!');
    printInfo('\nNext steps:');
    printInfo('  • kontextmind status    - Check initialization status');
    printInfo('  • kontextmind doctor    - Verify configuration health');
    printInfo('  • Read CLAUDE.md        - Get started with AI agent instructions');

  } catch (error) {
    handleError(error);
  }
}