import type { CodeParser, ParsedFile, IndexedFile } from './parser-types.js';

export function createParser(): CodeParser {
  throw new Error('Parser factory not implemented - use specific parser');
}

export function detectParser(language: string): string | null {
  const lang = language.toLowerCase();

  if (['typescript', 'javascript', 'js', 'ts', 'jsx', 'tsx'].includes(lang)) {
    return 'typescript';
  }
  if (['python', 'py'].includes(lang)) {
    return 'python';
  }
  if (['go', 'golang'].includes(lang)) {
    return 'go';
  }
  if (['rust', 'rs'].includes(lang)) {
    return 'rust';
  }

  return null;
}

export function getParserLanguage(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() || '';

  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
  };

  return langMap[ext] || 'unknown';
}

export interface ParserModule {
  new (): CodeParser;
  language: string;
}

const parsers: Map<string, ParserModule> = new Map();

export function registerParser(parser: ParserModule): void {
  parsers.set(parser.language, parser);
}

export function getParser(language: string): CodeParser | null {
  const ParserClass = parsers.get(language);
  if (ParserClass) {
    return new ParserClass();
  }
  return null;
}

export function getSupportedLanguages(): string[] {
  return Array.from(parsers.keys());
}
