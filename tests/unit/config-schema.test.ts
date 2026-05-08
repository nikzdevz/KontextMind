import { describe, it, expect } from 'vitest';
import {
  ProjectConfigSchema,
  PolicyConfigSchema,
  ProvidersConfigSchema,
  ModelsConfigSchema,
  validateConfig,
  AgentTypeSchema,
  ModeSchema,
  GitModeSchema,
  ProviderSchema,
} from '../../packages/core/src/config/schema.js';

describe('Config Schema Validation', () => {
  describe('AgentTypeSchema', () => {
    it('should accept valid agent types', () => {
      const validAgents = ['claude', 'codex', 'cursor', 'continue', 'copilot', 'generic'];

      for (const agent of validAgents) {
        const result = AgentTypeSchema.safeParse(agent);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid agent types', () => {
      const invalidAgents = ['gpt4', 'llama', 'invalid', ''];

      for (const agent of invalidAgents) {
        const result = AgentTypeSchema.safeParse(agent);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('ModeSchema', () => {
    it('should accept valid modes', () => {
      const validModes = ['readonly', 'suggest', 'edit-with-approval', 'full-agent'];

      for (const mode of validModes) {
        const result = ModeSchema.safeParse(mode);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid modes', () => {
      const invalidModes = ['read', 'write', 'admin', 'strict', ''];

      for (const mode of invalidModes) {
        const result = ModeSchema.safeParse(mode);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('GitModeSchema', () => {
    it('should accept valid git modes', () => {
      const validModes = ['auto', 'enabled', 'disabled'];

      for (const mode of validModes) {
        const result = GitModeSchema.safeParse(mode);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid git modes', () => {
      const invalidModes = ['true', 'false', 'manual', ''];

      for (const mode of invalidModes) {
        const result = GitModeSchema.safeParse(mode);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('ProviderSchema', () => {
    it('should accept valid providers', () => {
      const validProviders = ['none', 'openai', 'anthropic', 'ollama', 'bedrock', 'openai-compatible'];

      for (const provider of validProviders) {
        const result = ProviderSchema.safeParse(provider);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid providers', () => {
      const invalidProviders = ['google', 'azure', 'local', ''];

      for (const provider of invalidProviders) {
        const result = ProviderSchema.safeParse(provider);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('ProjectConfigSchema', () => {
    it('should accept valid project config', () => {
      const config = {
        project: {
          name: 'test-project',
          root: '.',
          created_at: '2024-01-15T10:30:00.000Z',
        },
        mode: 'readonly',
        agents: ['claude', 'codex'],
        git: {
          enabled: 'auto',
          available: true,
          use_for_change_detection: true,
        },
        indexing: {
          respect_toolignore: true,
          hash_algorithm: 'sha256',
          changed_only: true,
          skip_large_files_over_mb: 2,
        },
        chatbot: {
          enabled: true,
          raw_code_access: false,
          response_policy: 'no-code',
        },
        server: {
          host: '127.0.0.1',
          port: 7331,
        },
        mcp: {
          enabled: true,
          transport: 'stdio',
        },
        phase: 1,
      };

      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid mode', () => {
      const config = {
        project: { name: 'test', root: '.', created_at: '2024-01-15T10:30:00.000Z' },
        mode: 'invalid-mode',
        agents: ['claude'],
        git: { enabled: 'auto', available: true, use_for_change_detection: true },
        indexing: { respect_toolignore: true, hash_algorithm: 'sha256', changed_only: true, skip_large_files_over_mb: 2 },
        chatbot: { enabled: true, raw_code_access: false, response_policy: 'no-code' },
        server: { host: '127.0.0.1', port: 7331 },
        mcp: { enabled: true, transport: 'stdio' },
        phase: 1,
      };

      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept git auto/enabled/disabled', () => {
      const modes = ['auto', 'enabled', 'disabled'];

      for (const mode of modes) {
        const config = {
          project: { name: 'test', root: '.', created_at: '2024-01-15T10:30:00.000Z' },
          mode: 'readonly',
          agents: ['claude'],
          git: { enabled: mode, available: true, use_for_change_detection: true },
          indexing: { respect_toolignore: true, hash_algorithm: 'sha256', changed_only: true, skip_large_files_over_mb: 2 },
          chatbot: { enabled: true, raw_code_access: false, response_policy: 'no-code' },
          server: { host: '127.0.0.1', port: 7331 },
          mcp: { enabled: true, transport: 'stdio' },
          phase: 1,
        };

        const result = ProjectConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid phase', () => {
      const config = {
        project: { name: 'test', root: '.', created_at: '2024-01-15T10:30:00.000Z' },
        mode: 'readonly',
        agents: ['claude'],
        git: { enabled: 'auto', available: true, use_for_change_detection: true },
        indexing: { respect_toolignore: true, hash_algorithm: 'sha256', changed_only: true, skip_large_files_over_mb: 2 },
        chatbot: { enabled: true, raw_code_access: false, response_policy: 'no-code' },
        server: { host: '127.0.0.1', port: 7331 },
        mcp: { enabled: true, transport: 'stdio' },
        phase: 15,
      };

      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('PolicyConfigSchema', () => {
    it('should accept valid policy config', () => {
      const policy = {
        mode: 'readonly',
        allow_tools: ['project.status', 'project.search'],
        deny_tools: ['project.write_file'],
        security: {
          raw_code_access: false,
          return_source_code: false,
          max_code_lines: 0,
          redact_secrets: true,
          treat_project_files_as_untrusted: true,
        },
        logs: {
          enabled: true,
          retention_days: 30,
          store_full_questions: false,
          store_full_answers: false,
          store_source_code: false,
        },
      };

      const result = PolicyConfigSchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('should reject invalid retention_days', () => {
      const policy = {
        mode: 'readonly',
        allow_tools: [],
        deny_tools: [],
        security: {
          raw_code_access: false,
          return_source_code: false,
          max_code_lines: 0,
          redact_secrets: true,
          treat_project_files_as_untrusted: true,
        },
        logs: {
          enabled: true,
          retention_days: 500,
          store_full_questions: false,
          store_full_answers: false,
          store_source_code: false,
        },
      };

      const result = PolicyConfigSchema.safeParse(policy);
      expect(result.success).toBe(false);
    });
  });

  describe('ProvidersConfigSchema', () => {
    it('should accept valid providers config', () => {
      const config = {
        providers: {
          none: { type: 'none' },
          openai: { type: 'openai', api_key_env: 'OPENAI_API_KEY' },
          anthropic: { type: 'anthropic', api_key_env: 'ANTHROPIC_API_KEY' },
        },
        selected_provider: 'anthropic',
      };

      const result = ProvidersConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('ModelsConfigSchema', () => {
    it('should accept valid models config', () => {
      const config = {
        summary_model: null,
        qa_model: 'gpt-4',
        embedding_model: null,
        fallback_to_mock: true,
      };

      const result = ModelsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('validateConfig helper', () => {
    it('should return validated config on success', () => {
      const config = {
        summary_model: null,
        qa_model: null,
        embedding_model: null,
        fallback_to_mock: true,
      };

      const result = validateConfig(ModelsConfigSchema, config, 'models');
      expect(result).toEqual(config);
    });

    it('should throw on invalid config', () => {
      const invalidConfig = { invalid: 'data' };

      expect(() => {
        validateConfig(ModelsConfigSchema, invalidConfig, 'models');
      }).toThrow('Invalid models');
    });
  });
});