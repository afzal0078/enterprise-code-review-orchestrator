import type { McpServerConfig } from '../types/index.js';

/**
 * Model Context Protocol (MCP) Server Configurations
 * Integrates external capabilities: GitHub API integration and ESLint static analysis.
 */
export const mcpServersConfig: Record<string, McpServerConfig> = {
  /**
   * GitHub MCP Server: Pull request metadata, file tree inspection, and diffs.
   */
  github: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN:
        process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || ''
    }
  },

  /**
   * ESLint MCP Server: Static code analysis, linting issues, and style diagnostics.
   */
  eslint: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  }
};

export const mcpServers = mcpServersConfig;
