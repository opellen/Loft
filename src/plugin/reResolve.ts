import { Notice } from 'obsidian';
import type { Editor, MarkdownView } from 'obsidian';
import type DriveImagesPlugin from './main';
import { buildEmbedUrl } from '../drive/embedUrl';
import { findDriveLinks } from '../editor/driveEmbeds';

/**
 * Re-resolve the Drive image links in the active note (or the current selection,
 * if any) to the current embed format. The canonical value is the Drive file ID:
 * for each link we recover the id and rebuild its URL with
 * `settings.embedFormat`. Only links whose URL actually changes are rewritten
 * (no-op churn is avoided), in DESCENDING offset order so earlier rewrites never
 * invalidate later offsets. No re-upload — this is pure link recovery.
 */
export async function reResolveLinks(
  plugin: DriveImagesPlugin,
  editor: Editor,
  view: MarkdownView,
): Promise<void> {
  void view; // reserved for symmetry with batchConvert; kept for command wiring.

  const text = editor.getValue();
  const selection = editor.somethingSelected();
  const start = selection ? editor.posToOffset(editor.getCursor('from')) : 0;
  const end = selection ? editor.posToOffset(editor.getCursor('to')) : text.length;

  const links = findDriveLinks(text).filter((l) => l.start >= start && l.end <= end);
  if (links.length === 0) {
    new Notice('No Drive image links found' + (selection ? ' in selection' : ''));
    return;
  }

  let changed = 0;
  let unchanged = 0;
  const rewrites: { start: number; end: number; newUrl: string }[] = [];
  for (const l of links) {
    const newUrl = buildEmbedUrl(l.fileId, plugin.settings.embedFormat);
    if (newUrl !== l.url) {
      changed += 1;
      rewrites.push({ start: l.start, end: l.end, newUrl });
    } else {
      unchanged += 1;
    }
  }

  // Apply in DESCENDING start order so earlier offsets stay valid.
  for (const r of rewrites.sort((a, b) => b.start - a.start)) {
    editor.replaceRange(
      `![](${r.newUrl})`,
      editor.offsetToPos(r.start),
      editor.offsetToPos(r.end),
    );
  }

  new Notice(`Re-resolved ${changed} · unchanged ${unchanged}`);
}

/**
 * Vault-wide variant of {@link reResolveLinks}: walk every markdown file and
 * rewrite each Drive link whose URL differs from the current embed format. Uses
 * `vault.process` (atomic read-modify-write) and plain-string splicing rather
 * than an editor. Low-frequency command, so files are processed sequentially.
 */
export async function reResolveVault(plugin: DriveImagesPlugin): Promise<void> {
  let changedLinks = 0;
  let changedFiles = 0;

  for (const file of plugin.app.vault.getMarkdownFiles()) {
    let fileChanged = 0;
    await plugin.app.vault.process(file, (content) => {
      const links = findDriveLinks(content);
      // Descending offset order so each splice keeps earlier offsets valid.
      const rewrites = links
        .map((l) => ({ start: l.start, end: l.end, newUrl: buildEmbedUrl(l.fileId, plugin.settings.embedFormat), url: l.url }))
        .filter((r) => r.newUrl !== r.url)
        .sort((a, b) => b.start - a.start);
      if (rewrites.length === 0) return content;
      let next = content;
      for (const r of rewrites) {
        next = next.slice(0, r.start) + `![](${r.newUrl})` + next.slice(r.end);
      }
      fileChanged = rewrites.length;
      return next;
    });
    if (fileChanged > 0) {
      changedLinks += fileChanged;
      changedFiles += 1;
    }
  }

  new Notice(`Re-resolved ${changedLinks} link(s) across ${changedFiles} file(s)`);
}
