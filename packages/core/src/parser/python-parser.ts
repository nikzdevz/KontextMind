import type { CodeParser, ParsedFile, IndexedFile } from './parser-types.js';
import type { ImportRecord, ExportRecord, SymbolRecord } from './parser-types.js';

export class PythonParser implements CodeParser {
  readonly language = 'python';

  supports(language: string): boolean {
    const lang = language.toLowerCase();
    return ['python', 'py'].includes(lang);
  }

  parse(file: IndexedFile, content: string): ParsedFile {
    const imports = this.extractImports(content);
    const symbols = this.extractSymbols(content, file);
    const envReads = this.extractEnvReads(content);
    const parseErrors: string[] = [];

    return {
      filePath: file.filePath,
      language: file.language,
      imports,
      exports: [], // Python doesn't have explicit exports like JS
      symbols,
      envReads,
      apiRoutes: [],
      parseErrors,
    };
  }

  private extractImports(content: string): ImportRecord[] {
    const imports: ImportRecord[] = [];
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // import x
      const importMatch = trimmed.match(/^import\s+([\w.]+)/);
      if (importMatch) {
        imports.push({
          path: importMatch[1],
          kind: 'import',
          startLine: lineNum,
          endLine: lineNum,
          isDefault: false,
          namedImports: [],
        });
        return;
      }

      // from x import y, z
      const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
      if (fromMatch) {
        const namedImports = fromMatch[2].split(',').map(s => {
          const cleaned = s.trim();
          // Handle "x as y" patterns
          const asMatch = cleaned.match(/^(\w+)(?:\s+as\s+\w+)?$/);
          return asMatch ? asMatch[1] : cleaned;
        });

        imports.push({
          path: fromMatch[1],
          kind: 'import',
          startLine: lineNum,
          endLine: lineNum,
          isDefault: false,
          namedImports,
        });
      }
    });

    return imports;
  }

  private extractSymbols(content: string, file: IndexedFile): SymbolRecord[] {
    const symbols: SymbolRecord[] = [];
    const lines = content.split('\n');
    const indentStack: number[] = [0];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      const indent = line.search(/\S/);

      // Function definition: def name(...)
      const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
      if (funcMatch) {
        symbols.push(this.createSymbolRecord(
          funcMatch[1],
          'function',
          lineNum,
          lineNum,
          this.getPythonSignature(trimmed),
          false,
          file,
        ));
        indentStack.push(indent);
        return;
      }

      // Class definition: class Name
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        const endLine = this.findPythonBlockEnd(lines, idx);
        symbols.push(this.createSymbolRecord(
          classMatch[1],
          'class',
          lineNum,
          endLine,
          `class ${classMatch[1]}`,
          false,
          file,
        ));
        indentStack.push(indent);
        return;
      }

      // Constant (SCREAMING_SNAKE_CASE)
      const constMatch = trimmed.match(/^([A-Z][A-Z0-9_]+)\s*=/);
      if (constMatch) {
        symbols.push(this.createSymbolRecord(
          constMatch[1],
          'constant',
          lineNum,
          lineNum,
          trimmed,
          false,
          file,
        ));
      }
    });

    return symbols;
  }

  private extractEnvReads(content: string): string[] {
    const envReads: string[] = [];

    // Check os.environ[...]
    const envBracketRegex = /os\.environ\[(?:['"](\w+)['"])/g;
    let match;
    while ((match = envBracketRegex.exec(content)) !== null) {
      envReads.push(match[1]);
    }

    // Check os.environ.get(...)
    const envGetRegex = /os\.environ\.get\s*\(['"](\w+)['"]\)/g;
    while ((match = envGetRegex.exec(content)) !== null) {
      envReads.push(match[1]);
    }

    // Also check os.getenv
    const getenvRegex = /os\.getenv\s*\(['"](\w+)['"]\)/g;
    while ((match = getenvRegex.exec(content)) !== null) {
      envReads.push(match[1]);
    }

    return [...new Set(envReads)];
  }

  private createSymbolRecord(
    name: string,
    kind: SymbolRecord['kind'],
    startLine: number,
    endLine: number,
    signature: string,
    exported: boolean,
    file: IndexedFile,
  ): SymbolRecord {
    return {
      id: `${file.filePath}:${name}:${startLine}`,
      name,
      kind,
      filePath: file.filePath,
      language: file.language,
      startLine,
      endLine,
      signature,
      exported,
      summaryStatus: 'missing',
    };
  }

  private findPythonBlockEnd(lines: string[], startIdx: number): number {
    const startIndent = lines[startIdx].search(/\S/);
    let bodyIndent = -1;

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) continue;

      const indent = line.search(/\S/);

      // Found next item at same or lower indent level
      if (indent <= startIndent) {
        return i;
      }

      // Track body indent
      if (bodyIndent === -1 && trimmed.match(/^def|^class|^async\s+def/)) {
        bodyIndent = indent;
      }
    }

    return lines.length;
  }

  private getPythonSignature(line: string): string {
    return line;
  }
}

export function createPythonParser(): PythonParser {
  return new PythonParser();
}
