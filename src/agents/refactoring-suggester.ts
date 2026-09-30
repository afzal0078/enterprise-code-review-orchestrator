import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Identifies refactoring opportunities in ONE changed file at a time --
 * design pattern candidates, modernization, extract-function candidates,
 * and dead code -- returning a single RefactoringSuggestion JSON object
 * for that file.
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies refactoring opportunities in a single changed file -- ' +
    'design pattern candidates, modernization opportunities, extract-' +
    'function candidates, and dead code -- returning a ' +
    'RefactoringSuggestion JSON object for that file. Use this agent ' +
    'whenever a file needs a structural/code-cleanliness review.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};
