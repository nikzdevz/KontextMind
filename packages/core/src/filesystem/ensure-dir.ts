import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
  if (existsSync(dirPath)) {
    return;
  }
  await mkdir(dirPath, { recursive: true });
}

export async function ensureParentDir(filePath: string): Promise<void> {
  const parentDir = path.dirname(filePath);
  await ensureDir(parentDir);
}

export function dirExists(dirPath: string): boolean {
  return existsSync(dirPath) && existsSync(dirPath);
}