/**
 * KontextMind MCP Server
 *
 * Phase 7 implementation provides MCP-compatible tools, resources, and prompts
 */

export {
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  handleToolCall,
  handleResourceCall,
  handlePromptCall,
  getMCPServerStatus,
  setMCPServerStatus,
  MCP_VERSION,
  LOG_FILE,
  type MCPTool,
  type MCPResource,
  type MCPPrompt,
  type MCPMode,
  type MCPServerConfig,
  type MCPServerStatus,
} from './mcp-server.js';

export const PHASE = 7;
