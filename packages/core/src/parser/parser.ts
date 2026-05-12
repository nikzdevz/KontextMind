// Main parser interface - re-exports from parser-types

export type { CodeParser, ParsedFile, IndexedFile } from './parser-types.js';

export interface ParserProvider {
  getParser(language: string): import('./parser-types.js').CodeParser | null;
  getSupportedLanguages(): string[];
}
