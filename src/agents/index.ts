import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { codeQualityAnalyzer } from './code-quality-analyzer.js';
import { testCoverageAnalyzer } from './test-coverage-analyzer.js';
import { refactoringSuggester } from './refactoring-suggester.js';

export {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
};

/**
 * Map of specialist subagents registered by name for Claude Agent SDK query options.
 */
export const agents: Record<string, AgentDefinition> = {
  'code-quality-analyzer': codeQualityAnalyzer,
  'test-coverage-analyzer': testCoverageAnalyzer,
  'refactoring-suggester': refactoringSuggester
};

/**
 * Array representation of all subagents.
 */
export const agentsList: AgentDefinition[] = Object.values(agents);
