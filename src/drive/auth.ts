import type { DeviceCodeResponse, RequestFn, TokenSet } from './types';

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FORM_CT = 'application/x-www-form-urlencoded';

/** Delay helper; injectable so tests run without real timers. */
export type DelayFn = (ms: number) => Promise<void>;

/** Minimal shape of Google's OAuth token endpoint JSON (success or error). */
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const realDelay: DelayFn = (ms) => new Promise((r) => window.setTimeout(r, ms));

function form(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * OAuth 2.0 Device Flow ("Limited Input device") for Google.
 * Obsidian-agnostic: all HTTP goes through the injected RequestFn.
 * Date.now/setTimeout are the real runtime ones here (not a sandbox), so fine.
 */
export class DeviceFlowAuth {
  constructor(
    private readonly request: RequestFn,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly delay: DelayFn = realDelay,
  ) {}

  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const res = await this.request({
      url: DEVICE_CODE_URL,
      method: 'POST',
      contentType: FORM_CT,
      body: form({ client_id: this.clientId, scope: SCOPE }),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`device/code failed (${res.status}): ${res.text}`);
    }
    const raw = res.json as {
      device_code: string;
      user_code: string;
      verification_url?: string;
      verification_uri?: string;
      interval?: number;
      expires_in?: number;
    };
    return {
      device_code: raw.device_code,
      user_code: raw.user_code,
      verification_url: raw.verification_url ?? raw.verification_uri ?? '',
      interval: raw.interval ?? 5,
      expires_in: raw.expires_in ?? 0,
    };
  }

  /**
   * Poll the token endpoint until the user approves, cancellation is requested,
   * or the device code expires. Handles Google's polling error protocol.
   */
  async pollForToken(
    deviceCode: string,
    interval: number,
    expiresIn: number,
    shouldCancel: () => boolean,
  ): Promise<TokenSet> {
    const deadline = Date.now() + expiresIn * 1000;
    let waitSeconds = interval;

    // Wait the initial interval before the first poll (Google requires it).
    while (true) {
      if (shouldCancel()) throw new Error('Authentication cancelled.');
      if (Date.now() >= deadline) throw new Error('Device code expired. Please try again.');

      await this.delay(waitSeconds * 1000);

      if (shouldCancel()) throw new Error('Authentication cancelled.');

      const res = await this.request({
        url: TOKEN_URL,
        method: 'POST',
        contentType: FORM_CT,
        body: form({
          grant_type: DEVICE_GRANT,
          device_code: deviceCode,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      const body = (res.json ?? {}) as TokenResponse;

      if (res.status >= 200 && res.status < 300 && body.access_token) {
        return this.toTokenSet(body, '');
      }

      const err: string | undefined = body.error;
      switch (err) {
        case 'authorization_pending':
          // Keep polling at the current interval.
          break;
        case 'slow_down':
          waitSeconds += 5;
          break;
        case 'access_denied':
          throw new Error('Access denied by the user.');
        case 'expired_token':
          throw new Error('Device code expired. Please try again.');
        default:
          throw new Error(`Token polling failed (${res.status}): ${body.error ?? res.text}`);
      }
    }
  }

  /**
   * Exchange a refresh token for a fresh access token. Google may omit a new
   * refresh_token, in which case we retain the existing one.
   */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const res = await this.request({
      url: TOKEN_URL,
      method: 'POST',
      contentType: FORM_CT,
      body: form({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    const body = (res.json ?? {}) as TokenResponse;
    if (res.status < 200 || res.status >= 300 || !body.access_token) {
      throw new Error(`Token refresh failed (${res.status}): ${res.text}`);
    }
    return this.toTokenSet(body, refreshToken);
  }

  private toTokenSet(body: TokenResponse, fallbackRefresh: string): TokenSet {
    return {
      accessToken: body.access_token ?? '',
      refreshToken: body.refresh_token ?? fallbackRefresh,
      expiresAt: Date.now() + Number(body.expires_in ?? 0) * 1000,
    };
  }
}
