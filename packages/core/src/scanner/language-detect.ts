export type Language =
  | 'typescript'
  | 'typescript-react'
  | 'javascript'
  | 'javascript-react'
  | 'python'
  | 'go'
  | 'java'
  | 'ruby'
  | 'php'
  | 'csharp'
  | 'rust'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'html'
  | 'css'
  | 'shell'
  | 'unknown';

const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript-react',
  '.js': 'javascript',
  '.jsx': 'javascript-react',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.rs': 'rust',
  '.json': 'json',
  '.jsonc': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.ps1': 'shell',
  '.psm1': 'shell',
  '.vue': 'html',
  '.svelte': 'html',
  '.xml': 'html',
  '.svg': 'html',
  '.toml': 'yaml',
  '.ini': 'yaml',
  '.cfg': 'yaml',
  '.conf': 'yaml',
  '.dockerfile': 'shell',
  '.sql': 'unknown',
  '.graphql': 'unknown',
  '.proto': 'unknown',
  '.txt': 'unknown',
  '.log': 'unknown',
  '.lock': 'json',
  '.gitignore': 'unknown',
  '.env.example': 'unknown',
};

export function detectLanguage(filePath: string): Language {
  const lowerPath = filePath.toLowerCase();

  // Check for special filenames
  if (lowerPath === 'dockerfile') return 'shell';
  if (lowerPath === 'makefile') return 'shell';
  if (lowerPath === 'rakefile') return 'ruby';

  // Get extension
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return 'unknown';

  const ext = filePath.slice(lastDot);

  return EXTENSION_TO_LANGUAGE[ext] || 'unknown';
}

export function getLanguageLabel(language: Language): string {
  const labels: Record<Language, string> = {
    typescript: 'TypeScript',
    'typescript-react': 'TypeScript React',
    javascript: 'JavaScript',
    'javascript-react': 'JavaScript React',
    python: 'Python',
    go: 'Go',
    java: 'Java',
    ruby: 'Ruby',
    php: 'PHP',
    csharp: 'C#',
    rust: 'Rust',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    html: 'HTML',
    css: 'CSS',
    shell: 'Shell',
    unknown: 'Unknown',
  };

  return labels[language];
}

export function isTextFile(language: Language): boolean {
  return language !== 'unknown';
}

export function isCodeFile(language: Language): boolean {
  return [
    'typescript',
    'typescript-react',
    'javascript',
    'javascript-react',
    'python',
    'go',
    'java',
    'ruby',
    'php',
    'csharp',
    'rust',
  ].includes(language);
}