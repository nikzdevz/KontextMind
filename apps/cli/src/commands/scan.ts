import { OptionValues } from 'commander';
import { scanProject, getFileIndexStatus, getLastScanTime } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';
import { printSection, printSuccess, printInfo, printWarning } from '../utils/print.js';
import { handleError } from '../utils/errors.js';

export async function scanCommand(options: OptionValues): Promise<void> {
  printSection('KontextMind Scan');

  const projectRoot = process.cwd();
  const detected = detectProject(projectRoot);

  const scanOptions: {
    changedOnly: boolean;
    projectRoot: string;
    projectName: string;
    maxFileSizeBytes?: number;
  } = {
    changedOnly: Boolean(options['changedOnly']),
    projectRoot,
    projectName: detected.name,
  };

  if (options.maxSize) {
    const sizeStr = String(options.maxSize);
    const sizeMatch = sizeStr.match(/^(\d+)(m|k|b)?$/i);
    if (sizeMatch) {
      const value = parseInt(sizeMatch[1], 10);
      const unit = (sizeMatch[2] || 'b').toLowerCase();
      switch (unit) {
        case 'm': scanOptions.maxFileSizeBytes = value * 1024 * 1024; break;
        case 'k': scanOptions.maxFileSizeBytes = value * 1024; break;
        default: scanOptions.maxFileSizeBytes = value;
      }
    }
  }

  try {
    printInfo('Scanning project...');

    const result = await scanProject(scanOptions);

    printSection('Scan Complete');

    printSuccess(`Files indexed: ${result.indexed}`);
    printInfo(`Files ignored: ${result.ignored}`);
    printInfo(`Large files skipped: ${result.largeSkipped}`);
    printInfo(`Secret-sensitive files skipped: ${result.secretSkipped}`);
    printInfo(`Duration: ${result.duration_ms}ms`);

    const indexStatus = getFileIndexStatus(projectRoot);
    printSuccess(`\nFile index: ${indexStatus.fileCount} files`);

    const lastScan = getLastScanTime(projectRoot);
    if (lastScan) {
      printInfo(`Last scan: ${new Date(lastScan).toLocaleString()}`);
    }

  } catch (error) {
    handleError(error);
  }
}