import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Specialized Subagent: Refactoring Suggester
 *
 * Scans code files for structural degradation, opportunities for modern idioms
 * (e.g., ES2022+ features), design patterns, dead/unreachable logic, and modularization.
 * Outputs concrete before-and-after transformation suggestions with justified benefits.
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Dedicated architectural and structural refactoring specialist. Analyzes source files ' +
    'for anti-patterns, code duplication, dead code, extract-method candidates, and ' +
    'modernization opportunities. Produces precise before/after refactoring diffs ' +
    'in a structured RefactoringSuggestion payload.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill'
  ]
};
