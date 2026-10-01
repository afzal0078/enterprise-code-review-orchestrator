import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema
} from './analysis-results.js';

/**
 * Unified pull request review report schema.
 * Aggregates evaluations from all analysis subagents into a structured contract.
 */

export const PullRequestRefSchema = z.object({
  owner: z.string().min(1).describe('Repository organization or username'),
  repo: z.string().min(1).describe('Repository identifier'),
  number: z.number().int().positive().describe('Pull request ordinal index')
});

export const FileReviewRecordSchema = z.object({
  file: z.string().min(1).describe('Target file path reviewed'),
  codeQuality: CodeQualityResultSchema,
  testCoverage: TestCoverageResultSchema,
  refactorings: RefactoringSuggestionSchema
});

export const ReportSummarySchema = z.object({
  totalFiles: z.number().int().nonnegative().describe('Count of files analyzed'),
  overallScore: z.number().min(0).max(100).describe('Weighted overall repository health rating'),
  criticalIssues: z.number().int().nonnegative().describe('Total critical security or bug risks flagged'),
  highPriorityTests: z.number().int().nonnegative().describe('Count of high/critical untested paths requiring test suites'),
  refactoringOpportunities: z.number().int().nonnegative().describe('Number of structural improvement recommendations')
});

export const ActionableRecommendationSchema = z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string().min(1).describe('Domain of recommendation (e.g. Security, Testing, Architecture)'),
  description: z.string().min(1).describe('Clear, actionable change description'),
  files: z.array(z.string()).describe('Associated files impacted by this action item')
});

export const ReviewMetadataSchema = z.object({
  analyzedAt: z.string().describe('ISO 8601 timestamp representing time of review execution'),
  duration: z.number().nonnegative().describe('Execution duration in milliseconds'),
  agentVersions: z.record(z.string()).describe('Versions of orchestrator and agent analyzers applied')
});

export const ReviewReportSchema = z.object({
  pullRequest: PullRequestRefSchema,
  fileReviews: z.array(FileReviewRecordSchema).default([]),
  summary: ReportSummarySchema,
  recommendations: z.array(ActionableRecommendationSchema).default([]),
  metadata: ReviewMetadataSchema
});

export type PullRequestRef = z.infer<typeof PullRequestRefSchema>;
export type FileReviewRecord = z.infer<typeof FileReviewRecordSchema>;
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type ActionableRecommendation = z.infer<typeof ActionableRecommendationSchema>;
export type ReviewMetadata = z.infer<typeof ReviewMetadataSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

type JsonSchemaContract = Record<string, unknown>;

export const ReviewReportJSONSchema: JsonSchemaContract = (
  zodToJsonSchema as (schema: unknown, options?: unknown) => unknown
)(ReviewReportSchema, { $refStrategy: 'root' }) as JsonSchemaContract;
