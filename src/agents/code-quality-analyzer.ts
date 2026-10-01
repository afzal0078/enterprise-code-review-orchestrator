import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Specialized Subagent: Code Quality Analyzer
 *
 * Evaluates individual code files for security vulnerabilities, memory/computational
 * bottlenecks, architectural anti-patterns, and coding standard violations.
 * Integrates Claude Skills for domain expertise and static analysis tools.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Dedicated security and code health auditor. Performs static deep-dive analysis ' +
    'on target source files to detect OWASP vulnerabilities, security risks, memory/runtime ' +
    'bottlenecks, style non-conformities, and reliability defects. Employs security and ' +
    'language skills to return structured CodeQualityResult payloads.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill',
    'mcp__eslint__lint-files'
  ]
};
