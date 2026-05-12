import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../../packages/core/src/templates/render-template.js';

describe('Template Rendering', () => {
  describe('renderTemplate', () => {
    it('should replace placeholders with values', () => {
      const template = 'Hello {{NAME}}, welcome to {{PROJECT}}!';
      const variables = { NAME: 'World', PROJECT: 'KontextMind' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Hello World, welcome to KontextMind!');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      const template = '{{ITEM}} is great. I love {{ITEM}}!';
      const variables = { ITEM: 'KontextMind' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('KontextMind is great. I love KontextMind!');
    });

    it('should handle missing variables safely', () => {
      const template = 'Project: {{PROJECT}}, Version: {{VERSION}}';
      const variables = { PROJECT: 'KontextMind' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Project: KontextMind, Version: ');
    });

    it('should handle empty variables', () => {
      const template = '{{EMPTY}}';
      const variables = { EMPTY: '' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('');
    });

    it('should handle undefined variables', () => {
      const template = '{{UNDEFINED}}';
      const variables: Record<string, string> = {};

      const result = renderTemplate(template, variables);

      expect(result).toBe('');
    });

    it('should handle boolean values', () => {
      const template = 'Git available: {{GIT_AVAILABLE}}';
      const variables = { GIT_AVAILABLE: true };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Git available: true');
    });

    it('should not modify template without placeholders', () => {
      const template = 'This is plain text with no placeholders.';
      const variables = { FOO: 'bar' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('This is plain text with no placeholders.');
    });

    it('should handle template with only placeholders', () => {
      const template = '{{A}}{{B}}{{C}}';
      const variables = { A: '1', B: '2', C: '3' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('123');
    });

    it('should handle nested curly braces in content', () => {
      const template = 'Use {{LBRACE}}data{{RBRACE}} here';
      const variables = { LBRACE: '{', RBRACE: '}' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Use {data} here');
    });

    it('should handle special characters in variables', () => {
      const template = '{{CONTENT}}';
      const variables = { CONTENT: 'Line1\nLine2\tTabbed' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Line1\nLine2\tTabbed');
    });
  });

  describe('Mode placeholders', () => {
    it('should replace MODE placeholder', () => {
      const template = 'Mode: {{MODE}}';
      const variables = { MODE: 'readonly' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Mode: readonly');
    });

    it('should replace all mode options', () => {
      const modes = ['readonly', 'suggest', 'edit-with-approval', 'full-agent'];

      for (const mode of modes) {
        const template = '{{MODE}}';
        const variables = { MODE: mode };
        const result = renderTemplate(template, variables);
        expect(result).toBe(mode);
      }
    });
  });

  describe('Agent placeholders', () => {
    it('should replace AGENTS placeholder', () => {
      const template = 'Agents: {{AGENTS}}';
      const variables = { AGENTS: 'claude,codex,generic' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Agents: claude,codex,generic');
    });

    it('should replace AGENTS_JSON placeholder', () => {
      const template = 'Agents JSON: {{AGENTS_JSON}}';
      const variables = { AGENTS_JSON: '["claude","codex","generic"]' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Agents JSON: ["claude","codex","generic"]');
    });
  });

  describe('Git placeholders', () => {
    it('should replace GIT_MODE placeholder', () => {
      const template = 'Git mode: {{GIT_MODE}}';
      const variables = { GIT_MODE: 'auto' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Git mode: auto');
    });

    it('should replace GIT_AVAILABLE placeholder', () => {
      const template = 'Git available: {{GIT_AVAILABLE}}';
      const variables = { GIT_AVAILABLE: true };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Git available: true');
    });
  });

  describe('Provider placeholder', () => {
    it('should replace PROVIDER placeholder', () => {
      const template = 'Provider: {{PROVIDER}}';
      const variables = { PROVIDER: 'anthropic' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Provider: anthropic');
    });
  });

  describe('Date placeholder', () => {
    it('should replace CREATED_AT placeholder', () => {
      const template = 'Created: {{CREATED_AT}}';
      const variables = { CREATED_AT: '2024-01-15T10:30:00.000Z' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Created: 2024-01-15T10:30:00.000Z');
    });
  });

  describe('Version placeholder', () => {
    it('should replace KONTEXTMIND_VERSION placeholder', () => {
      const template = 'Version: {{KONTEXTMIND_VERSION}}';
      const variables = { KONTEXTMIND_VERSION: '0.1.0' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Version: 0.1.0');
    });
  });
});