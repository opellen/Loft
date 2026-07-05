import type { TokenSet } from './types';

// Persistence abstraction for the OAuth token set. PoC stores tokens in plaintext
// inside the plugin settings object (data.json). OS-keychain encryption is
// deferred to M5 hardening. The interface keeps drive/ Obsidian-agnostic —
// main.ts injects callbacks bound to plugin.loadData/saveData.

export interface TokenStore {
  load(): Promise<TokenSet | null>;
  save(t: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

/** Shape of the persisted settings blob, as far as the token store cares. */
interface HasTokens {
  tokens: TokenSet | null;
}

/**
 * TokenStore backed by injected load/save callbacks over a settings object.
 * `loadData` returns the whole persisted blob; `saveData` writes it back.
 * Tokens live under the `tokens` key so the rest of the settings are preserved.
 */
export class DataJsonTokenStore implements TokenStore {
  constructor(
    private readonly loadData: () => Promise<HasTokens | null>,
    private readonly saveData: (data: HasTokens) => Promise<void>,
  ) {}

  async load(): Promise<TokenSet | null> {
    const data = await this.loadData();
    return data?.tokens ?? null;
  }

  async save(t: TokenSet): Promise<void> {
    const data = (await this.loadData()) ?? ({ tokens: null } as HasTokens);
    data.tokens = t;
    await this.saveData(data);
  }

  async clear(): Promise<void> {
    const data = await this.loadData();
    if (!data) return;
    data.tokens = null;
    await this.saveData(data);
  }
}
