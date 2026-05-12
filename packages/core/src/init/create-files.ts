import type { InitResult } from '../types/index.js';
import type { TemplateDefinition } from '../templates/template-types.js';
import type { Mode, GitMode, Provider, AgentType } from '../types/index.js';
import { renderTemplate } from '../templates/render-template.js';
import { fileExists } from '../filesystem/file-exists.js';
import { writeFileSafe } from '../filesystem/write-file-safe.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

export interface FileToCreate {
  relativePath: string;
  content: string;
}

export function createJsonContent(relativePath: string, template: string, variables: Record<string, string | boolean>): string {
  let content = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    if (typeof value === 'boolean') {
      content = content.split(placeholder).join(String(value));
    } else {
      content = content.split(placeholder).join(value ?? '');
    }
  }
  return content;
}

export function prepareFileContent(template: TemplateDefinition, variables: Record<string, string | boolean>): string {
  // Check if it's JSON by file extension
  if (template.filename.endsWith('.json')) {
    return createJsonContent(template.filename, template.template, variables);
  }
  // For .md files, use template rendering
  return renderTemplate(template.template, variables);
}

export async function createFiles(
  files: FileToCreate[],
  force: boolean
): Promise<InitResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const exists = fileExists(file.relativePath);

    if (exists && !force) {
      skipped.push(file.relativePath);
      continue;
    }

    try {
      await writeFileSafe(file.relativePath, file.content);
      created.push(file.relativePath);
    } catch (error) {
      warnings.push(`Failed to create ${file.relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { created, skipped, warnings };
}

export async function createDirectories(dirs: string[]): Promise<string[]> {
  const created: string[] = [];

  for (const dir of dirs) {
    try {
      await ensureDir(dir);
      created.push(dir);
    } catch (error) {
      // Directory might already exist, that's fine
    }
  }

  return created;
}