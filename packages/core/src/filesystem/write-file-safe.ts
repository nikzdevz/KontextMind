import { writeFile } from 'fs/promises';
import { ensureParentDir } from './ensure-dir.js';

export async function writeFileSafe(filePath: string, content: string): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, content, 'utf-8');
}

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await ensureParentDir(filePath);
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, content, 'utf-8');
  await writeFile(filePath, content, 'utf-8');
}