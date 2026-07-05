import { describe, it, expect } from 'vitest';
import { retryWithBackoff, parseRetryAfter, expoDelay } from './retry';

// A scripted fn: pops the next queued response per call, and records how many
// times it was called so we can assert on retry behavior.
function scriptedFn<T>(queue: T[]): { fn: () => Promise<T>; calls: () => number } {
  let count = 0;
  const fn = async (): Promise<T> => {
    count += 1;
    if (queue.length === 0) throw new Error('scriptedFn: no more responses');
    return queue.shift() as T;
  };
  return { fn, calls: () => count };
}

const noSleep = async () => {};
const isRetryable = (r: { status: number }) => r.status === 429 || (r.status >= 500 && r.status < 600);
const fixedDelay = () => 0;

describe('retryWithBackoff', () => {
  it('retries once on 429 then returns the 200', async () => {
    const { fn, calls } = scriptedFn([{ status: 429 }, { status: 200 }]);
    const result = await retryWithBackoff(fn, {
      isRetryable,
      retryDelayMs: fixedDelay,
      sleep: noSleep,
    });
    expect(result.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it('stops at maxAttempts and returns the last 429', async () => {
    const { fn, calls } = scriptedFn([
      { status: 429 },
      { status: 429 },
      { status: 429 },
    ]);
    const result = await retryWithBackoff(fn, {
      isRetryable,
      retryDelayMs: fixedDelay,
      maxAttempts: 3,
      sleep: noSleep,
    });
    expect(result.status).toBe(429);
    expect(calls()).toBe(3);
  });

  it('does not retry a non-retryable 200', async () => {
    const { fn, calls } = scriptedFn([{ status: 200 }, { status: 500 }]);
    const result = await retryWithBackoff(fn, {
      isRetryable,
      retryDelayMs: fixedDelay,
      sleep: noSleep,
    });
    expect(result.status).toBe(200);
    expect(calls()).toBe(1);
  });

  it('retries a thrown network error then succeeds via onNetworkError', async () => {
    let count = 0;
    const fn = async (): Promise<{ status: number }> => {
      count += 1;
      if (count === 1) throw new Error('ECONNRESET');
      return { status: 200 };
    };
    const errorAttempts: number[] = [];
    const result = await retryWithBackoff(fn, {
      isRetryable,
      retryDelayMs: fixedDelay,
      sleep: noSleep,
      onNetworkError: (_err, attempt) => {
        errorAttempts.push(attempt);
        return 0;
      },
    });
    expect(result.status).toBe(200);
    expect(count).toBe(2);
    expect(errorAttempts).toEqual([1]);
  });

  it('rethrows when onNetworkError returns null', async () => {
    const fn = async (): Promise<{ status: number }> => {
      throw new Error('boom');
    };
    await expect(
      retryWithBackoff(fn, {
        isRetryable,
        retryDelayMs: fixedDelay,
        sleep: noSleep,
        onNetworkError: () => null,
      }),
    ).rejects.toThrow(/boom/);
  });
});

describe('parseRetryAfter', () => {
  it('parses delta-seconds to milliseconds', () => {
    expect(parseRetryAfter('120')).toBe(120000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('returns null for missing or unparseable values', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('not-a-date')).toBeNull();
  });

  it('parses an HTTP-date relative to injected now', () => {
    const now = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:30 GMT', now)).toBe(30000);
    // A past date clamps to 0 rather than going negative.
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:27:00 GMT', now)).toBe(0);
  });
});

describe('expoDelay', () => {
  it('grows exponentially and caps', () => {
    expect(expoDelay(1, 800, 15000)).toBe(800);
    expect(expoDelay(2, 800, 15000)).toBe(1600);
    expect(expoDelay(3, 800, 15000)).toBe(3200);
    // Large attempts are capped.
    expect(expoDelay(10, 800, 15000)).toBe(15000);
  });
});
