export class KontextMindError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KontextMindError';
  }
}

export class InitError extends KontextMindError {
  constructor(message: string) {
    super(message);
    this.name = 'InitError';
  }
}

export class ConfigError extends KontextMindError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof KontextMindError) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`);
  } else {
    console.error('\x1b[31mError:\x1b[0m An unknown error occurred');
  }
  process.exit(1);
}