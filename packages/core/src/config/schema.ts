import { z } from 'zod';

export const AgentTypeSchema = z.enum(['claude', 'codex', 'roo', 'cursor', 'antigravity', 'continue', 'copilot', 'generic']);
export const ModeSchema = z.enum(['readonly', 'suggest', 'edit-with-approval', 'full-agent']);
export const GitModeSchema = z.enum(['auto', 'enabled', 'disabled']);
export const ProviderSchema = z.enum(['none', 'openai', 'anthropic', 'ollama', 'bedrock', 'openai-compatible']);

export const ProjectConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    root: z.string(),
    created_at: z.string(),
  }),
  mode: ModeSchema,
  agents: z.array(AgentTypeSchema),
  git: z.object({
    enabled: GitModeSchema,
    available: z.boolean(),
    use_for_change_detection: z.boolean(),
  }),
  indexing: z.object({
    respect_toolignore: z.boolean(),
    hash_algorithm: z.string(),
    changed_only: z.boolean(),
    skip_large_files_over_mb: z.number(),
  }),
  chatbot: z.object({
    enabled: z.boolean(),
    raw_code_access: z.boolean(),
    response_policy: z.string(),
  }),
  server: z.object({
    host: z.string(),
    port: z.number(),
  }),
  mcp: z.object({
    enabled: z.boolean(),
    transport: z.string(),
  }),
  phase: z.number().int().min(1).max(10),
});

export const PolicyConfigSchema = z.object({
  mode: ModeSchema,
  allow_tools: z.array(z.string()),
  deny_tools: z.array(z.string()),
  security: z.object({
    raw_code_access: z.boolean(),
    return_source_code: z.boolean(),
    max_code_lines: z.number().int().min(0),
    redact_secrets: z.boolean(),
    treat_project_files_as_untrusted: z.boolean(),
  }),
  logs: z.object({
    enabled: z.boolean(),
    retention_days: z.number().int().min(1).max(365),
    store_full_questions: z.boolean(),
    store_full_answers: z.boolean(),
    store_source_code: z.boolean(),
  }),
});

export const ProvidersConfigSchema = z.object({
  providers: z.record(z.object({
    type: z.string(),
    base_url: z.string().optional(),
    api_key_env: z.string().optional(),
    region: z.string().optional(),
  })),
  selected_provider: ProviderSchema,
});

export const ModelsConfigSchema = z.object({
  summary_model: z.string().nullable(),
  qa_model: z.string().nullable(),
  embedding_model: z.string().nullable(),
  fallback_to_mock: z.boolean(),
});

export const ToolLinkingConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  local_server: z.object({
    enabled: z.boolean(),
    url: z.string(),
  }),
  mcp: z.object({
    enabled: z.boolean(),
    config_path: z.string(),
  }),
  instructions: z.object({
    master: z.string(),
    claude: z.string(),
    agents: z.string(),
    generic: z.string(),
  }),
});

export const RegistryConfigSchema = z.object({
  version: z.string(),
  phase: z.number().int().min(1).max(10),
  created_at: z.string(),
  generated_files: z.array(z.string()),
});

export const SessionConfigSchema = z.object({
  session_id: z.string().nullable(),
  agent: z.string().nullable(),
  mode: ModeSchema,
  user_goal: z.string().nullable(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  phase: z.number().int().min(1).max(10),
  notes: z.string(),
});

export function validateConfig<T>(schema: z.ZodSchema<T>, data: unknown, configName: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid ${configName}: ${errors}`);
  }
  return result.data;
}
