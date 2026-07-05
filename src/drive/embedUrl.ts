import type { EmbedFormat } from './types';

// Single source of truth for embed-URL generation and parsing. M5 extends this
// seam to re-resolve links when Google changes URL formats. The canonical value
// stored per image is the Drive file ID; the display URL is derived here.

export function buildEmbedUrl(fileId: string, format: EmbedFormat): string {
  switch (format) {
    case 'lh3':
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    case 'thumbnail':
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
    case 'apiMedia':
      return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }
}

// A Drive file ID is an opaque token: letters, digits, `-` and `_`.
const ID = '([a-zA-Z0-9_-]+)';

const PATTERNS: RegExp[] = [
  // --- Formats this plugin produces (buildEmbedUrl); matched first. ---
  // lh3: https://lh3.googleusercontent.com/d/<id>
  new RegExp(`lh3\\.googleusercontent\\.com/d/${ID}`),
  // thumbnail: https://drive.google.com/thumbnail?id=<id>&sz=...
  new RegExp(`drive\\.google\\.com/thumbnail\\?id=${ID}`),
  // apiMedia: https://www.googleapis.com/drive/v3/files/<id>?alt=media
  new RegExp(`googleapis\\.com/drive/v3/files/${ID}`),

  // --- Legacy / external Drive share shapes (recovery coverage). ---
  // uc / open: https://drive.google.com/uc?...id=<id> or /open?id=<id>
  // The `id` param may be first (`?id=`) or preceded by other params (`&id=`).
  new RegExp(`drive\\.google\\.com/(?:uc|open)\\?(?:[^\\s]*&)?id=${ID}`),
  // file/d: https://drive.google.com/file/d/<id>/ (trailing slash optional)
  new RegExp(`drive\\.google\\.com/file/d/${ID}`),
];

/**
 * Recover a Drive file ID from any embed URL this plugin can produce.
 * Returns null if no known pattern matches. (M5 seam.)
 */
export function parseFileId(url: string): string | null {
  for (const re of PATTERNS) {
    const m = re.exec(url);
    if (m) return m[1];
  }
  return null;
}
