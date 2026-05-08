import { existsSync } from 'fs';

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

export async function fileExistsAsync(filePath: string): Promise<boolean> {
  return existsSync(filePath);
}