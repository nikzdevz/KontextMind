import { readFileSync } from 'fs';
import type { CodeParser, ParsedFile, IndexedFile } from './parser-types.js';
import type { ImportRecord, ExportRecord, SymbolRecord, ApiRouteRecord } from './parser-types.js';

const FRAMEWORK_ROUTE_PATTERNS = [
  // Express patterns
  /^(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(/,
  /^(?:app|router)\[['"](\w+)['"]\s*,?\s*/,
  // Fastify patterns
  /^fastify\.(get|post|put|delete|patch|options|head)\s*\(/,
  // Koa patterns
  /^router\.(get|post|put|delete|patch)\s*\(/,
];

export class TypeScriptParser implements CodeParser {
  readonly language = 'typescript';

  supports(language: string): boolean {
    const lang = language.toLowerCase();
    return ['typescript', 'javascript', 'js', 'ts', 'jsx', 'tsx'].includes(lang);
  }

  parse(file: IndexedFile, content: string): ParsedFile {
    const imports = this.extractImports(content, file.filePath);
    const exports = this.extractExports(content);
    const symbols = this.extractSymbols(content, file);
    const envReads = this.extractEnvReads(content);
    const apiRoutes = this.extractApiRoutes(content, file.filePath);
    const parseErrors: string[] = [];

    return {
      filePath: file.filePath,
      language: file.language,
      imports,
      exports,
      symbols,
      envReads,
      apiRoutes,
      parseErrors,
    };
  }

  private extractImports(content: string, filePath: string): ImportRecord[] {
    const imports: ImportRecord[] = [];
    const lines = content.split('\n');

    // ES6 import: import x from 'module'
    const es6ImportRegex = /^import\s+(?:(\*\s+as\s+\w+)|(\w+)|(?:\{[^}]+\})|(\w+(?:\s*,\s*(?:\{[^}]+\}|\w+|\*))?))\s+from\s+['"]([^'"]+)['"]/;
    // ES6 dynamic import: import('module')
    const dynamicImportRegex = /import\s*\(['"]([^'"]+)['"]\)/g;
    // CommonJS require: const x = require('module')
    const requireRegex = /^const\s+\{?\s*([^}\s]+)\s*\}?\s*=\s*require\s*\(['"]([^'"]+)['"]\)/;
    // Side-effect import: import 'module'
    const sideEffectRegex = /^import\s+['"]([^'"]+)['"]/;

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Check for ES6 imports
      const es6Match = trimmed.match(es6ImportRegex);
      if (es6Match) {
        const namedImports: string[] = [];
        // Parse named imports like { foo, bar }
        const namedSection = trimmed.match(/\{([^}]+)\}/);
        if (namedSection) {
          namedImports.push(...namedSection[1].split(',').map(s => s.trim()));
        }

        imports.push({
          path: es6Match[4] || es6Match[2],
          kind: 'import',
          startLine: lineNum,
          endLine: lineNum,
          isDefault: !namedSection && !es6Match[1],
          namedImports,
        });
      }

      // Check for require statements
      const requireMatch = trimmed.match(requireRegex);
      if (requireMatch) {
        imports.push({
          path: requireMatch[2],
          kind: 'require',
          startLine: lineNum,
          endLine: lineNum,
          isDefault: false,
          namedImports: requireMatch[1].split(',').map(s => s.trim()),
        });
      }

      // Check for side-effect imports
      const sideEffectMatch = trimmed.match(sideEffectRegex);
      if (sideEffectMatch && !es6Match) {
        imports.push({
          path: sideEffectMatch[1],
          kind: 'import',
          startLine: lineNum,
          endLine: lineNum,
          isDefault: false,
          namedImports: [],
        });
      }
    });

    // Find dynamic imports
    let match;
    const dynamicRegex = /import\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = dynamicRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      imports.push({
        path: match[1],
        kind: 'dynamic',
        startLine: lineNum,
        endLine: lineNum,
        isDefault: false,
        namedImports: [],
      });
    }

    return imports;
  }

  private extractExports(content: string): ExportRecord[] {
    const exports: ExportRecord[] = [];
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Default export: export default x
      const defaultMatch = trimmed.match(/^export\s+default\s+(\w+)/);
      if (defaultMatch) {
        exports.push({
          name: defaultMatch[1],
          kind: 'default',
          startLine: lineNum,
          endLine: lineNum,
        });
        return;
      }

      // Named export: export { foo, bar }
      const namedMatch = trimmed.match(/^export\s+\{([^}]+)\}/);
      if (namedMatch) {
        const names = namedMatch[1].split(',').map(s => s.trim().split(' as ')[0]);
        names.forEach(name => {
          exports.push({
            name,
            kind: 'named',
            startLine: lineNum,
            endLine: lineNum,
          });
        });
        return;
      }

      // Export statement: export const/function/class x
      const exportDeclMatch = trimmed.match(/^export\s+(?:async\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)/);
      if (exportDeclMatch) {
        exports.push({
          name: exportDeclMatch[1],
          kind: 'named',
          startLine: lineNum,
          endLine: lineNum,
        });
      }
    });

    return exports;
  }

  private extractSymbols(content: string, file: IndexedFile): SymbolRecord[] {
    const symbols: SymbolRecord[] = [];
    const lines = content.split('\n');
    let braceDepth = 0;

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Track brace depth
      braceDepth += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;

      // Function declaration: function name(...)
      const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
      if (funcMatch) {
        symbols.push(this.createSymbolRecord(
          funcMatch[1],
          'function',
          lineNum,
          lineNum,
          this.getFunctionSignature(trimmed),
          trimmed.startsWith('export'),
          file,
        ));
        return;
      }

      // Arrow function: const name = () => ...
      const arrowMatch = trimmed.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        symbols.push(this.createSymbolRecord(
          arrowMatch[1],
          'function',
          lineNum,
          lineNum,
          this.getArrowSignature(trimmed, lines, idx),
          trimmed.startsWith('export'),
          file,
        ));
        return;
      }

      // Class declaration: class Name
      const classMatch = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        const endLine = this.findBlockEnd(lines, idx);
        symbols.push(this.createSymbolRecord(
          classMatch[1],
          'class',
          lineNum,
          endLine,
          `class ${classMatch[1]}`,
          trimmed.startsWith('export'),
          file,
        ));
        return;
      }

      // Interface declaration
      const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
      if (ifaceMatch) {
        const endLine = this.findBlockEnd(lines, idx);
        symbols.push(this.createSymbolRecord(
          ifaceMatch[1],
          'interface',
          lineNum,
          endLine,
          `interface ${ifaceMatch[1]}`,
          trimmed.startsWith('export'),
          file,
        ));
        return;
      }

      // Type alias
      const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)\s*=/);
      if (typeMatch) {
        symbols.push(this.createSymbolRecord(
          typeMatch[1],
          'type',
          lineNum,
          lineNum,
          this.getTypeSignature(trimmed),
          trimmed.startsWith('export'),
          file,
        ));
        return;
      }

      // Const/let variable declarations
      const varMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/);
      if (varMatch && braceDepth === 0) {
        symbols.push(this.createSymbolRecord(
          varMatch[1],
          'variable',
          lineNum,
          lineNum,
          trimmed,
          trimmed.startsWith('export'),
          file,
        ));
      }
    });

    return symbols;
  }

  private extractEnvReads(content: string): string[] {
    const envReads: string[] = [];
    const envRegex = /(?:process\.env|import\.meta\.env|import\.env)\s*\.\s*(\w+)/g;
    let match;

    while ((match = envRegex.exec(content)) !== null) {
      envReads.push(match[1]);
    }

    return [...new Set(envReads)];
  }

  private extractApiRoutes(content: string, filePath: string): ApiRouteRecord[] {
    const routes: ApiRouteRecord[] = [];
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Express app.get('path', handler)
      const expressMatch = trimmed.match(/^(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/);
      if (expressMatch) {
        routes.push({
          method: expressMatch[1].toUpperCase() as ApiRouteRecord['method'],
          path: expressMatch[2],
          handler: expressMatch[3],
          startLine: idx + 1,
          filePath,
          framework: 'express',
        });
      }

      // Express app['GET'](path, handler) style
      const expressBracketMatch = trimmed.match(/^(?:app|router)\[['"](\w+)['"]\s*\(?\s*['"]([^'"]+)['"]/);
      if (expressBracketMatch) {
        routes.push({
          method: expressBracketMatch[1].toUpperCase() as ApiRouteRecord['method'],
          path: expressBracketMatch[2],
          handler: 'anonymous',
          startLine: idx + 1,
          filePath,
          framework: 'express',
        });
      }
    });

    return routes;
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

  private findBlockEnd(lines: string[], startIdx: number): number {
    let braceCount = 0;
    let foundOpen = false;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      foundOpen = foundOpen || braceCount > 0;
      braceCount -= (line.match(/\}/g) || []).length;

      if (foundOpen && braceCount === 0) {
        return i + 1;
      }
    }

    return startIdx + 1;
  }

  private getFunctionSignature(line: string): string {
    const match = line.match(/function\s+(\w+)\s*(\([^)]*\))?/);
    return match ? `function ${match[1]}${match[2] || '()'}` : line.substring(0, 50);
  }

  private getArrowSignature(line: string, lines: string[], idx: number): string {
    const varMatch = line.match(/const\s+(\w+)\s*=/);
    if (varMatch) {
      return varMatch[1];
    }
    return line.substring(0, 50);
  }

  private getTypeSignature(line: string): string {
    return line.substring(0, 80);
  }
}

export function createTypeScriptParser(): TypeScriptParser {
  return new TypeScriptParser();
}
