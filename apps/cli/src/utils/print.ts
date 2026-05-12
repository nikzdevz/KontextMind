export function printInfo(message: string): void {
  console.log(message);
}

export function printSuccess(message: string): void {
  console.log(`\x1b[32m✓\x1b[0m ${message}`);
}

export function printWarning(message: string): void {
  console.log(`\x1b[33m⚠\x1b[0m ${message}`);
}

export function printError(message: string): void {
  console.error(`\x1b[31m✗\x1b[0m ${message}`);
}

export function printSection(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

export function printKeyValue(key: string, value: string, indent = ''): void {
  console.log(`${indent}\x1b[36m${key}:\x1b[0m ${value}`);
}

export function printPass(message: string): void {
  console.log(`\x1b[32mPASS\x1b[0m ${message}`);
}

export function printFail(message: string): void {
  console.log(`\x1b[31mFAIL\x1b[0m ${message}`);
}

export function printWarn(message: string): void {
  console.log(`\x1b[33mWARN\x1b[0m ${message}`);
}

export function isColorSupported(): boolean {
  return process.stdout.isTTY === true;
}