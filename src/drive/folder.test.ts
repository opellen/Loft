import { describe, it, expect } from 'vitest';
import {
  findFolderByName,
  createFolder,
  ensureFolder,
  ensureFolderPath,
  FOLDER_MIME,
} from './folder';
import type { RequestFn, RequestResponse } from './types';

// A scripted RequestFn: pops the next queued response per call and records the
// request options so we can assert on them.
function fakeRequest(queue: Partial<RequestResponse>[]): {
  request: RequestFn;
  calls: { url: string; method?: string; body?: string | ArrayBuffer }[];
} {
  const calls: { url: string; method?: string; body?: string | ArrayBuffer }[] = [];
  const request: RequestFn = async (opts) => {
    calls.push({ url: opts.url, method: opts.method, body: opts.body });
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

const getToken = async () => 'AT';

describe('findFolderByName', () => {
  it('returns the first id when files are non-empty', async () => {
    const { request } = fakeRequest([
      { status: 200, json: { files: [{ id: 'F1', name: 'Obsidian Images' }] } },
    ]);
    const id = await findFolderByName(request, getToken, 'Obsidian Images');
    expect(id).toBe('F1');
  });

  it('returns the FIRST id when the search yields multiple duplicates (self-heal)', async () => {
    // If a prior race already created duplicate same-named folders in Drive, the
    // search returns several files; resolving to files[0] makes every caller
    // converge on one folder instead of forking further.
    const { request } = fakeRequest([
      {
        status: 200,
        json: {
          files: [
            { id: 'DUP1', name: 'Obsidian Images' },
            { id: 'DUP2', name: 'Obsidian Images' },
            { id: 'DUP3', name: 'Obsidian Images' },
          ],
        },
      },
    ]);
    const id = await findFolderByName(request, getToken, 'Obsidian Images');
    expect(id).toBe('DUP1');
  });

  it('returns null when files are empty', async () => {
    const { request } = fakeRequest([{ status: 200, json: { files: [] } }]);
    const id = await findFolderByName(request, getToken, 'Obsidian Images');
    expect(id).toBeNull();
  });

  it('scopes the query to the Drive root when no parent is given', async () => {
    const { request, calls } = fakeRequest([{ status: 200, json: { files: [] } }]);
    await findFolderByName(request, getToken, 'Obsidian Images');
    const q = decodeURIComponent(calls[0].url);
    expect(q).toContain('in parents');
    expect(q).toContain("'root' in parents");
  });

  it('scopes the query to the given parent id', async () => {
    const { request, calls } = fakeRequest([{ status: 200, json: { files: [] } }]);
    await findFolderByName(request, getToken, 'Sub', 'PARENT1');
    const q = decodeURIComponent(calls[0].url);
    expect(q).toContain("'PARENT1' in parents");
  });
});

describe('createFolder', () => {
  it('returns the created id on success', async () => {
    const { request, calls } = fakeRequest([{ status: 200, json: { id: 'NEW' } }]);
    const id = await createFolder(request, getToken, 'Obsidian Images');
    expect(id).toBe('NEW');
    expect(calls[0].method).toBe('POST');
    expect(String(calls[0].body)).toContain(FOLDER_MIME);
    // Root create: no parents key.
    expect(String(calls[0].body)).not.toContain('parents');
  });

  it('includes parents when a parentId is given', async () => {
    const { request, calls } = fakeRequest([{ status: 200, json: { id: 'NEW' } }]);
    const id = await createFolder(request, getToken, 'Sub', 'PARENT1');
    expect(id).toBe('NEW');
    const body = JSON.parse(String(calls[0].body));
    expect(body.parents).toEqual(['PARENT1']);
  });

  it('throws on non-2xx', async () => {
    const { request } = fakeRequest([{ status: 500, text: 'boom' }]);
    await expect(createFolder(request, getToken, 'X')).rejects.toThrow(/500/);
  });
});

describe('ensureFolder', () => {
  it('reuses a valid cached id without creating', async () => {
    // folderExists GET → valid folder.
    const { request, calls } = fakeRequest([
      { status: 200, json: { id: 'CACHED', mimeType: FOLDER_MIME } },
    ]);
    const res = await ensureFolder(request, getToken, 'Obsidian Images', undefined, 'CACHED');
    expect(res).toEqual({ id: 'CACHED', created: false });
    expect(calls).toHaveLength(1);
  });

  it('uses a search hit when there is no cache', async () => {
    const { request } = fakeRequest([
      { status: 200, json: { files: [{ id: 'FOUND', name: 'Obsidian Images' }] } },
    ]);
    const res = await ensureFolder(request, getToken, 'Obsidian Images');
    expect(res).toEqual({ id: 'FOUND', created: false });
  });

  it('creates a folder when there is no cache and no search hit', async () => {
    const { request } = fakeRequest([
      { status: 200, json: { files: [] } }, // search miss
      { status: 200, json: { id: 'CREATED' } }, // create
    ]);
    const res = await ensureFolder(request, getToken, 'Obsidian Images');
    expect(res).toEqual({ id: 'CREATED', created: true });
  });

  it('falls through to search when the cached id is stale', async () => {
    const { request } = fakeRequest([
      { status: 404 }, // folderExists → false
      { status: 200, json: { files: [{ id: 'FOUND' }] } },
    ]);
    const res = await ensureFolder(request, getToken, 'Obsidian Images', undefined, 'STALE');
    expect(res).toEqual({ id: 'FOUND', created: false });
  });
});

describe('ensureFolderPath', () => {
  it('throws when the path is empty after trimming', async () => {
    const { request } = fakeRequest([]);
    await expect(ensureFolderPath(request, getToken, '  /  //  ')).rejects.toThrow(
      /folder path is empty/,
    );
  });

  it('creates each missing segment of a 2-level path chained by parent', async () => {
    const { request, calls } = fakeRequest([
      { status: 200, json: { files: [] } }, // search A in root → miss
      { status: 200, json: { id: 'A_ID' } }, // create A
      { status: 200, json: { files: [] } }, // search B in A_ID → miss
      { status: 200, json: { id: 'B_ID' } }, // create B
    ]);
    const res = await ensureFolderPath(request, getToken, 'A/B');
    expect(res).toEqual({ id: 'B_ID', created: true });
    // A searched under root, B searched under A_ID.
    expect(decodeURIComponent(calls[0].url)).toContain("'root' in parents");
    expect(decodeURIComponent(calls[2].url)).toContain("'A_ID' in parents");
    // B created with parent A_ID.
    expect(JSON.parse(String(calls[3].body)).parents).toEqual(['A_ID']);
  });

  it('walks a 3-level path and reports created when only some segments are new', async () => {
    const { request, calls } = fakeRequest([
      { status: 200, json: { files: [{ id: 'A_ID' }] } }, // A exists
      { status: 200, json: { files: [{ id: 'B_ID' }] } }, // B exists in A
      { status: 200, json: { files: [] } }, // C miss in B
      { status: 200, json: { id: 'C_ID' } }, // create C
    ]);
    const res = await ensureFolderPath(request, getToken, 'A/B/C');
    expect(res).toEqual({ id: 'C_ID', created: true });
    expect(decodeURIComponent(calls[1].url)).toContain("'A_ID' in parents");
    expect(decodeURIComponent(calls[2].url)).toContain("'B_ID' in parents");
    expect(JSON.parse(String(calls[3].body)).parents).toEqual(['B_ID']);
  });

  it('reuses existing app-owned segments without creating (created: false)', async () => {
    const { request } = fakeRequest([
      { status: 200, json: { files: [{ id: 'A_ID' }] } }, // A exists
      { status: 200, json: { files: [{ id: 'B_ID' }] } }, // B exists in A
    ]);
    const res = await ensureFolderPath(request, getToken, 'A/B');
    expect(res).toEqual({ id: 'B_ID', created: false });
  });

  it('respects rootParentId for the first segment', async () => {
    const { request, calls } = fakeRequest([
      { status: 200, json: { files: [{ id: 'A_ID' }] } }, // A exists under ROOT_P
    ]);
    const res = await ensureFolderPath(request, getToken, 'A', 'ROOT_P');
    expect(res).toEqual({ id: 'A_ID', created: false });
    expect(decodeURIComponent(calls[0].url)).toContain("'ROOT_P' in parents");
  });
});
