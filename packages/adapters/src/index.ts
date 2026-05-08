export { generateClaudeInstructions } from './claude.js';
export { generateCodexInstructions } from './codex.js';
export { generateCursorRule } from './cursor.js';
export { generateContinueConfig } from './continue.js';
export { generateCopilotInstructions } from './copilot.js';
export { generateGenericInstructions } from './generic.js';

export interface AdapterResult {
  filename: string;
  content: string;
}

export type AgentAdapter = (projectName: string, mode: string) => AdapterResult;