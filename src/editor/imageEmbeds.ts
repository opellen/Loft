// Pure, Obsidian-runtime-free scanner for image embeds in note text.
// Keeping this module 'obsidian'-free makes the offset/parsing logic unit
// testable. `batchConvert` resolves the returned `linkpath` to a real TFile.

/** Image file extensions we treat as convertible local attachments. */
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];

export interface FoundEmbed {
  /** The full matched embed text (`![[...]]` or `![](...)`). */
  raw: string;
  /** Character offset of the start of `raw` in the source text. */
  start: number;
  /** Character offset just past the end of `raw` in the source text. */
  end: number;
  /** The resolved link target (alias/size/title/fragment/query stripped, decoded for markdown). */
  linkpath: string;
  kind: 'wikilink' | 'markdown';
}

/** Strip a trailing `?query` and/or `#fragment` from a path. */
function stripQueryFragment(p: string): string {
  const hash = p.indexOf('#');
  if (hash >= 0) p = p.slice(0, hash);
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  return p;
}

/** Lowercased extension of a path (after stripping `?query`/`#frag`), or ''. */
function extOf(p: string): string {
  const clean = stripQueryFragment(p);
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  const base = slash >= 0 ? clean.slice(slash + 1) : clean;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** True if the target is already a remote/data URL (nothing to convert). */
function isRemote(target: string): boolean {
  const lower = target.toLowerCase();
  return (
    lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:')
  );
}

/** Keep a target only if it is a local image (whitelisted ext, not remote). */
function accept(target: string): boolean {
  if (!target) return false;
  if (isRemote(target)) return false;
  return IMAGE_EXTS.includes(extOf(target));
}

// Embed-matching regexes, shared by `findImageEmbeds` and `hasImageEmbed` so
// both use identical matching rules.
// Wikilink embeds: ![[ target(|alias)? (#heading)? ]] — literal, no decoding.
const WIKI_RE = /!\[\[([^\]]+?)\]\]/g;
// Markdown embeds: ![alt]( target "title"? ) — URL-decoded.
const MD_RE = /!\[[^\]]*\]\(([^)]*)\)/g;

/** Extract the wikilink link target (alias/size/heading stripped, undecoded). */
function wikiTarget(inner: string): string {
  let target = inner.split('|')[0]; // drop alias / size suffix
  const hash = target.indexOf('#'); // drop heading/subpath
  if (hash >= 0) target = target.slice(0, hash);
  return target.trim();
}

/** Extract the markdown link target (title/angle-brackets stripped, decoded). */
function mdTarget(inner: string): string {
  let target = inner.trim();
  // Strip a trailing quoted title: `url "title"` or `url 'title'`.
  const titleM = target.match(/\s+["'][^"']*["']$/);
  if (titleM && titleM.index !== undefined) target = target.slice(0, titleM.index).trim();
  // Strip optional angle brackets: `<url>`.
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1).trim();
  try {
    return decodeURIComponent(target);
  } catch {
    return target; // malformed percent-encoding: keep as-is
  }
}

/**
 * Scan `text` for local image embeds in both wikilink (`![[path|alias]]`) and
 * markdown (`![alt](path "title")`) form. Remote (`http(s)://`, `data:`) targets
 * and non-image extensions are excluded. Returns matches sorted ascending by
 * `start`; `text.slice(start, end) === raw` for every result.
 */
export function findImageEmbeds(text: string): FoundEmbed[] {
  const out: FoundEmbed[] = [];

  WIKI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_RE.exec(text)) !== null) {
    const raw = m[0];
    const target = wikiTarget(m[1]);
    if (accept(target)) {
      out.push({
        raw,
        start: m.index,
        end: m.index + raw.length,
        linkpath: stripQueryFragment(target),
        kind: 'wikilink',
      });
    }
  }

  MD_RE.lastIndex = 0;
  while ((m = MD_RE.exec(text)) !== null) {
    const raw = m[0];
    const decoded = mdTarget(m[1]);
    if (accept(decoded)) {
      out.push({
        raw,
        start: m.index,
        end: m.index + raw.length,
        linkpath: stripQueryFragment(decoded),
        kind: 'markdown',
      });
    }
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * True as soon as the FIRST convertible local image embed is found. Uses the
 * exact same matching/filtering rules as {@link findImageEmbeds} (shared
 * regexes + `wikiTarget`/`mdTarget` + `accept`), but returns on the first
 * qualifying match instead of scanning the whole text — cheap enough to run on
 * every right-click for menu visibility.
 */
export function hasImageEmbed(text: string): boolean {
  WIKI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_RE.exec(text)) !== null) {
    if (accept(wikiTarget(m[1]))) return true;
  }

  MD_RE.lastIndex = 0;
  while ((m = MD_RE.exec(text)) !== null) {
    if (accept(mdTarget(m[1]))) return true;
  }

  return false;
}
