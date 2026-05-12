import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ProviderConfigEntry {
  provider: string;
  baseUrl: string;
  model?: string;
  apiKey?: string;
}

export interface GlobalConfig {
  providers: Record<string, ProviderConfigEntry>;
  defaultProvider?: string;
}

function getGlobalConfigDir(): string {
  const base = process.env.APPDATA || process.env.HOME || '';
  return join(base, '.kontextmind');
}

export function getGlobalConfig(): GlobalConfig {
  const configPath = join(getGlobalConfigDir(), 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return { providers: {} };
    }
  }
  return { providers: {} };
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const dir = getGlobalConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const configPath = join(dir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}