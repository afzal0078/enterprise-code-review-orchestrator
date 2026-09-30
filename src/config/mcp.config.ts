import { McpServerConfig } from '../types/index.js';

/**
 * MCP Server configurations for the multi-agent code review system.
 * Connects the Orchestrator and Subagents to external toolsets.
 */
export const mcpServersConfig: Record<string, McpServerConfig> = {
  /**
   * GitHub MCP Server
   * Facilitates PR metadata retrieval and source file inspections.
   */
  github: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || ''
    }
  },

  /**
   * ESLint MCP Server
   * Performs static analysis and code quality checks.
   */
  eslint: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  }
};

export const mcpServers = mcpServersConfig;
