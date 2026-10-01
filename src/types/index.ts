/**
 * Centralized Type and Schema Exports
 * Multi-Agent Code Review Orchestrator
 */

export * from './analysis-results.js';
export * from './report-types.js';

// Configuration helper types for MCP server integration
export interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}
