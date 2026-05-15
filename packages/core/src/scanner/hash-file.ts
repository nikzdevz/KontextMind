import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';

export interface FileHash {
  hash: string;
  size_bytes: number;
  algorithm: string;
}

export function computeFileHash(filePath: string, algorithm: string = 'sha256'): FileHash {
  const content = readFileSync(filePath);
  const hash = createHash(algorithm).update(content).digest('hex');

  return {
    hash,
    size_bytes: content.length,
    algorithm,
  };
}

export async function computeFileHashAsync(filePath: string, algorithm: string = 'sha256'): Promise<FileHash> {
  const content = await import('fs').then(fs => fs.promises.readFile(filePath));
  const hash = createHash(algorithm).update(content).digest('hex');

  return {
    hash,
    size_bytes: content.length,
    algorithm,
  };
}

export function getFileStats(filePath: string): { size_bytes: number; modified_at: string } {
  const stats = statSync(filePath);
  return {
    size_bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
  };
}

export function verifyHash(filePath: string, expectedHash: string, algorithm: string = 'sha256'): boolean {
  const { hash } = computeFileHash(filePath, algorithm);
  return hash === expectedHash;
}

export const DEFAULT_HASH_ALGORITHM = 'sha256';
export const MAX_FILE_SIZE_DEFAULT = 2 * 1024 * 1024; // 2MB

export function isLargeFile(sizeBytes: number, maxSizeBytes: number = MAX_FILE_SIZE_DEFAULT): boolean {
  return sizeBytes > maxSizeBytes;
}