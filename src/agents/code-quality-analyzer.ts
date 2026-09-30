import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Analyzes ONE changed source file at a time for security vulnerabilities,
 * performance issues, and maintainability concerns, returning a single
 * CodeQualityResult JSON object for that file.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes a single changed source file for security vulnerabilities, ' +
    'performance problems, and maintainability issues, returning a ' +
    'CodeQualityResult JSON object for that file. Use this agent whenever ' +
    'a file needs a security/performance/code-health review.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__eslint__lint-files'],
};
