/**
 * Sliding Window Token & Concurrency Rate Limiter
 * Ensures outbound requests to Anthropic / Bedrock APIs remain within configured
 * requests-per-minute (RPM), tokens-per-minute (TPM), and concurrent worker limits.
 */

export interface RateLimiterConfig {
  /** Maximum number of API requests permitted in any rolling 60-second window */
  maxRequestsPerMinute: number;
  /** Maximum cumulative tokens permitted in any rolling 60-second window */
  maxTokensPerMinute: number;
  /** Maximum concurrent in-flight requests permitted */
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,
  maxTokensPerMinute: 100_000,
  maxConcurrent: 4
};

interface RequestUsageEntry {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly windowDurationMs: number = 60_000;
  private requestHistory: RequestUsageEntry[] = [];
  private activeInFlight: number = 0;
  private pendingQueue: Array<() => void> = [];

  constructor(options: Partial<RateLimiterConfig> = {}) {
    this.config = {
      maxRequestsPerMinute: options.maxRequestsPerMinute ?? DEFAULT_RATE_LIMITS.maxRequestsPerMinute,
      maxTokensPerMinute: options.maxTokensPerMinute ?? DEFAULT_RATE_LIMITS.maxTokensPerMinute,
      maxConcurrent: options.maxConcurrent ?? DEFAULT_RATE_LIMITS.maxConcurrent
    };
  }

  /**
   * Requests admission for a new API invocation, blocking asynchronously
   * until concurrency slots and window capacities become available.
   *
   * @param estimatedTokens Projected token footprint for this request
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    await this.waitForSlot();
    await this.waitForRateLimit(estimatedTokens);

    this.activeInFlight += 1;
    this.requestHistory.push({
      timestamp: Date.now(),
      tokens: Math.max(1, estimatedTokens)
    });
  }

  /**
   * Releases an active concurrency slot, adjusting history if actual tokens are known.
   * Dispatches the next waiting caller in queue if present.
   *
   * @param actualTokens Actual token consumption recorded by LLM provider
   */
  release(actualTokens?: number): void {
    if (this.activeInFlight > 0) {
      this.activeInFlight -= 1;
    }

    if (actualTokens !== undefined && this.requestHistory.length > 0) {
      const latestEntry = this.requestHistory[this.requestHistory.length - 1];
      if (latestEntry) {
        latestEntry.tokens = Math.max(1, actualTokens);
      }
    }

    const nextCaller = this.pendingQueue.shift();
    if (nextCaller) {
      nextCaller();
    }
  }

  /**
   * Assesses whether an immediate invocation is feasible given current load.
   */
  canProceed(estimatedTokens: number = 1000): boolean {
    this.pruneOldRecords();

    if (this.activeInFlight >= this.config.maxConcurrent) {
      return false;
    }

    if (this.requestHistory.length >= this.config.maxRequestsPerMinute) {
      return false;
    }

    const currentTokenSum = this.requestHistory.reduce((acc, entry) => acc + entry.tokens, 0);
    if (currentTokenSum + estimatedTokens > this.config.maxTokensPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Discards expired usage records beyond the rolling 60-second horizon.
   */
  public pruneOldRecords(): void {
    const boundary = Date.now() - this.windowDurationMs;
    this.requestHistory = this.requestHistory.filter((entry) => entry.timestamp > boundary);
  }

  /**
   * Suspends execution until an active concurrency slot is freed via release().
   */
  private async waitForSlot(): Promise<void> {
    if (this.activeInFlight < this.config.maxConcurrent) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.pendingQueue.push(resolve);
    });
  }

  /**
   * Pauses execution until requests and tokens within the rolling window decay
   * to acceptable thresholds.
   */
  private async waitForRateLimit(estimatedTokens: number): Promise<void> {
    while (!this.canProceed(estimatedTokens)) {
      this.pruneOldRecords();

      const earliest = this.requestHistory[0];
      if (!earliest) {
        break;
      }

      const releaseTime = earliest.timestamp + this.windowDurationMs;
      const msUntilDecay = Math.max(50, releaseTime - Date.now() + 25);
      const sleepDuration = Math.min(msUntilDecay, 5000);

      await new Promise((resolve) => setTimeout(resolve, sleepDuration));
    }
  }

  /**
   * Retrieves a snapshot of rate limiter metrics for observability.
   */
  getStatus() {
    this.pruneOldRecords();
    const requestsCount = this.requestHistory.length;
    const tokensCount = this.requestHistory.reduce((sum, item) => sum + item.tokens, 0);

    return {
      activeRequests: this.activeInFlight,
      requestsInWindow: requestsCount,
      tokensInWindow: tokensCount,
      availableRequests: Math.max(0, this.config.maxRequestsPerMinute - requestsCount),
      availableTokens: Math.max(0, this.config.maxTokensPerMinute - tokensCount)
    };
  }
}

/**
 * Functional wrapper for applying rate limits to an arbitrary async action.
 */
export async function withRateLimit<T>(
  limiter: RateLimiter,
  task: () => Promise<T>,
  tokensEstimate: number = 1000
): Promise<T> {
  await limiter.acquire(tokensEstimate);
  try {
    return await task();
  } finally {
    limiter.release();
  }
}

export const globalRateLimiter = new RateLimiter();