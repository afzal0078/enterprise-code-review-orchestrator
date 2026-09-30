import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { withRetry, withTimeout } from '../src/utils/error-handler.js';
import { ReportGenerator } from '../src/utils/report-generator.js';
import type { ReviewReport } from '../src/types/report-types.js';

describe('Production Utilities', () => {
  describe('RateLimiter', () => {
    it('acquires and releases tokens', async () => {
      const limiter = new RateLimiter({ maxRequestsPerMinute: 10, maxTokensPerMinute: 10000, maxConcurrent: 2 });
      await limiter.acquire(500);
      limiter.release();
      expect(true).toBe(true);
    });
  });

  describe('ErrorHandler', () => {
    it('retries on transient failure and resolves on success', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) throw new Error('Transient error');
        return 'success';
      });

      const result = await withRetry(fn, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('times out long running operations', async () => {
      const slowFn = () => new Promise((resolve) => setTimeout(resolve, 200));
      await expect(withTimeout(slowFn, 50, 'Operation timed out')).rejects.toThrow('Operation timed out');
    });
  });

  describe('ReportGenerator', () => {
    const mockReport: ReviewReport = {
      pullRequest: { owner: 'test-owner', repo: 'test-repo', number: 1 },
      fileReviews: [],
      summary: {
        totalFiles: 0,
        overallScore: 90,
        criticalIssues: 0,
        highPriorityTests: 0,
        refactoringOpportunities: 0,
      },
      recommendations: [
        {
          priority: 'medium',
          category: 'best-practices',
          description: 'Keep up good code practices',
          files: ['src/example.ts'],
        },
      ],
      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: 1000,
        agentVersions: {
          codeQuality: '1.0.0',
          testCoverage: '1.0.0',
          refactoring: '1.0.0',
        },
      },
    };

    it('generates valid JSON, Markdown, and HTML reports', () => {
      const generator = new ReportGenerator();
      const json = generator.generateJSONReport(mockReport);
      const md = generator.generateMarkdownReport(mockReport);
      const html = generator.generateHTMLReport(mockReport);

      expect(JSON.parse(json).summary.overallScore).toBe(90);
      expect(md).toContain('# 🔍 Code Review Report');
      expect(html).toContain('<!DOCTYPE html>');
    });
  });
});
