import type { Editor } from 'obsidian';

// Pure, Obsidian-runtime-free helpers for the paste/drop upload flow.
// `Editor` is imported as a type only so this module stays unit-testable:
// the actual string/index logic lives in `findPlaceholderRange`, which takes
// plain strings and needs no Obsidian runtime.

/** Filter a FileList (or nullish) down to image files. */
export function pickImageFiles(list: FileList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list.item(i);
    if (f && f.type.startsWith('image/')) out.push(f);
  }
  return out;
}

/** Map a MIME type to a file extension. Falls back to the subtype after `image/`. */
export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default: {
      const slash = mime.indexOf('/');
      const sub = slash >= 0 ? mime.slice(slash + 1) : mime;
      // Strip any parameters (e.g. `svg+xml;charset=…`) and codec suffixes.
      return (sub.split(';')[0].split('+')[0] || 'bin').trim();
    }
  }
}

/** Zero-pad a number to a fixed width. */
function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Format a Date as `yyyyMMdd-HHmmss` (local time). */
export function formatTimestamp(now: Date): string {
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

// Names Obsidian/OSes hand out for clipboard images carry no information.
const GENERIC_NAMES = new Set([
  'image.png',
  'image.jpg',
  'image.jpeg',
  'image.gif',
  'image.webp',
  'image',
  'download',
  'download.png',
  'unknown',
  'unknown.png',
  'blob',
]);

function isMeaningfulName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !GENERIC_NAMES.has(trimmed.toLowerCase());
}

/**
 * Derive a destination file name prefixed with a timestamp:
 * `<yyyyMMdd-HHmmss>_<base>.<ext>`. For a meaningful `name` the base is the name
 * without its extension and the ext is kept (falling back to the mime); for a
 * generic/empty name the base is `pasted` and the ext comes from the mime.
 * Deterministic given `now`. Same-second collisions are acceptable (Drive allows
 * duplicate names), so no random suffix is added. Shared by paste/drop (M3) and
 * bulk conversion of existing local images (M4).
 */
export function deriveFileName(name: string, mime: string, now: Date): string {
  const ts = formatTimestamp(now);
  const trimmed = name.trim();
  let base: string;
  let ext: string;
  if (isMeaningfulName(trimmed)) {
    const dot = trimmed.lastIndexOf('.');
    if (dot > 0) {
      base = trimmed.slice(0, dot);
      ext = trimmed.slice(dot + 1) || extForMime(mime || 'image/png');
    } else {
      base = trimmed;
      ext = extForMime(mime || 'image/png');
    }
  } else {
    base = 'pasted';
    ext = extForMime(mime || 'image/png');
  }
  return `${ts}_${base}.${ext}`;
}

/** Map a file extension to an image MIME type. Reverse of {@link extForMime}. */
export function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

/**
 * A non-rendering, unique plain-text marker inserted while an upload is in
 * flight. Backtick-wrapped so it renders as inline code, never as an image
 * embed, and the `⟨uid⟩` keeps concurrent uploads independently addressable.
 */
export function makePlaceholder(uid: string, name: string): string {
  return `\`⏳ Uploading ${name}… ⟨${uid}⟩\``;
}

/** Pure range finder over a document string. Returns null if not present. */
export function findPlaceholderRange(
  text: string,
  placeholder: string,
): { start: number; end: number } | null {
  const idx = text.indexOf(placeholder);
  if (idx < 0) return null;
  return { start: idx, end: idx + placeholder.length };
}

/**
 * Locate `placeholder` in the editor and replace it with `replacement`.
 * Returns false if the placeholder is no longer present.
 */
export function replacePlaceholder(
  editor: Editor,
  placeholder: string,
  replacement: string,
): boolean {
  const range = findPlaceholderRange(editor.getValue(), placeholder);
  if (!range) return false;
  const from = editor.offsetToPos(range.start);
  const to = editor.offsetToPos(range.end);
  editor.replaceRange(replacement, from, to);
  return true;
}
