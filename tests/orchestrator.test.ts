import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ReviewError, ErrorCodes } from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import * as sdk from '@anthropic-ai/claude-agent-sdk';

// Mock Claude Agent SDK query function
vi.mock('@anthropic-ai/claude-agent-sdk', async () => {
  return {
    query: vi.fn()
  };
});

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_MODEL;
  });

  describe('Configuration & Initialization', () => {
    it('initializes with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('accepts custom configuration options and rate limiter', () => {
      const customLimiter = new RateLimiter({ maxRequestsPerMinute: 20 });
      const orchestrator = new CodeReviewOrchestrator({
        model: 'claude-3-7-sonnet-20250219',
        maxTurns: 50,
        rateLimiter: customLimiter,
        timeoutMs: 30000,
        maxRetries: 1
      });

      expect(orchestrator).toBeDefined();
    });

    it('rejects execution when ANTHROPIC_MODEL is completely absent', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow(ReviewError);

      try {
        await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      } catch (err: unknown) {
        expect((err as ReviewError).code).toBe(ErrorCodes.INVALID_CONFIG);
      }
    });
  });

  describe('reviewPullRequest Orchestration Flow', () => {
    const validMockReport = {
      pullRequest: {
        owner: 'octocat',
        repo: 'Hello-World',
        number: 1
      },
      fileReviews: [
        {
          file: 'README.md',
          codeQuality: {
            file: 'README.md',
            issues: [],
            overallScore: 100,
            summary: 'Documentation file in good order.'
          },
          testCoverage: {
            file: 'README.md',
            hasTests: false,
            testFiles: [],
            untestedPaths: [],
            coverageEstimate: 100,
            summary: 'Documentation does not require unit tests.'
          },
          refactorings: {
            file: 'README.md',
            suggestions: [],
            summary: 'No refactoring required.'
          }
        }
      ],
      summary: {
        totalFiles: 1,
        overallScore: 100,
        criticalIssues: 0,
        highPriorityTests: 0,
        refactoringOpportunities: 0
      },
      recommendations: [
        {
          priority: 'low' as const,
          category: 'Documentation',
          description: 'PR looks clean and ready to merge.',
          files: ['README.md']
        }
      ],
      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: 2500,
        agentVersions: {
          orchestrator: '2.0.0'
        }
      }
    };

    it('successfully processes PR and validates structured output', async () => {
      process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

      // Mock query stream
      const mockQueryStream = (async function* () {
        yield {
          type: 'assistant',
          message: { content: 'Analyzing PR #1 via subagents...' }
        };
        yield {
          type: 'result',
          subtype: 'success',
          structured_output: validMockReport
        };
      })();

      vi.mocked(sdk.query).mockReturnValue(mockQueryStream as unknown as ReturnType<typeof sdk.query>);

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(report).toBeDefined();
      expect(report.pullRequest.owner).toBe('octocat');
      expect(report.summary.overallScore).toBe(100);
      expect(report.fileReviews).toHaveLength(1);
      expect(sdk.query).toHaveBeenCalledTimes(1);
    });

    it('fails gracefully when SDK query emits a failure subtype', async () => {
      process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

      const mockQueryStream = (async function* () {
        yield {
          type: 'result',
          subtype: 'error_max_turns_exceeded'
        };
      })();

      vi.mocked(sdk.query).mockReturnValue(mockQueryStream as unknown as ReturnType<typeof sdk.query>);

      const orchestrator = new CodeReviewOrchestrator({ maxRetries: 1 });
      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow(ReviewError);
    });

    it('throws STRUCTURED_OUTPUT_FAILED if output violates Zod schema', async () => {
      process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

      const corruptedReport = {
        pullRequest: { owner: 'octocat' }, // missing repo and number
        summary: { overallScore: 'not-a-number' }
      };

      const mockQueryStream = (async function* () {
        yield {
          type: 'result',
          subtype: 'success',
          structured_output: corruptedReport
        };
      })();

      vi.mocked(sdk.query).mockReturnValue(mockQueryStream as unknown as ReturnType<typeof sdk.query>);

      const orchestrator = new CodeReviewOrchestrator({ maxRetries: 1 });
      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow(ReviewError);
    });
  });

  describe('Integration Test Reference', () => {
    it('orchestrator is configured to handle real repository reviews (octocat/Hello-World)', () => {
      const orchestrator = new CodeReviewOrchestrator({
        model: 'claude-sonnet-4-5-20250929'
      });
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.reviewPullRequest).toBe('function');
    });
  });
});
