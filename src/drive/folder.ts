import { UnauthorizedError } from './client';
import type { RequestFn } from './types';

// Drive layer: NO imports from 'obsidian'. All HTTP via the injected RequestFn
// so this stays unit-testable and identical on desktop/mobile.

export const FOLDER_MIME = 'application/vnd.google-apps.folder';

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

type GetToken = () => Promise<string>;

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * True only if `folderId` resolves to a Drive folder the app can access.
 * False on 404. Throws UnauthorizedError on 401 so callers can refresh.
 */
export async function folderExists(
  request: RequestFn,
  getToken: GetToken,
  folderId: string,
): Promise<boolean> {
  const token = await getToken();
  const res = await request({
    url: `${FILES_URL}/${encodeURIComponent(folderId)}?fields=id,mimeType`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 404) return false;
  if (!isOk(res.status)) return false;
  return res.json?.mimeType === FOLDER_MIME;
}

/**
 * Find an app-created folder by exact name within `parentId` (defaults to the
 * Drive root). Under drive.file this only returns folders the app owns in that
 * parent — exactly what we want. Returns the first match id or null.
 */
export async function findFolderByName(
  request: RequestFn,
  getToken: GetToken,
  name: string,
  parentId?: string,
): Promise<string | null> {
  const token = await getToken();
  const escaped = name.replace(/'/g, "\\'");
  const parent = parentId ?? 'root';
  const q =
    `mimeType='${FOLDER_MIME}' and name='${escaped}' and ` +
    `'${parent}' in parents and trashed=false`;
  const url =
    `${FILES_URL}?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent('files(id,name)')}&spaces=drive`;
  const res = await request({
    url,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!isOk(res.status)) {
    throw new Error(`Folder search failed (${res.status}): ${res.text}`);
  }
  const files: { id: string }[] = res.json?.files ?? [];
  return files.length > 0 ? files[0].id : null;
}

/**
 * Create an app-owned folder and return its id. When `parentId` is set the
 * folder is created inside it; otherwise it lands at the Drive root. Uses the
 * normal files endpoint (not /upload/). Throws on non-2xx.
 */
export async function createFolder(
  request: RequestFn,
  getToken: GetToken,
  name: string,
  parentId?: string,
): Promise<string> {
  const token = await getToken();
  const body: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId) body.parents = [parentId];
  const res = await request({
    url: `${FILES_URL}?fields=id`,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!isOk(res.status)) {
    throw new Error(`Folder create failed (${res.status}): ${res.text}`);
  }
  return res.json.id;
}

/**
 * Resolve the plugin-owned folder for `name` within `parentId`, reusing a
 * cached id when it still points at a valid folder, otherwise searching for an
 * app-created folder by name in that parent, and finally creating one. Throws
 * UnauthorizedError on 401.
 */
export async function ensureFolder(
  request: RequestFn,
  getToken: GetToken,
  name: string,
  parentId?: string,
  cachedId?: string,
): Promise<{ id: string; created: boolean }> {
  if (cachedId && (await folderExists(request, getToken, cachedId))) {
    return { id: cachedId, created: false };
  }
  const found = await findFolderByName(request, getToken, name, parentId);
  if (found) return { id: found, created: false };
  return { id: await createFolder(request, getToken, name, parentId), created: true };
}

/**
 * Resolve a nested folder PATH (e.g. `A/B/C`) under `rootParentId` (undefined →
 * Drive root), creating any missing segments. Each segment the plugin creates is
 * app-owned, so this works to arbitrary depth. Returns the FINAL folder id and
 * `created: true` if any segment along the way was created. Throws if the path
 * is empty after trimming. Throws UnauthorizedError on 401.
 */
export async function ensureFolderPath(
  request: RequestFn,
  getToken: GetToken,
  pathStr: string,
  rootParentId?: string,
  _cachedId?: string,
): Promise<{ id: string; created: boolean }> {
  const segments = pathStr
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new Error('folder path is empty');
  }

  let currentParent = rootParentId;
  let anyCreated = false;
  let lastId = '';
  for (const seg of segments) {
    const res = await ensureFolder(request, getToken, seg, currentParent);
    if (res.created) anyCreated = true;
    currentParent = res.id;
    lastId = res.id;
  }
  return { id: lastId, created: anyCreated };
}
