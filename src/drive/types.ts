// Shared types for the Drive layer.
// IMPORTANT: this directory must NOT import from 'obsidian'. All network access
// is performed through the injected `RequestFn` so the layer is unit-testable
// and works identically on desktop and mobile (via the Obsidian requestUrl wrapper).

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  interval: number;
  expires_in: number;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Absolute epoch millis at which the access token expires. */
  expiresAt: number;
}

export interface UploadResult {
  id: string;
}

export type EmbedFormat = 'lh3' | 'thumbnail' | 'apiMedia';

export interface RequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
  contentType?: string;
}

export interface RequestResponse {
  status: number;
  text: string;
  json: unknown;
  arrayBuffer: ArrayBuffer;
}

/**
 * Abstraction over a single HTTP round-trip. main.ts wraps Obsidian's
 * `requestUrl` to satisfy this signature; tests inject a fake.
 */
export type RequestFn = (opts: RequestOptions) => Promise<RequestResponse>;
