import { query } from '@anthropic-ai/claude-agent-sdk';
import { mcpServersConfig } from './config/mcp.config.js';
import { agents } from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import type { ReviewReport } from './types/report-types.js';
import { logger } from './utils/logger.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes, formatError } from './utils/error-handler.js';
import { RateLimiter, globalRateLimiter, RateLimiterConfig } from './utils/rate-limiter.js';

export const AGENT_VERSIONS = {
  orchestrator: '1.0.0',
  codeQuality: '1.0.0',
  testCoverage: '1.0.0',
  refactoring: '1.0.0'
} as const;

export interface OrchestratorConfig {

  /** Model identifier; defaults to ANTHROPIC_MODEL environment variable */
  model?: string;
  /** Maximum dialogue turns allowed for multi-agent synthesis (default: 80) */
  maxTurns?: number;
  /** Custom rate limiter instance or partial config */
  rateLimiter?: RateLimiter;
  rateLimitConfig?: Partial<RateLimiterConfig>;
  /** Timeout limit in milliseconds for complete PR review (default: 10 minutes) */
  timeoutMs?: number;
  /** Number of retry attempts on transient network or query errors (default: 2) */
  maxRetries?: number;
}

const DEFAULT_SETTINGS = {
  maxTurns: 80,
  timeoutMs: 10 * 60 * 1000,
  maxRetries: 2,
  estimatedTokens: 25_000
} as const;

/**
 * Enterprise Multi-Agent Code Review Orchestrator
 * Coordinates GitHub PR data retrieval, dispatches specialist subagents,
 * and synthesizes structured multi-perspective review reports.
 */
export class CodeReviewOrchestrator {
  private readonly modelName?: string;
  private readonly maxTurns: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly rateLimiter: RateLimiter;

  constructor(config: OrchestratorConfig = {}) {
    this.modelName = config.model;
    this.maxTurns = config.maxTurns ?? DEFAULT_SETTINGS.maxTurns;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_SETTINGS.timeoutMs;
    this.maxRetries = config.maxRetries ?? DEFAULT_SETTINGS.maxRetries;

    if (config.rateLimiter) {
      this.rateLimiter = config.rateLimiter;
    } else if (config.rateLimitConfig) {
      this.rateLimiter = new RateLimiter(config.rateLimitConfig);
    } else {
      this.rateLimiter = globalRateLimiter;
    }
  }

  /**
   * Performs an end-to-end multi-agent review for a target GitHub pull request.
   *
   * @param owner Repository owner or organization
   * @param repo Repository name
   * @param prNumber Pull request number
   * @returns Validated ReviewReport matching domain schema
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const activeModel = this.modelName || process.env.ANTHROPIC_MODEL;
    if (!activeModel) {
      throw new ReviewError(
        'Missing required model configuration. Please set ANTHROPIC_MODEL.',
        ErrorCodes.INVALID_CONFIG
      );
    }

    const reviewStartTime = Date.now();
    logger.info('Initiating multi-agent code review workflow', {
      owner,
      repo,
      prNumber,
      model: activeModel,
      maxTurns: this.maxTurns
    });

    // Acquire rate limit slot
    await this.rateLimiter.acquire(DEFAULT_SETTINGS.estimatedTokens);

    try {
      // Execute query with retry and timeout wrappers
      const rawStructuredOutput = await withRetry(
        () =>
          withTimeout(
            () => this.dispatchOrchestratorQuery(owner, repo, prNumber, activeModel),
            this.timeoutMs,
            `Code review pipeline timed out for ${owner}/${repo}#${prNumber} after ${this.timeoutMs}ms`
          ),
        this.maxRetries,
        1500
      );

      // Validate output against Zod schema
      const parseResult = ReviewReportSchema.safeParse(rawStructuredOutput);
      if (!parseResult.success) {
        logger.error('Orchestrator structured output failed schema validation', {
          issues: parseResult.error.issues
        });
        throw new ReviewError(
          `Review report validation error: ${parseResult.error.message}`,
          ErrorCodes.STRUCTURED_OUTPUT_FAILED,
          { validationIssues: parseResult.error.issues }
        );
      }

      const totalDuration = Date.now() - reviewStartTime;
      const finalReport = parseResult.data;

      // Update timing and provenance metadata
      finalReport.metadata.duration = totalDuration;
      finalReport.metadata.analyzedAt = new Date().toISOString();
      finalReport.metadata.agentVersions = { ...AGENT_VERSIONS };

      logger.info('Multi-agent code review successfully finished', {
        owner,
        repo,
        prNumber,
        overallScore: finalReport.summary.overallScore,
        filesAnalyzed: finalReport.summary.totalFiles,
        durationMs: totalDuration
      });

      return finalReport;
    } catch (error) {
      logger.error('Multi-agent review workflow encountered an unrecoverable failure', {
        owner,
        repo,
        prNumber,
        error: formatError(error)
      });
      throw error;
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * Internal query invocation leveraging Claude Agent SDK's query function.
   */
  private async dispatchOrchestratorQuery(
    owner: string,
    repo: string,
    prNumber: number,
    model: string
  ): Promise<unknown> {
    const orchestratorPrompt = buildOrchestratorPrompt(owner, repo, prNumber);

    const queryStream = query({
      prompt: orchestratorPrompt,
      options: {
        model,
        maxTurns: this.maxTurns,
        permissionMode: 'default',
        mcpServers: mcpServersConfig,
        agents,
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__get_pull_request',
          'mcp__github__get_pull_request_files',
          'mcp__github__get_file_contents',
          'mcp__eslint__lint-files'
        ],
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema
        }
      }
    });

    let payload: unknown = null;
    let terminationSubtype: string | undefined;

    for await (const event of queryStream) {
      if (event.type === 'result') {
        if (event.subtype === 'success' && event.structured_output) {
          payload = event.structured_output;
        } else if (event.subtype !== 'success') {
          terminationSubtype = event.subtype;
        }
      }

      if (event.type === 'assistant') {
        logger.debug('Orchestrator iteration message', { content: event.message?.content });
      }
    }

    if (!payload) {
      const reason = terminationSubtype
        ? `Agent run completed with failure subtype: ${terminationSubtype}`
        : 'Query completed without emitting structured_output';

      throw new ReviewError(reason, ErrorCodes.AGENT_FAILED, {
        owner,
        repo,
        prNumber,
        terminationSubtype
      });
    }

    return payload;
  }
}