import { DriveClient, UnauthorizedError } from '../drive/client';
import { buildEmbedUrl } from '../drive/embedUrl';
import { sha256Hex } from '../drive/hash';
import type { Settings } from '../settings/data';

/**
 * Everything `uploadAndGetLink` needs, injected so this module has no direct
 * dependency on the plugin instance and stays unit-testable. Shared with M4
 * (bulk conversion of existing images).
 */
export interface UploadDeps {
  driveClient: DriveClient;
  /** Force a token refresh and persist it. Returns the new access token. */
  refresh: () => Promise<string>;
  /** Find-or-create the plugin-owned folder and return its (cached) id. */
  ensureFolderId: () => Promise<string>;
  settings: Pick<Settings, 'embedFormat' | 'makePublic'>;
  /** Look up a previously uploaded fileId by content hash (dedup fast path). */
  getCachedFileId: (hash: string) => string | undefined;
  /** Persist a content hash → fileId mapping after a successful upload. */
  setCachedFileId: (hash: string, fileId: string) => Promise<void>;
}

/**
 * Upload bytes to the configured Drive folder and return an embed URL.
 * On a 401 (`UnauthorizedError`) refreshes the token once and retries the
 * upload; if it still fails the error propagates so callers can fall back.
 */
export async function uploadAndGetLink(
  deps: UploadDeps,
  bytes: ArrayBuffer,
  mime: string,
  name: string,
): Promise<string> {
  const { driveClient, refresh, ensureFolderId, settings } = deps;
  const effectiveMime = mime || 'application/octet-stream';

  // Dedup fast path: identical bytes already uploaded → reuse the fileId and
  // skip folder resolution, upload, and share entirely.
  const hash = await sha256Hex(bytes);
  const cached = deps.getCachedFileId(hash);
  if (cached) {
    return buildEmbedUrl(cached, settings.embedFormat);
  }

  const folderId = await ensureFolderId();

  let result;
  try {
    result = await driveClient.upload(name, effectiveMime, bytes, folderId);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      await refresh();
      result = await driveClient.upload(name, effectiveMime, bytes, folderId);
    } else {
      throw e;
    }
  }

  if (settings.makePublic) {
    await driveClient.share(result.id);
  }

  // Record the mapping only after a successful upload (and share, if enabled) so
  // a failed upload never writes the cache.
  await deps.setCachedFileId(hash, result.id);

  return buildEmbedUrl(result.id, settings.embedFormat);
}
