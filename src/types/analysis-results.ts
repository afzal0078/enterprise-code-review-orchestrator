import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Domain schemas and structured output contracts for individual analysis agents.
 * Validates responses produced by specialized code review subagents.
 */

export const CodeQualityIssueSchema = z.object({
  line: z.number().int().nonnegative().describe('Line number where the issue was observed'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.enum([
    'security',
    'performance',
    'maintainability',
    'style',
    'bug-risk',
    'best-practice'
  ]),
  description: z.string().min(1).describe('Concise analysis of the identified problem'),
  suggestion: z.string().min(1).describe('Remediation guidance or code change prescription')
});

export const CodeQualityResultSchema = z.object({
  file: z.string().min(1).describe('Relative path of the analyzed source file'),
  issues: z.array(CodeQualityIssueSchema).default([]),
  overallScore: z.number().min(0).max(100).describe('Calculated code health score between 0 and 100'),
  summary: z.string().describe('Executive summary of code quality findings')
});

export const UntestedPathSchema = z.object({
  type: z.enum(['function', 'class', 'branch', 'edge-case']),
  location: z.string().min(1).describe('Identifier, signature or branch location lacking test coverage'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  reasoning: z.string().min(1).describe('Justification for test requirement based on risk'),
  suggestedTest: z.string().min(1).describe('Concrete unit test case implementation snippet')
});

export const TestCoverageResultSchema = z.object({
  file: z.string().min(1).describe('Relative path of the evaluated file'),
  hasTests: z.boolean().describe('True if related test suites exist in repository'),
  testFiles: z.array(z.string()).default([]).describe('Associated test file paths discovered'),
  untestedPaths: z.array(UntestedPathSchema).default([]),
  coverageEstimate: z.number().min(0).max(100).describe('Estimated coverage percentage (0-100)'),
  summary: z.string().describe('Synthesis of test adequacy and gaps')
});

export const RefactoringItemSchema = z.object({
  type: z.enum([
    'extract-function',
    'rename',
    'modernize',
    'simplify',
    'pattern-improvement'
  ]),
  location: z.string().min(1).describe('Code symbol, line range, or block reference'),
  impact: z.enum(['low', 'medium', 'high']),
  description: z.string().min(1).describe('Explanation of structural or architectural enhancement'),
  before: z.string().describe('Existing code snippet highlighting the anti-pattern'),
  after: z.string().describe('Refactored code snippet demonstrating improved pattern'),
  benefits: z.string().min(1).describe('Concrete maintainability or readability gains')
});

export const RefactoringSuggestionSchema = z.object({
  file: z.string().min(1).describe('Relative path of the target file'),
  suggestions: z.array(RefactoringItemSchema).default([]),
  summary: z.string().describe('High-level overview of refactoring opportunities')
});

// Inferred TypeScript interfaces
export type CodeQualityIssue = z.infer<typeof CodeQualityIssueSchema>;
export type CodeQualityResult = z.infer<typeof CodeQualityResultSchema>;
export type UntestedPath = z.infer<typeof UntestedPathSchema>;
export type TestCoverageResult = z.infer<typeof TestCoverageResultSchema>;
export type RefactoringItem = z.infer<typeof RefactoringItemSchema>;
export type RefactoringSuggestion = z.infer<typeof RefactoringSuggestionSchema>;

type JsonSchemaObject = Record<string, unknown>;

function convertToJsonSchema(zodSchema: z.ZodTypeAny): JsonSchemaObject {
  return (zodToJsonSchema as (schema: unknown, options?: unknown) => unknown)(
    zodSchema,
    { $refStrategy: 'root' }
  ) as JsonSchemaObject;
}

export const CodeQualityResultJSONSchema: JsonSchemaObject = convertToJsonSchema(CodeQualityResultSchema);
export const TestCoverageResultJSONSchema: JsonSchemaObject = convertToJsonSchema(TestCoverageResultSchema);
export const RefactoringSuggestionJSONSchema: JsonSchemaObject = convertToJsonSchema(RefactoringSuggestionSchema);
