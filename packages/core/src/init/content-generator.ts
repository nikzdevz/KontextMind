import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { ModelProvider } from '../providers/provider-types.js';
import { createProviderFromConfig } from '../providers/provider-registry.js';
import { walkDirectory } from '../scanner/walk-files.js';

export interface PackageJsonInfo {
  name: string;
  version: string;
  description: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  engines?: { node?: string };
}

export interface ProjectStructure {
  languages: string[];
  frameworks: string[];
  mainFiles: string[];
  configFiles: string[];
  testFiles: string[];
  totalFiles: number;
}

export interface DetectedConventions {
  fileNaming: string[];
  importStyle: string;
  testingFramework: string | null;
  apiStyle: string | null;
}

export interface ProjectInfo {
  name: string;
  root: string;
  packageJson: PackageJsonInfo | null;
  readme: string | null;
  structure: ProjectStructure;
  detectedConventions: DetectedConventions;
}

export interface ProviderConfig {
  name: string;
  provider: 'mock' | 'openai' | 'anthropic' | 'ollama' | 'bedrock' | 'openai-compatible';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface GeneratedContent {
  projectMd: string;
  conventionsMd: string;
}

export interface GenerationOptions {
  projectRoot: string;
  projectInfo: ProjectInfo;
  providerConfig: ProviderConfig;
}

export async function gatherProjectInfo(projectRoot: string, projectName: string): Promise<ProjectInfo> {
  const packageJson = loadPackageJson(projectRoot);
  const readme = loadReadme(projectRoot);
  const structure = detectProjectStructure(projectRoot);
  const conventions = detectConventions(projectRoot, structure);

  return {
    name: projectName,
    root: projectRoot,
    packageJson,
    readme,
    structure,
    detectedConventions: conventions,
  };
}

function loadPackageJson(projectRoot: string): PackageJsonInfo | null {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;

  try {
    const content = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return {
      name: pkg.name || '',
      version: pkg.version || '0.0.0',
      description: pkg.description || '',
      scripts: pkg.scripts || {},
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      engines: pkg.engines,
    };
  } catch {
    return null;
  }
}

function loadReadme(projectRoot: string): string | null {
  const candidates = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
  for (const name of candidates) {
    const path = join(projectRoot, name);
    if (existsSync(path)) {
      try {
        return readFileSync(path, 'utf-8').substring(0, 5000);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function detectProjectStructure(projectRoot: string): ProjectStructure {
  const result = walkDirectory(projectRoot, {
    maxFileSizeBytes: 100 * 1024,
    includeHidden: false,
  });

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const mainFiles: string[] = [];
  const configFiles: string[] = [];
  const testFiles: string[] = [];

  for (const file of result.files.slice(0, 500)) {
    const ext = file.split('.').pop()?.toLowerCase();

    // Detect languages
    if (ext === 'ts' || ext === 'tsx') languages.add('TypeScript');
    else if (ext === 'js' || ext === 'jsx') languages.add('JavaScript');
    else if (ext === 'py') languages.add('Python');
    else if (ext === 'go') languages.add('Go');
    else if (ext === 'rs') languages.add('Rust');
    else if (ext === 'java') languages.add('Java');
    else if (ext === 'cs') languages.add('C#');

    // Detect test files
    if (file.includes('test') || file.includes('spec') || file.includes('__tests__')) {
      testFiles.push(file);
    }

    // Detect main/entry files
    if (file.match(/^(index|main|app|server|cli|start)\.(ts|js|py|go)$/)) {
      mainFiles.push(file);
    }

    // Detect config files
    if (file.match(/\.(config|conf|json|yaml|yml|toml)$/) && !file.includes('package')) {
      configFiles.push(file);
    }
  }

  // Detect frameworks from dependencies and file patterns
  if (languages.has('TypeScript') || languages.has('JavaScript')) {
    const allFiles = result.files.join(' ');
    const allDeps = result.files.some(f => f.includes('node_modules')) ? '' : '';

    if (allFiles.includes('react')) frameworks.add('React');
    if (allFiles.includes('next')) frameworks.add('Next.js');
    if (allFiles.includes('express')) frameworks.add('Express');
    if (allFiles.includes('nest')) frameworks.add('NestJS');
    if (allFiles.includes('vue')) frameworks.add('Vue');
    if (allFiles.includes('angular')) frameworks.add('Angular');
    if (allFiles.includes('electron')) frameworks.add('Electron');
    if (allFiles.includes('astro')) frameworks.add('Astro');
    if (allFiles.includes('svelte')) frameworks.add('Svelte');
  }

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    mainFiles: mainFiles.slice(0, 10),
    configFiles: configFiles.slice(0, 20),
    testFiles: testFiles.slice(0, 10),
    totalFiles: result.files.length,
  };
}

function detectConventions(projectRoot: string, structure: ProjectStructure): DetectedConventions {
  const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];
  const result = walkDirectory(projectRoot, { maxFileSizeBytes: 50 * 1024, includeHidden: false });

  const sampleFiles: string[] = [];
  for (const file of result.files) {
    if (sourceExtensions.some(ext => file.endsWith(ext))) {
      sampleFiles.push(file);
      if (sampleFiles.length >= 20) break;
    }
  }

  // Analyze file naming patterns
  const fileNames = sampleFiles.map(f => f.split('/').pop() || '');
  const kebabCase = fileNames.filter(n => n.includes('-')).length;
  const camelCase = fileNames.filter(n => /^[a-z][a-zA-Z]*$/.test(n.split('.')[0])).length;
  const PascalCase = fileNames.filter(n => /^[A-Z][a-zA-Z]*$/.test(n.split('.')[0])).length;
  const snakeCase = fileNames.filter(n => /^[a-z_]+$/.test(n.split('.')[0])).length;

  const fileNaming: string[] = [];
  const total = fileNames.length || 1;
  if (kebabCase > total * 0.2) fileNaming.push('kebab-case');
  if (camelCase > total * 0.2) fileNaming.push('camelCase');
  if (PascalCase > total * 0.2) fileNaming.push('PascalCase');
  if (snakeCase > total * 0.2) fileNaming.push('snake_case');

  // Detect testing framework
  let testingFramework: string | null = null;
  if (structure.testFiles.length > 0) {
    const testContent = structure.testFiles.join(' ');
    if (testContent.includes('vitest')) testingFramework = 'Vitest';
    else if (testContent.includes('jest')) testingFramework = 'Jest';
    else if (testContent.includes('mocha')) testingFramework = 'Mocha';
    else if (testContent.includes('pytest')) testingFramework = 'Pytest';
    else if (testContent.includes('unittest')) testingFramework = 'unittest';
    else if (testContent.includes('go test')) testingFramework = 'testing';
    else testingFramework = 'Detected (see test files)';
  }

  // Detect API style
  let apiStyle: string | null = null;
  if (structure.configFiles.some(f => f.includes('swagger') || f.includes('openapi'))) {
    apiStyle = 'REST/OpenAPI';
  } else if (structure.configFiles.some(f => f.includes('grpc'))) {
    apiStyle = 'gRPC';
  } else if (structure.configFiles.some(f => f.includes('graphql'))) {
    apiStyle = 'GraphQL';
  }

  return {
    fileNaming: fileNaming.length > 0 ? fileNaming : ['camelCase'],
    importStyle: 'ESM',
    testingFramework,
    apiStyle,
  };
}

export async function generateContent(options: GenerationOptions): Promise<GeneratedContent> {
  const { projectInfo, providerConfig } = options;

  const provider = createProviderFromConfig({
    name: providerConfig.name,
    provider: providerConfig.provider,
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    model: providerConfig.model,
  });

  if (!provider) {
    return {
      projectMd: buildProjectMdFallback(projectInfo.name, projectInfo),
      conventionsMd: buildConventionsMdFallback(projectInfo.structure, projectInfo.detectedConventions),
    };
  }

  const isMock = provider.getName() === 'mock';
  const model = providerConfig.model || 'gpt-3.5-turbo';

  // Always use fallback for mock provider (no API key needed)
  if (isMock) {
    return {
      projectMd: buildProjectMdFallback(projectInfo.name, projectInfo),
      conventionsMd: buildConventionsMdFallback(projectInfo.structure, projectInfo.detectedConventions),
    };
  }

  try {
    const projectMd = await generateProjectMd(projectInfo, provider, model);
    const conventionsMd = await generateConventionsMd(projectInfo, provider, model);
    return { projectMd, conventionsMd };
  } catch (error) {
    // Graceful degradation - use fallback on error
    return {
      projectMd: buildProjectMdFallback(projectInfo.name, projectInfo),
      conventionsMd: buildConventionsMdFallback(projectInfo.structure, projectInfo.detectedConventions),
    };
  }
}

async function generateProjectMd(
  projectInfo: ProjectInfo,
  provider: ModelProvider,
  model: string
): Promise<string> {
  const { packageJson, readme, structure, name } = projectInfo;

  const description = packageJson?.description || readme?.substring(0, 500) || 'Project information not available';

  const prompt = buildProjectMdPrompt({
    name,
    description,
    version: packageJson?.version || 'unknown',
    languages: structure.languages,
    frameworks: structure.frameworks,
    dependencies: Object.keys(packageJson?.dependencies || {}).slice(0, 15),
    dependenciesDev: Object.keys(packageJson?.devDependencies || {}).slice(0, 10),
    readmePreview: readme?.substring(0, 2000) || null,
  });

  const result = await provider.generateText({
    prompt,
    system: 'You are a helpful assistant that generates project documentation. Output ONLY the markdown content, no explanations.',
    maxTokens: 1500,
    model,
  });

  return parseAndRenderProjectMd(name, result.text, projectInfo);
}

async function generateConventionsMd(
  projectInfo: ProjectInfo,
  provider: ModelProvider,
  model: string
): Promise<string> {
  const { structure, detectedConventions, packageJson } = projectInfo;

  const prompt = buildConventionsMdPrompt({
    languages: structure.languages,
    frameworks: structure.frameworks,
    fileNaming: detectedConventions.fileNaming,
    importStyle: detectedConventions.importStyle,
    testingFramework: detectedConventions.testingFramework,
    dependencies: Object.keys(packageJson?.dependencies || {}),
  });

  const result = await provider.generateText({
    prompt,
    system: 'You are a helpful assistant that generates coding convention documentation. Output ONLY the markdown content, no explanations.',
    maxTokens: 1500,
    model,
  });

  return parseAndRenderConventionsMd(result.text, projectInfo);
}

// --- Prompt builders ---

function buildProjectMdPrompt(info: {
  name: string;
  description: string;
  version: string;
  languages: string[];
  frameworks: string[];
  dependencies: string[];
  dependenciesDev: string[];
  readmePreview: string | null;
}): string {
  return `Generate project.md content for a project with these details:

Project: ${info.name}
Version: ${info.version}
Description: ${info.description}

Languages: ${info.languages.join(', ') || 'Unknown'}
Frameworks: ${info.frameworks.join(', ') || 'None'}
Dependencies: ${info.dependencies.join(', ') || 'None'}
Dev Dependencies: ${info.dependenciesDev.join(', ') || 'None'}

${info.readmePreview ? `README Preview:\n${info.readmePreview}\n` : ''}

Include sections: PURPOSE, TECH_STACK, STRUCTURE, GETTING_STARTED, KEY_FILES, NOTES.
Output ONLY the markdown content, no explanations or code fences around the output.`;
}

function buildConventionsMdPrompt(info: {
  languages: string[];
  frameworks: string[];
  fileNaming: string[];
  importStyle: string;
  testingFramework: string | null;
  dependencies: string[];
}): string {
  return `Generate conventions.md for a project with these characteristics:

Languages: ${info.languages.join(', ')}
Frameworks: ${info.frameworks.join(', ') || 'None'}
File Naming: ${info.fileNaming.join(', ')}
Import Style: ${info.importStyle}
Testing: ${info.testingFramework || 'Not detected'}

Include sections: CODING_STANDARDS, NAMING_CONVENTIONS, TESTING_RULES, GIT_WORKFLOW, CODE_REVIEW.
Output ONLY the markdown content, no explanations or code fences around the output.`;
}

// --- Content parsers ---

function parseAndRenderProjectMd(name: string, generated: string, projectInfo: ProjectInfo): string {
  // If the LLM returned something useful, clean it up
  const cleaned = cleanMarkdownOutput(generated);

  // If content is too short or malformed, use fallback
  if (cleaned.length < 100) {
    return buildProjectMdFallback(name, projectInfo);
  }

  // Ensure it starts with a proper heading
  if (!cleaned.startsWith(`# ${name}`)) {
    return `# ${name}\n\n${cleaned}`;
  }

  return cleaned;
}

function parseAndRenderConventionsMd(generated: string, projectInfo: ProjectInfo): string {
  const cleaned = cleanMarkdownOutput(generated);

  if (cleaned.length < 100) {
    return buildConventionsMdFallback(projectInfo.structure, projectInfo.detectedConventions);
  }

  if (!cleaned.startsWith('# Project Conventions')) {
    return `# Project Conventions\n\n${cleaned}`;
  }

  return cleaned;
}

function cleanMarkdownOutput(text: string): string {
  // Remove any leading/trailing whitespace
  let cleaned = text.trim();

  // Remove markdown code fences if present
  cleaned = cleaned.replace(/^```(?:markdown)?\n?/, '');
  cleaned = cleaned.replace(/\n?```$/, '');

  // Remove any "Here is the markdown:" or similar prefixes
  cleaned = cleaned.replace(/^(?:here(?:'s| is) (?:the|)?|below is|generated):?\s*/i, '');

  return cleaned.trim();
}

// --- Fallback content builders ---

function buildProjectMdFallback(name: string, projectInfo: ProjectInfo): string {
  const { packageJson, readme, structure } = projectInfo;

  const techStack = buildTechStackMd(structure, packageJson);
  const projectStructure = buildStructureMd(structure);
  const gettingStarted = buildGettingStartedMd(structure, packageJson);
  const keyFiles = buildKeyFilesMd(structure);

  return `# ${name}

${packageJson?.description || readme?.substring(0, 300) || 'Project description not available.'}

## Tech Stack

${techStack}

## Project Structure

${projectStructure}

## Getting Started

${gettingStarted}

## Key Files

${keyFiles}

## Important Notes

This file is part of the project-local AI memory and should be updated as the project evolves.
`;
}

function buildConventionsMdFallback(
  structure: ProjectStructure,
  conventions: DetectedConventions
): string {
  return `# Project Conventions

## Coding Standards

- Write clear, descriptive variable and function names
- Add JSDoc/Typedoc comments for public APIs
- Keep functions small and focused (single responsibility)
- Use async/await for asynchronous operations
${conventions.importStyle === 'ESM' ? '- Use ESM import/export syntax' : '- Use CommonJS require/module.exports'}
- Handle errors with proper try/catch blocks

## Naming Conventions

- **Files**: ${conventions.fileNaming.join(', ') || 'camelCase'}
- Classes and React components: PascalCase
- Functions and variables: camelCase
- Constants and environment variables: UPPER_SNAKE_CASE
- CSS classes: ${conventions.fileNaming.includes('kebab-case') ? 'kebab-case' : 'camelCase'}

## Testing Rules

${conventions.testingFramework
  ? `- Testing framework: ${conventions.testingFramework}\n- Write tests for all new functions and components\n- Aim for meaningful tests, not just coverage`
  : '- No testing framework detected yet\n- Consider adding a testing framework (Vitest, Jest, etc.)'}

${conventions.apiStyle ? `## API Conventions\n\n- API Style: ${conventions.apiStyle}\n- Follow RESTful design principles` : ''}

## Git Workflow

- Use conventional commits (e.g., \`feat:\`, \`fix:\`, \`docs:\`)
- Create feature branches from main
- Submit PRs for code review
- Squash commits before merge

## Code Review Guidelines

- Ensure tests pass before merging
- Check for linting and formatting issues
- Review for security vulnerabilities
- Verify no secrets or credentials in code
`;
}

function buildTechStackMd(structure: ProjectStructure, pkg: PackageJsonInfo | null): string {
  const parts: string[] = [];

  if (structure.frameworks.length > 0) {
    parts.push(`**Frameworks**: ${structure.frameworks.join(', ')}`);
  }

  if (structure.languages.length > 0) {
    parts.push(`**Languages**: ${structure.languages.join(', ')}`);
  }

  if (pkg?.dependencies && Object.keys(pkg.dependencies).length > 0) {
    parts.push('\n### Dependencies');
    const mainDeps = Object.entries(pkg.dependencies).slice(0, 15);
    for (const [name, version] of mainDeps) {
      parts.push(`- \`${name}\`: ${version}`);
    }
  }

  if (pkg?.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
    parts.push('\n### Dev Dependencies');
    const devDeps = Object.entries(pkg.devDependencies).slice(0, 10);
    for (const [name, version] of devDeps) {
      parts.push(`- \`${name}\`: ${version}`);
    }
  }

  return parts.join('\n') || '- Tech stack to be documented';
}

function buildStructureMd(structure: ProjectStructure): string {
  const parts: string[] = [];

  parts.push(`**Total files scanned**: ${structure.totalFiles}`);

  if (structure.mainFiles.length > 0) {
    parts.push('\n### Entry Points');
    for (const file of structure.mainFiles) {
      parts.push(`- \`${file}\``);
    }
  }

  if (structure.configFiles.length > 0) {
    parts.push('\n### Configuration Files');
    for (const file of structure.configFiles.slice(0, 10)) {
      parts.push(`- \`${file}\``);
    }
  }

  if (structure.testFiles.length > 0) {
    parts.push(`\n**Test files**: ${structure.testFiles.length} detected`);
  }

  return parts.join('\n') || 'Project structure analysis pending.';
}

function buildGettingStartedMd(structure: ProjectStructure, pkg: PackageJsonInfo | null): string {
  const parts: string[] = [];

  if (pkg?.scripts) {
    const commonScripts = ['install', 'dev', 'start', 'build', 'test', 'lint', 'format'];
    const available = commonScripts.filter(s => pkg.scripts?.[s]);

    if (available.length > 0) {
      parts.push('### Common Commands');
      for (const script of available) {
        parts.push(`- \`npm run ${script}\``);
      }
    }
  }

  if (!parts.length) {
    parts.push('```bash\nnpm install\nnpm run dev\n```');
  }

  return parts.join('\n') || 'Run `npm install` to install dependencies.';
}

function buildKeyFilesMd(structure: ProjectStructure): string {
  const parts: string[] = [];

  for (const file of structure.mainFiles.slice(0, 5)) {
    parts.push(`- \`${file}\` - Entry point`);
  }

  for (const file of structure.configFiles.slice(0, 5)) {
    parts.push(`- \`${file}\` - Configuration`);
  }

  return parts.join('\n') || 'Key files to be documented.';
}

export function createProviderConfigFromOptions(
  selectedProvider: string,
  globalConfig?: { providers?: Record<string, { provider: string; baseUrl?: string; apiKey?: string; model?: string }>; defaultProvider?: string }
): ProviderConfig {
  // Check global config first
  if (globalConfig?.providers?.[selectedProvider]) {
    const globalProvider = globalConfig.providers[selectedProvider];
    return {
      name: selectedProvider,
      provider: (globalProvider.provider || 'openai-compatible') as ProviderConfig['provider'],
      baseUrl: globalProvider.baseUrl,
      apiKey: globalProvider.apiKey,
      model: globalProvider.model,
    };
  }

  // Fallback to built-in providers
  switch (selectedProvider) {
    case 'ollama':
      return { name: 'ollama', provider: 'openai-compatible', baseUrl: 'http://localhost:11434/v1' };
    case 'openai':
      return { name: 'openai', provider: 'openai' };
    case 'anthropic':
      return { name: 'anthropic', provider: 'anthropic' };
    case 'openai-compatible':
      return { name: 'openai-compatible', provider: 'openai-compatible' };
    case 'opusmax':
      return { name: 'opusmax', provider: 'openai-compatible', baseUrl: 'https://api.opusmax.pro/v1' };
    default:
      return { name: 'mock', provider: 'mock' };
  }
}

// Helper function for init-project to use
export async function gatherAndGenerateContent(
  projectRoot: string,
  projectName: string,
  selectedProvider: string,
  globalConfig?: { providers?: Record<string, { provider: string; baseUrl?: string; apiKey?: string; model?: string }>; defaultProvider?: string }
): Promise<GeneratedContent | null> {
  try {
    const projectInfo = await gatherProjectInfo(projectRoot, projectName);
    const providerConfig = createProviderConfigFromOptions(selectedProvider, globalConfig);

    return await generateContent({
      projectRoot,
      projectInfo,
      providerConfig,
    });
  } catch (error) {
    // Graceful degradation - return null to use template defaults
    console.warn('Content generation failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
