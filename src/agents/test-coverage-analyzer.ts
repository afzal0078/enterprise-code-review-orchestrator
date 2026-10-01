import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Specialized Subagent: Test Coverage Analyzer
 *
 * Inspects source code to discover untested execution paths, complex branching logic,
 * and boundary edge cases. Cross-references repository test suites to produce actionable,
 * concrete unit test snippets with assertions.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Dedicated test verification and coverage auditor. Evaluates source files against ' +
    'existing repository test suites, identifies untested public functions, branches, ' +
    'and critical paths, and formulates high-value test specifications with working code ' +
    'assertions in a structured TestCoverageResult payload.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill'
  ]
};
