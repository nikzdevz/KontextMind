import type { TemplateContext } from '../types/index.js';

export interface Template {
  name: string;
  content: string;
}

export interface TemplateVariables {
  PROJECT_NAME?: string;
  CREATED_AT?: string;
  MODE?: string;
  GIT_MODE?: string;
  GIT_AVAILABLE?: boolean;
  PROVIDER?: string;
  AGENTS?: string;
  AGENTS_JSON?: string;
  KONTEXTMIND_VERSION?: string;
  [key: string]: string | boolean | undefined;
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template;

  // Replace all placeholders with values, or empty string if not present
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  result = result.replace(placeholderRegex, (match, key) => {
    const value = variables[key.trim()];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });

  return result;
}

export function renderTemplateWithContext(template: string, context: TemplateContext): string {
  return renderTemplate(template, context as unknown as TemplateVariables);
}