/**
 * Error Handling and Resilience Utilities
 * Provides structured error domains, exponential backoff retries with jitter,
 * and timeout execution wrappers with timer cleanup.
 */

export const ErrorCodes = {
  // Authentication & Configuration
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_GITHUB_TOKEN: 'MISSING_GITHUB_TOKEN',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // GitHub & MCP Connectivity
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Agent Orchestration & Execution
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_FAILED: 'AGENT_FAILED',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',

  // General Lifecycle
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ReviewErrorDetails {
  attempts?: number;
  timeoutMs?: number;
  lastError?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Domain-specific error class for multi-agent code review operations.
 */
export class ReviewError extends Error {
  public readonly code: string;
  public readonly details?: ReviewErrorDetails;
  public readonly timestamp: string;

  constructor(message: string, code: string = ErrorCodes.UNKNOWN_ERROR, details?: ReviewErrorDetails) {
    super(message);
    this.name = 'ReviewError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReviewError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export function isReviewError(error: unknown): error is ReviewError {
  return error instanceof ReviewError;
}

/**
 * Normalizes any error object into a human-readable diagnostic message.
 */
export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    const detailsStr = error.details ? ` | ${JSON.stringify(error.details)}` : '';
    return `[${error.code}] ${error.message}${detailsStr}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
}

/**
 * Executes an asynchronous action with exponential backoff and randomized jitter.
 *
 * Backoff formula: min(delayMs * factor^(attempt - 1), maxDelayMs) + randomJitter
 *
 * @param operation Async task to execute
 * @param maxRetries Maximum attempts allowed before giving up
 * @param delayMs Base delay in milliseconds
 * @returns Result of the successful operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  const effectiveMaxRetries = Math.max(1, maxRetries);
  let priorError: unknown;

  for (let currentAttempt = 1; currentAttempt <= effectiveMaxRetries; currentAttempt++) {
    try {
      return await operation();
    } catch (err) {
      priorError = err;

      if (currentAttempt >= effectiveMaxRetries) {
        break;
      }

      // Exponential backoff calculation
      const exponentialMultiplier = Math.pow(2, currentAttempt - 1);
      const computedDelay = delayMs * exponentialMultiplier;
      // Add random jitter between 10ms and 100ms to avert stampeding herd
      const randomJitter = Math.floor(Math.random() * 90) + 10;
      const sleepDuration = computedDelay + randomJitter;

      await new Promise((resolve) => setTimeout(resolve, sleepDuration));
    }
  }

  throw new ReviewError(
    `Operation failed after ${effectiveMaxRetries} attempt(s): ${formatError(priorError)}`,
    ErrorCodes.RETRY_EXHAUSTED,
    {
      attempts: effectiveMaxRetries,
      lastError: formatError(priorError)
    }
  );
}

/**
 * Guards an asynchronous function with a strict execution deadline.
 * Cleans up the timeout timer upon completion to prevent node event loop retention.
 *
 * @param asyncTask Async function being executed
 * @param timeoutMs Maximum duration in milliseconds
 * @param fallbackMessage Error message to report on timeout
 */
export async function withTimeout<T>(
  asyncTask: () => Promise<T>,
  timeoutMs: number,
  fallbackMessage: string = 'Operation timed out'
): Promise<T> {
  let timerId: NodeJS.Timeout | undefined;

  const timerPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new ReviewError(fallbackMessage, ErrorCodes.AGENT_TIMEOUT, { timeoutMs })
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([asyncTask(), timerPromise]);
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}