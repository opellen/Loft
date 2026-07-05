import { MarkdownView, Notice } from 'obsidian';
import type { Editor, TFile } from 'obsidian';
import type DriveImagesPlugin from './main';
import { DriveClient } from '../drive/client';
import { uploadAndGetLink, type UploadDeps } from './uploadFlow';
import { findImageEmbeds, IMAGE_EXTS } from '../editor/imageEmbeds';
import { deriveFileName, mimeForExt } from '../editor/imageInsertion';

interface ResolvedTarget {
  start: number;
  end: number;
  tfile: TFile;
}

interface ConvertedTarget extends ResolvedTarget {
  url: string;
}

/**
 * Convert the local image embeds in the active note (or the current selection,
 * if any) to Google Drive links. Reuses the M3 upload pipeline
 * (`uploadAndGetLink` + `ensureFolderId` + `deriveFileName`). Lossless: failed
 * uploads keep their original embed. Rewrites are applied in descending offset
 * order so earlier offsets stay valid.
 */
export async function convertLocalImages(
  plugin: DriveImagesPlugin,
  editor: Editor,
  view: MarkdownView,
): Promise<void> {
  const { settings } = plugin;

  // Readiness guard — same criteria as the paste handler.
  if (!settings.tokens || !settings.folderName) {
    new Notice('Drive Images: sign in and set a folder name first');
    return;
  }

  const file = view.file;
  if (!file) {
    new Notice('Drive Images: no active note');
    return;
  }

  const text = editor.getValue();
  const selection = editor.somethingSelected();
  const rangeStart = selection ? editor.posToOffset(editor.getCursor('from')) : 0;
  const rangeEnd = selection ? editor.posToOffset(editor.getCursor('to')) : text.length;

  const embeds = findImageEmbeds(text).filter((e) => e.start >= rangeStart && e.end <= rangeEnd);
  if (embeds.length === 0) {
    new Notice('No local images found' + (selection ? ' in selection' : ''));
    return;
  }

  // Resolve each embed's linkpath to a real TFile relative to the active note.
  // Unresolvable / non-image targets count as skipped (e.g. already remote,
  // missing from the vault, or resolved to a non-image).
  const targets: ResolvedTarget[] = [];
  let skipped = 0;
  for (const e of embeds) {
    const dest = plugin.app.metadataCache.getFirstLinkpathDest(e.linkpath, file.path);
    if (!dest || !IMAGE_EXTS.includes(dest.extension.toLowerCase())) {
      skipped += 1;
      continue;
    }
    targets.push({ start: e.start, end: e.end, tfile: dest });
  }

  if (targets.length === 0) {
    new Notice(`Converted 0 · skipped ${skipped} · failed 0`);
    return;
  }

  new Notice(`Converting ${targets.length} image(s)…`);

  // Assemble the uploadFlow deps inline, mirroring the paste handler (main.ts
  // exposes no shared helper). 401 refresh is handled inside uploadAndGetLink.
  const deps: UploadDeps = {
    driveClient: new DriveClient(plugin.getRequest(), () => plugin.getAccessToken()),
    refresh: () => plugin.refreshAccessToken(),
    ensureFolderId: () => plugin.ensureFolderId(),
    settings: plugin.settings,
    getCachedFileId: (h) => plugin.getCachedFileId(h),
    setCachedFileId: (h, id) => plugin.setCachedFileId(h, id),
  };

  // Upload sequentially: clearer progress and the folder mutex stays simple.
  const converted: ConvertedTarget[] = [];
  let failed = 0;
  for (const t of targets) {
    try {
      const bytes = await plugin.app.vault.readBinary(t.tfile);
      const mime = mimeForExt(t.tfile.extension);
      const name = deriveFileName(t.tfile.name, mime, new Date());
      const url = await uploadAndGetLink(deps, bytes, mime, name);
      converted.push({ ...t, url });
    } catch {
      failed += 1; // keep the original embed — no data loss
    }
  }

  // Rewrite successful conversions in DESCENDING start order so that applying an
  // earlier replacement never invalidates the offsets of a later (earlier-in-
  // text) one.
  for (const c of [...converted].sort((a, b) => b.start - a.start)) {
    editor.replaceRange(
      `![](${c.url})`,
      editor.offsetToPos(c.start),
      editor.offsetToPos(c.end),
    );
  }

  // Optionally move the original attachments to the system trash. Only for
  // successfully converted files, and de-duplicated in case the same file was
  // embedded more than once.
  if (settings.deleteLocalAfterConvert) {
    const trashed = new Set<string>();
    for (const c of converted) {
      if (trashed.has(c.tfile.path)) continue;
      trashed.add(c.tfile.path);
      try {
        await plugin.app.vault.trash(c.tfile, true);
      } catch {
        // Best-effort: a failed trash must not undo a successful conversion.
      }
    }
  }

  new Notice(`Converted ${converted.length} · skipped ${skipped} · failed ${failed}`);
}
