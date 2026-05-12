import { describe, it, expect } from 'vitest';
import { detectLanguage, getLanguageLabel, isCodeFile, isTextFile } from '../../packages/core/src/scanner/language-detect.js';

describe('Language Detection', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript files', () => {
      expect(detectLanguage('src/index.ts')).toBe('typescript');
      expect(detectLanguage('src/components/Button.ts')).toBe('typescript');
    });

    it('should detect TypeScript React files', () => {
      expect(detectLanguage('src/App.tsx')).toBe('typescript-react');
      expect(detectLanguage('src/components/Modal.tsx')).toBe('typescript-react');
    });

    it('should detect JavaScript files', () => {
      expect(detectLanguage('src/index.js')).toBe('javascript');
      expect(detectLanguage('src/utils/helpers.js')).toBe('javascript');
      expect(detectLanguage('src/app.mjs')).toBe('javascript');
    });

    it('should detect JavaScript React files', () => {
      expect(detectLanguage('src/App.jsx')).toBe('javascript-react');
    });

    it('should detect Python files', () => {
      expect(detectLanguage('main.py')).toBe('python');
      expect(detectLanguage('src/utils/parser.py')).toBe('python');
    });

    it('should detect Go files', () => {
      expect(detectLanguage('main.go')).toBe('go');
      expect(detectLanguage('src/api/server.go')).toBe('go');
    });

    it('should detect Java files', () => {
      expect(detectLanguage('Main.java')).toBe('java');
    });

    it('should detect Ruby files', () => {
      expect(detectLanguage('Gemfile')).not.toBe('ruby'); // Special case
      expect(detectLanguage('script.rb')).toBe('ruby');
    });

    it('should detect Rust files', () => {
      expect(detectLanguage('main.rs')).toBe('rust');
      expect(detectLanguage('src/lib.rs')).toBe('rust');
    });

    it('should detect C# files', () => {
      expect(detectLanguage('Program.cs')).toBe('csharp');
    });

    it('should detect JSON files', () => {
      expect(detectLanguage('package.json')).toBe('json');
      expect(detectLanguage('config.json')).toBe('json');
    });

    it('should detect YAML files', () => {
      expect(detectLanguage('config.yaml')).toBe('yaml');
      expect(detectLanguage('.github/workflows/ci.yml')).toBe('yaml');
    });

    it('should detect Markdown files', () => {
      expect(detectLanguage('README.md')).toBe('markdown');
      expect(detectLanguage('docs/guide.md')).toBe('markdown');
    });

    it('should detect HTML files', () => {
      expect(detectLanguage('index.html')).toBe('html');
      expect(detectLanguage('src/template.html')).toBe('html');
    });

    it('should detect CSS files', () => {
      expect(detectLanguage('style.css')).toBe('css');
      expect(detectLanguage('styles/main.scss')).toBe('css');
    });

    it('should detect Shell files', () => {
      expect(detectLanguage('script.sh')).toBe('shell');
      expect(detectLanguage('setup.bash')).toBe('shell');
      expect(detectLanguage('Makefile')).toBe('shell'); // Special case
      expect(detectLanguage('Dockerfile')).toBe('shell'); // Special case
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(detectLanguage('file.xyz')).toBe('unknown');
      expect(detectLanguage('file')).toBe('unknown');
    });
  });

  describe('getLanguageLabel', () => {
    it('should return human-readable labels', () => {
      expect(getLanguageLabel('typescript')).toBe('TypeScript');
      expect(getLanguageLabel('javascript')).toBe('JavaScript');
      expect(getLanguageLabel('python')).toBe('Python');
      expect(getLanguageLabel('unknown')).toBe('Unknown');
    });
  });

  describe('isTextFile', () => {
    it('should identify text files', () => {
      expect(isTextFile('typescript')).toBe(true);
      expect(isTextFile('markdown')).toBe(true);
      expect(isTextFile('unknown')).toBe(false);
    });
  });

  describe('isCodeFile', () => {
    it('should identify code files', () => {
      expect(isCodeFile('typescript')).toBe(true);
      expect(isCodeFile('python')).toBe(true);
      expect(isCodeFile('go')).toBe(true);
      expect(isCodeFile('markdown')).toBe(false);
      expect(isCodeFile('json')).toBe(false);
    });
  });
});