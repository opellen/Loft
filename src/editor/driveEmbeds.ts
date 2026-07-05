// Pure, Obsidian-runtime-free scanner for existing Drive image links in note
// text. Keeping this module 'obsidian'-free makes the offset/parsing logic unit
// testable. Complements `imageEmbeds.ts`, which scans LOCAL images; here we want
// the opposite: remote embeds whose URL resolves to a Drive file ID.

import { parseFileId } from '../drive/embedUrl';

export interface DriveLink {
  /** The full matched embed text (`![alt](url)`). */
  raw: string;
  /** Character offset of the start of `raw` in the source text. */
  start: number;
  /** Character offset just past the end of `raw` in the source text. */
  end: number;
  /** The recovered Drive file ID (canonical value). */
  fileId: string;
  /** The bare URL inside the embed (angle brackets / title stripped). */
  url: string;
}

// Markdown embeds only: ![alt]( url "title"? ). Our plugin always inserts the
// markdown form `![](url)`; wikilinks (`![[...]]`) never hold remote URLs.
const MD_RE = /!\[[^\]]*\]\(([^)]*)\)/g;

/** Extract the bare URL from a markdown link inner (title / angle brackets stripped). */
function bareUrl(inner: string): string {
  let url = inner.trim();
  // Strip a trailing quoted title: `url "title"` or `url 'title'`.
  const titleM = url.match(/\s+["'][^"']*["']$/);
  if (titleM && titleM.index !== undefined) url = url.slice(0, titleM.index).trim();
  // Strip optional angle brackets: `<url>`.
  if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1).trim();
  return url;
}

/**
 * Scan `text` for markdown image embeds whose URL is a recognizable Google Drive
 * link (per {@link parseFileId}). Non-Drive and local embeds are skipped.
 * Returns matches sorted ascending by `start`; `text.slice(start, end) === raw`
 * for every result.
 */
export function findDriveLinks(text: string): DriveLink[] {
  const out: DriveLink[] = [];

  MD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_RE.exec(text)) !== null) {
    const raw = m[0];
    const url = bareUrl(m[1]);
    const fileId = parseFileId(url);
    if (fileId === null) continue;
    out.push({ raw, start: m.index, end: m.index + raw.length, fileId, url });
  }

  return out;
}
