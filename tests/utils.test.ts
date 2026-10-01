import { describe, it, expect, vi } from 'vitest';
import { withRetry, withTimeout, ReviewError, ErrorCodes, formatError } from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { ReportGenerator } from '../src/utils/report-generator.js';
import type { ReviewReport } from '../src/types/report-types.js';

describe('Production Engineering Utilities', () => {
  describe('Error Handling and Resiliency (error-handler.ts)', () => {
    it('executes without retry when task succeeds immediately', async () => {
      const mockAction = vi.fn(async () => 'instant-success');
      const outcome = await withRetry(mockAction, 3, 50);

      expect(outcome).toBe('instant-success');
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('retries on intermediate failures and succeeds once resolved', async () => {
      let callCount = 0;
      const transientTask = vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error(`Temporary network glitch attempt #${callCount}`);
        }
        return 'recovered-data';
      });

      const outcome = await withRetry(transientTask, 4, 20);
      expect(outcome).toBe('recovered-data');
      expect(callCount).toBe(3);
    });

    it('throws ReviewError with RETRY_EXHAUSTED when all retries fail', async () => {
      const constantlyFailing = vi.fn(async () => {
        throw new Error('Persistent backend outage');
      });

      await expect(withRetry(constantlyFailing, 3, 10)).rejects.toThrow(ReviewError);

      try {
        await withRetry(constantlyFailing, 2, 10);
      } catch (err: unknown) {
        expect((err as ReviewError).code).toBe(ErrorCodes.RETRY_EXHAUSTED);
        expect((err as ReviewError).details?.attempts).toBe(2);
      }
    });

    it('enforces execution deadlines via withTimeout', async () => {
      const fastTask = () => new Promise<string>((res) => setTimeout(() => res('done in time'), 20));
      const result = await withTimeout(fastTask, 200);
      expect(result).toBe('done in time');

      const slowTask = () => new Promise<string>((res) => setTimeout(() => res('too late'), 150));
      await expect(withTimeout(slowTask, 40, 'Custom timeout breached')).rejects.toThrow(
        'Custom timeout breached'
      );
    });

    it('formats errors accurately including ReviewError metadata', () => {
      const standardError = new Error('Regular failure');
      expect(formatError(standardError)).toBe('Error: Regular failure');

      const reviewError = new ReviewError('Token missing', ErrorCodes.MISSING_GITHUB_TOKEN, {
        provider: 'github'
      });
      const formatted = formatError(reviewError);
      expect(formatted).toContain('[MISSING_GITHUB_TOKEN] Token missing');
      expect(formatted).toContain('provider');
    });
  });

  describe('Sliding Window Rate Limiter (rate-limiter.ts)', () => {
    it('initializes with default and custom constraints', () => {
      const defaultLimiter = new RateLimiter();
      const status = defaultLimiter.getStatus();
      expect(status.activeRequests).toBe(0);
      expect(status.availableRequests).toBe(50);

      const customLimiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 20_000,
        maxConcurrent: 2
      });
      const customStatus = customLimiter.getStatus();
      expect(customStatus.availableRequests).toBe(10);
    });

    it('tracks acquire and release concurrency states', async () => {
      const limiter = new RateLimiter({ maxConcurrent: 2 });
      await limiter.acquire(500);
      expect(limiter.getStatus().activeRequests).toBe(1);

      await limiter.acquire(500);
      expect(limiter.getStatus().activeRequests).toBe(2);

      limiter.release();
      expect(limiter.getStatus().activeRequests).toBe(1);

      limiter.release();
      expect(limiter.getStatus().activeRequests).toBe(0);
    });

    it('properly prunes old request timestamps outside the rolling window', async () => {
      const limiter = new RateLimiter();
      await limiter.acquire(100);
      limiter.release();

      expect(limiter.getStatus().requestsInWindow).toBe(1);

      // Mutate historical entry timestamp to simulate time passage
      (limiter as unknown as { requestHistory: Array<{ timestamp: number; tokens: number }> }).requestHistory[0].timestamp =
        Date.now() - 65_000;

      limiter.pruneOldRecords();
      expect(limiter.getStatus().requestsInWindow).toBe(0);
    });

    it('evaluates canProceed under various limits', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 2,
        maxTokensPerMinute: 5000,
        maxConcurrent: 2
      });

      expect(limiter.canProceed(1000)).toBe(true);

      await limiter.acquire(1000);
      expect(limiter.canProceed(1000)).toBe(true);

      await limiter.acquire(1000);
      // Reached maxRequestsPerMinute (2)
      expect(limiter.canProceed(500)).toBe(false);

      limiter.release();
      limiter.release();
    });
  });

  describe('Report Generator (report-generator.ts)', () => {
    const sampleReport: ReviewReport = {
      pullRequest: {
        owner: 'danielguerra1',
        repo: 'simple-todo-app',
        number: 2
      },
      fileReviews: [
        {
          file: 'src/search.js',
          codeQuality: {
            file: 'src/search.js',
            issues: [
              {
                line: 78,
                severity: 'critical',
                category: 'security',
                description: 'Cross-Site Scripting (XSS) in highlight interpolation',
                suggestion: 'Sanitize query term and title before injecting HTML mark tags'
              }
            ],
            overallScore: 68,
            summary: 'XSS vulnerability identified along with legacy variable declarations.'
          },
          testCoverage: {
            file: 'src/search.js',
            hasTests: false,
            testFiles: [],
            untestedPaths: [
              {
                type: 'function',
                location: 'searchTodos',
                priority: 'critical',
                reasoning: 'Primary search entry point lacks any unit test validation',
                suggestedTest: "test('searchTodos filters terms', () => { ... });"
              }
            ],
            coverageEstimate: 0,
            summary: 'Search module has zero automated test coverage.'
          },
          refactorings: {
            file: 'src/search.js',
            suggestions: [
              {
                type: 'modernize',
                location: 'Lines 5-45',
                impact: 'high',
                description: 'Upgrade var keywords to const/let and replace manual loops',
                before: 'var all = listTodos();',
                after: 'const all = listTodos();',
                benefits: 'Prevents variable hoisting and aligns with modern standard'
              }
            ],
            summary: 'Significant modernization needed to convert ES5 style to ES2022.'
          }
        }
      ],
      summary: {
        totalFiles: 1,
        overallScore: 68,
        criticalIssues: 1,
        highPriorityTests: 1,
        refactoringOpportunities: 1
      },
      recommendations: [
        {
          priority: 'critical',
          category: 'Security',
          description: 'Remediate XSS risk in HTML highlight renderer immediately',
          files: ['src/search.js']
        }
      ],
      metadata: {
        analyzedAt: '2026-10-01T12:00:00.000Z',
        duration: 4200,
        agentVersions: {
          orchestrator: '2.0.0'
        }
      }
    };

    it('creates formatted Markdown report with summary table and file breakdowns', () => {
      const generator = new ReportGenerator();
      const markdown = generator.generateMarkdownReport(sampleReport);

      expect(markdown).toContain('# 🔍 Code Review Report');
      expect(markdown).toContain('| **Overall Score** | 68/100 |');
      expect(markdown).toContain('Cross-Site Scripting (XSS)');
      expect(markdown).toContain('`src/search.js`');
      expect(markdown).toContain('🚨 **Security**');
    });

    it('generates compliant HTML report with CSS and score displays', () => {
      const generator = new ReportGenerator();
      const html = generator.generateHTMLReport(sampleReport);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<div class="metric-value">68</div>');
      expect(html).toContain('rec-critical');
      expect(html).toContain('Remediate XSS risk');
    });

    it('generates valid JSON report parsing back into schema', () => {
      const generator = new ReportGenerator();
      const json = generator.generateJSONReport(sampleReport);
      const parsed = JSON.parse(json);

      expect(parsed.summary.overallScore).toBe(68);
      expect(parsed.pullRequest.repo).toBe('simple-todo-app');
      expect(parsed.fileReviews).toHaveLength(1);
    });
  });
});
