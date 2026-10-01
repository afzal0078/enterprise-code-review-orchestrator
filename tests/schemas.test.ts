import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema
} from '../src/types/analysis-results.js';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema
} from '../src/types/report-types.js';

describe('Zod Schemas and Structured Output Contracts', () => {
  describe('CodeQualityResultSchema', () => {
    it('accepts valid code quality evaluation data', () => {
      const validData = {
        file: 'src/utils/calc.ts',
        issues: [
          {
            line: 14,
            severity: 'critical' as const,
            category: 'security' as const,
            description: 'Direct SQL concatenation vulnerability detected',
            suggestion: 'Use parameterized query placeholders'
          },
          {
            line: 42,
            severity: 'medium' as const,
            category: 'performance' as const,
            description: 'O(n^2) nested loop array search',
            suggestion: 'Convert lookup collection to Set for O(1) membership'
          }
        ],
        overallScore: 85,
        summary: 'Identified critical security concern and moderate performance bottleneck.'
      };

      const result = CodeQualityResultSchema.parse(validData);
      expect(result.file).toBe('src/utils/calc.ts');
      expect(result.issues).toHaveLength(2);
      expect(result.overallScore).toBe(85);
    });

    it('handles clean files with zero issues and boundary scores', () => {
      const cleanData = {
        file: 'src/clean.ts',
        issues: [],
        overallScore: 100,
        summary: 'Clean implementation conforming to all standards.'
      };

      const parsed = CodeQualityResultSchema.parse(cleanData);
      expect(parsed.overallScore).toBe(100);
      expect(parsed.issues).toEqual([]);

      const minScoreData = {
        ...cleanData,
        overallScore: 0
      };
      expect(CodeQualityResultSchema.parse(minScoreData).overallScore).toBe(0);
    });

    it('rejects invalid severity and category enums', () => {
      const invalidData = {
        file: 'src/bad.ts',
        issues: [
          {
            line: 5,
            severity: 'catastrophic', // Invalid enum
            category: 'security',
            description: 'Something bad',
            suggestion: 'Fix it'
          }
        ],
        overallScore: 50,
        summary: 'Test'
      };

      expect(() => CodeQualityResultSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('rejects scores exceeding bounds (<0 or >100)', () => {
      const overScore = {
        file: 'src/score.ts',
        issues: [],
        overallScore: 105,
        summary: 'Too high'
      };
      expect(() => CodeQualityResultSchema.parse(overScore)).toThrow(ZodError);

      const underScore = {
        file: 'src/score.ts',
        issues: [],
        overallScore: -5,
        summary: 'Too low'
      };
      expect(() => CodeQualityResultSchema.parse(underScore)).toThrow(ZodError);
    });

    it('rejects negative line numbers', () => {
      const negativeLine = {
        file: 'src/line.ts',
        issues: [
          {
            line: -1,
            severity: 'low',
            category: 'style',
            description: 'Negative line test',
            suggestion: 'Line should be >= 0'
          }
        ],
        overallScore: 90,
        summary: 'Test'
      };
      expect(() => CodeQualityResultSchema.parse(negativeLine)).toThrow(ZodError);
    });
  });

  describe('TestCoverageResultSchema', () => {
    it('accepts comprehensive test coverage report', () => {
      const validData = {
        file: 'src/services/billing.ts',
        hasTests: true,
        testFiles: ['tests/services/billing.test.ts'],
        untestedPaths: [
          {
            type: 'branch' as const,
            location: 'processSubscription: line 48',
            priority: 'critical' as const,
            reasoning: 'Handles card charge failures without fallback',
            suggestedTest: "it('handles failed charge correctly', async () => { ... });"
          }
        ],
        coverageEstimate: 72,
        summary: 'Core workflow covered; edge cases around failed renewals are missing.'
      };

      const result = TestCoverageResultSchema.parse(validData);
      expect(result.hasTests).toBe(true);
      expect(result.coverageEstimate).toBe(72);
      expect(result.untestedPaths[0].priority).toBe('critical');
    });

    it('rejects invalid untested path priority', () => {
      const invalidPriority = {
        file: 'src/test.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [
          {
            type: 'function',
            location: 'execute',
            priority: 'urgent', // Invalid enum
            reasoning: 'Missing',
            suggestedTest: 'test()'
          }
        ],
        coverageEstimate: 0,
        summary: 'No tests'
      };

      expect(() => TestCoverageResultSchema.parse(invalidPriority)).toThrow(ZodError);
    });
  });

  describe('RefactoringSuggestionSchema', () => {
    it('validates structural refactoring recommendations', () => {
      const validData = {
        file: 'src/legacy.js',
        suggestions: [
          {
            type: 'modernize' as const,
            location: 'searchTodos: lines 8-40',
            impact: 'medium' as const,
            description: 'Replace legacy var declarations and manual loops with Array.filter',
            before: 'var results = []; for(var i=0; i<all.length; i++) { ... }',
            after: 'const results = all.filter(todo => ...);',
            benefits: 'Eliminates variable hoisting and drastically simplifies readability'
          }
        ],
        summary: 'Legacy ES5 constructs should be upgraded to idiomatic ES2022.'
      };

      const parsed = RefactoringSuggestionSchema.parse(validData);
      expect(parsed.suggestions).toHaveLength(1);
      expect(parsed.suggestions[0].type).toBe('modernize');
    });

    it('rejects suggestions with missing code diffs', () => {
      const missingSnippet = {
        file: 'src/mod.ts',
        suggestions: [
          {
            type: 'simplify',
            location: 'format()',
            impact: 'low',
            description: 'Simplify format',
            // missing before and after
            benefits: 'Cleaner code'
          }
        ],
        summary: 'Incomplete'
      };

      expect(() => RefactoringSuggestionSchema.parse(missingSnippet)).toThrow(ZodError);
    });
  });

  describe('ReviewReportSchema', () => {
    it('validates a complete, multi-file ReviewReport', () => {
      const fullReport = {
        pullRequest: {
          owner: 'danielguerra1',
          repo: 'simple-todo-app',
          number: 1
        },
        fileReviews: [
          {
            file: 'src/utils/priority.js',
            codeQuality: {
              file: 'src/utils/priority.js',
              issues: [],
              overallScore: 98,
              summary: 'Clean functional design, typed with JSDoc, frozen constants.'
            },
            testCoverage: {
              file: 'src/utils/priority.js',
              hasTests: true,
              testFiles: ['src/utils/priority.test.js'],
              untestedPaths: [],
              coverageEstimate: 96,
              summary: 'Extensive test coverage matching all exported functions and edge cases.'
            },
            refactorings: {
              file: 'src/utils/priority.js',
              suggestions: [],
              summary: 'No significant refactoring needed.'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 98,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [
          {
            priority: 'low' as const,
            category: 'Testing',
            description: 'Maintain high test standards in downstream PRs.',
            files: ['src/utils/priority.js']
          }
        ],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 3500,
          agentVersions: {
            orchestrator: '2.0.0',
            codeQuality: '1.5.0',
            testCoverage: '1.4.0',
            refactoring: '1.2.0'
          }
        }
      };

      const validated = ReviewReportSchema.parse(fullReport);
      expect(validated.pullRequest.owner).toBe('danielguerra1');
      expect(validated.summary.overallScore).toBe(98);
      expect(validated.fileReviews[0].codeQuality.overallScore).toBe(98);
    });

    it('rejects reports with non-positive PR numbers', () => {
      const badPrReport = {
        pullRequest: {
          owner: 'test',
          repo: 'test',
          number: -1
        },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 100,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 100,
          agentVersions: {}
        }
      };

      expect(() => ReviewReportSchema.parse(badPrReport)).toThrow(ZodError);
    });
  });

  describe('JSON Schema Exports for Claude Agent SDK', () => {
    it('exports root-level object JSON schemas', () => {
      expect(CodeQualityResultJSONSchema.type).toBe('object');
      expect(TestCoverageResultJSONSchema.type).toBe('object');
      expect(RefactoringSuggestionJSONSchema.type).toBe('object');
      expect(ReviewReportJSONSchema.type).toBe('object');
    });

    it('ensures ReviewReport JSON Schema defines essential properties', () => {
      const schema = ReviewReportJSONSchema as {
        properties?: Record<string, unknown>;
        required?: string[];
      };

      expect(schema.properties).toBeDefined();
      expect(schema.properties).toHaveProperty('pullRequest');
      expect(schema.properties).toHaveProperty('fileReviews');
      expect(schema.properties).toHaveProperty('summary');
      expect(schema.properties).toHaveProperty('recommendations');
      expect(schema.properties).toHaveProperty('metadata');
      expect(schema.required).toContain('pullRequest');
    });
  });
});
