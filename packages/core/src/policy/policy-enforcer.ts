// Policy enforcement for KontextMind

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export interface PolicyContext {
  mode: string;
  action: string;
  projectRoot: string;
  userId?: string;
  sessionId?: string;
}

// Default chatbot-readonly policy
const CHATBOT_READONLY_POLICY: Record<string, boolean> = {
  read_project_overview: true,
  read_architecture: true,
  read_file_summary: true,
  read_function_summary: true,
  read_knowledge_graph: true,
  read_qa: true,
  read_source_code: false,
  read_raw_source: false,
  read_secrets: false,
  write: false,
  execute: false,
  install: false,
};

// Default readonly policy
const READONLY_POLICY: Record<string, boolean> = {
  read_project_overview: true,
  read_architecture: true,
  read_file_summary: true,
  read_function_summary: true,
  read_knowledge_graph: true,
  read_qa: true,
  read_source_code: true,
  read_raw_source: true,
  read_secrets: false,
  write: false,
  execute: false,
  install: false,
};

// Get policy for mode
function getPolicyForMode(mode: string): Record<string, boolean> {
  switch (mode) {
    case 'chatbot-readonly':
      return CHATBOT_READONLY_POLICY;
    case 'readonly':
      return READONLY_POLICY;
    case 'suggest':
      return READONLY_POLICY;
    case 'edit-with-approval':
      return READONLY_POLICY;
    case 'full-agent':
      return READONLY_POLICY;
    default:
      return READONLY_POLICY;
  }
}

// Apply policy to action
export function applyPolicy(action: string, context: PolicyContext): PolicyResult {
  const policy = getPolicyForMode(context.mode);
  const allowed = policy[action] ?? true;

  if (!allowed) {
    return {
      allowed: false,
      reason: `Action '${action}' is not permitted in ${context.mode} mode`,
    };
  }

  return { allowed: true };
}

// Check if code output is allowed
export function isCodeOutputAllowed(mode: string): boolean {
  return mode !== 'chatbot-readonly';
}

// Check if raw source is allowed
export function isRawSourceAllowed(mode: string): boolean {
  return mode !== 'chatbot-readonly';
}

// Check if secret access is allowed
export function isSecretAccessAllowed(mode: string): boolean {
  return false; // Never allow secret access
}