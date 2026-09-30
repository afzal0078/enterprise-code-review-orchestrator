import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Evaluates test completeness for ONE changed file at a time: finds
 * untested functions/methods/branches and suggests specific test cases,
 * returning a single TestCoverageResult JSON object for that file.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Evaluates test completeness for a single changed file: finds ' +
    'untested functions/methods/branches and suggests specific test cases ' +
    'with meaningful assertions, returning a TestCoverageResult JSON ' +
    'object for that file. Use this agent whenever a file needs a test ' +
    'coverage assessment.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};
