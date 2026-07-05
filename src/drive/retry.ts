// Obsidian-agnostic backoff/retry helpers for Drive HTTP calls. Kept pure and
// unit-testable: `sleep` is injected (tests pass a no-op) and no timers, fetch,
// or DOM are used here.

/**
 * Parse an HTTP `Retry-After` header into milliseconds.
 * Supports the delta-seconds form (e.g. `"120"` → `120000`) and the HTTP-date
 * form (e.g. `"Wed, 21 Oct 2026 07:28:00 GMT"` → ms from `now`). Returns null
 * when the value is absent or unparseable, so callers can fall back to expo.
 *
 * `now` is injected (defaults to `Date.now()`) so the HTTP-date branch is
 * deterministic under test.
 */
export function parseRetryAfter(
  headerValue: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (headerValue == null) return null;
  const trimmed = headerValue.trim();
  if (trimmed === '') return null;

  // delta-seconds: a bare non-negative integer.
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  // HTTP-date: parse to an absolute epoch and return the delta from `now`.
  const when = Date.parse(trimmed);
  if (Number.isNaN(when)) return null;
  const delta = when - now;
  return delta > 0 ? delta : 0;
}

/**
 * Exponential backoff delay for the given (1-based) attempt, capped at `capMs`.
 * Jitter defaults to 0 so tests are deterministic; pass a positive `jitterMs`
 * in production to spread retries.
 */
export function expoDelay(
  attempt: number,
  baseMs = 800,
  capMs = 15000,
  jitterMs = 0,
): number {
  const exp = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(exp, capMs);
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  return Math.min(capped + jitter, capMs);
}

export interface RetryOptions<T> {
  /** True when a resolved result should be retried (e.g. 429/5xx). */
  isRetryable: (result: T) => boolean;
  /** Milliseconds to wait before the next attempt given a retryable result. */
  retryDelayMs: (result: T, attempt: number) => number;
  /** Max total attempts (default 5). */
  maxAttempts?: number;
  /** Injected sleep; tests pass a no-op. */
  sleep: (ms: number) => Promise<void>;
  /**
   * Called when `fn()` throws. Return the ms to wait before retrying, or null
   * to rethrow immediately. `attempt` is 1-based.
   */
  onNetworkError?: (err: unknown, attempt: number) => number | null;
}

/**
 * Run `fn` up to `maxAttempts` times with injected backoff.
 * - Resolves and `!isRetryable` → return the result immediately.
 * - Resolves and retryable with attempts left → sleep `retryDelayMs` then retry.
 * - Resolves and retryable on the last attempt → return the (still-retryable)
 *   result so the caller sees the final status.
 * - Throws → if `onNetworkError` returns a number and attempts remain, sleep and
 *   retry; otherwise rethrow.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions<T>,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isLast = attempt === maxAttempts;
    let result: T;
    try {
      result = await fn();
    } catch (err) {
      const delay = opts.onNetworkError?.(err, attempt) ?? null;
      if (delay != null && !isLast) {
        await opts.sleep(delay);
        continue;
      }
      throw err;
    }

    if (!opts.isRetryable(result) || isLast) {
      return result;
    }
    await opts.sleep(opts.retryDelayMs(result, attempt));
  }

  // Unreachable: the loop always returns or throws on the last attempt.
  throw new Error('retryWithBackoff: exhausted attempts');
}
