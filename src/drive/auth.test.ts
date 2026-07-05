import { describe, it, expect } from 'vitest';
import { DeviceFlowAuth } from './auth';
import type { RequestFn, RequestResponse } from './types';

// A scripted RequestFn: pops the next queued response per call and records the
// request options so we can assert on them.
function fakeRequest(queue: Partial<RequestResponse>[]): {
  request: RequestFn;
  calls: { url: string; body?: string | ArrayBuffer }[];
} {
  const calls: { url: string; body?: string | ArrayBuffer }[] = [];
  const request: RequestFn = async (opts) => {
    calls.push({ url: opts.url, body: opts.body });
    const next = queue.shift();
    if (!next) throw new Error('fakeRequest: no more scripted responses');
    return {
      status: next.status ?? 200,
      text: next.text ?? '',
      json: next.json ?? {},
      arrayBuffer: next.arrayBuffer ?? new ArrayBuffer(0),
    };
  };
  return { request, calls };
}

const noDelay = async () => {};
const never = () => false;

describe('DeviceFlowAuth.pollForToken', () => {
  it('retries on authorization_pending then returns a TokenSet on success', async () => {
    const { request } = fakeRequest([
      { status: 428, json: { error: 'authorization_pending' } },
      { status: 200, json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } },
    ]);
    const auth = new DeviceFlowAuth(request, 'cid', 'secret', noDelay);

    const token = await auth.pollForToken('dc', 1, 100, never);

    expect(token.accessToken).toBe('AT');
    expect(token.refreshToken).toBe('RT');
    expect(token.expiresAt).toBeGreaterThan(Date.now());
  });

  it('increases the poll interval on slow_down', async () => {
    const delays: number[] = [];
    const recordingDelay = async (ms: number) => {
      delays.push(ms);
    };
    const { request } = fakeRequest([
      { status: 403, json: { error: 'slow_down' } },
      { status: 200, json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } },
    ]);
    const auth = new DeviceFlowAuth(request, 'cid', 'secret', recordingDelay);

    await auth.pollForToken('dc', 5, 100, never);

    // First wait uses the base interval (5s); after slow_down it becomes 10s.
    expect(delays).toEqual([5000, 10000]);
  });

  it('throws on access_denied', async () => {
    const { request } = fakeRequest([{ status: 403, json: { error: 'access_denied' } }]);
    const auth = new DeviceFlowAuth(request, 'cid', 'secret', noDelay);

    await expect(auth.pollForToken('dc', 1, 100, never)).rejects.toThrow(/denied/i);
  });

  it('throws when cancelled', async () => {
    const { request } = fakeRequest([
      { status: 200, json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } },
    ]);
    const auth = new DeviceFlowAuth(request, 'cid', 'secret', noDelay);

    await expect(auth.pollForToken('dc', 1, 100, () => true)).rejects.toThrow(/cancel/i);
  });
});

describe('DeviceFlowAuth.refresh', () => {
  it('keeps the old refresh token when Google omits a new one', async () => {
    const { request } = fakeRequest([{ status: 200, json: { access_token: 'NEW', expires_in: 3600 } }]);
    const auth = new DeviceFlowAuth(request, 'cid', 'secret', noDelay);

    const token = await auth.refresh('OLD_RT');

    expect(token.accessToken).toBe('NEW');
    expect(token.refreshToken).toBe('OLD_RT');
  });
});

describe('DeviceFlowAuth.requestDeviceCode', () => {
  it('posts client_id and scope and returns the parsed response', async () => {
    const { request, calls } = fakeRequest([
      {
        status: 200,
        json: {
          device_code: 'dc',
          user_code: 'ABCD-EFGH',
          verification_url: 'https://www.google.com/device',
          interval: 5,
          expires_in: 1800,
        },
      },
    ]);
    const auth = new DeviceFlowAuth(request, 'my-client', 'secret', noDelay);

    const res = await auth.requestDeviceCode();

    expect(res.user_code).toBe('ABCD-EFGH');
    expect(String(calls[0].body)).toContain('client_id=my-client');
    expect(String(calls[0].body)).toContain('scope=');
  });
});
