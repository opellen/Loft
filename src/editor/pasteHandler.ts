import { Notice } from 'obsidian';
import type { Editor, MarkdownFileInfo, MarkdownView, TFile } from 'obsidian';
import type DriveImagesPlugin from '../plugin/main';
import { DriveClient } from '../drive/client';
import { uploadAndGetLink } from '../plugin/uploadFlow';
import { saveLocalAttachment } from '../plugin/localFallback';
import {
  pickImageFiles,
  deriveFileName,
  makePlaceholder,
  replacePlaceholder,
} from './imageInsertion';

// Monotonic counter combined with Date.now() to give each in-flight upload a
// globally unique placeholder id, even for rapid multi-image pastes/drops.
let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `${Date.now()}-${uidCounter}`;
}

// The readiness notice is shown at most once per session to avoid spamming the
// user on every paste while they are not set up.
let readinessNoticeShown = false;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Register `editor-paste`/`editor-drop` handlers that intercept image files,
 * upload them to Drive, and replace an inline placeholder with the embed URL.
 * Falls back to a local vault attachment if the upload fails, so no data is lost.
 */
export function registerImageUploadHandlers(plugin: DriveImagesPlugin): void {
  const { workspace } = plugin.app;

  plugin.registerEvent(
    workspace.on('editor-paste', (evt, editor, info) => {
      if (evt.defaultPrevented) return;
      const imgs = imagesToHandle(plugin, evt.clipboardData?.files);
      if (!imgs) return; // nothing to do — let Obsidian handle it
      // We are handling this event ourselves.
      evt.preventDefault();
      startUploads(plugin, editor, info, imgs);
    }),
  );

  plugin.registerEvent(
    workspace.on('editor-drop', (evt, editor, info) => {
      if (evt.defaultPrevented) return;
      const imgs = imagesToHandle(plugin, evt.dataTransfer?.files);
      if (!imgs) return; // nothing to do — let Obsidian handle it
      // We are handling this event ourselves.
      evt.preventDefault();
      startUploads(plugin, editor, info, imgs);
    }),
  );
}

/**
 * Synchronous decision step: pick image files from the event and confirm the
 * plugin is ready to upload. Returns the images to handle, or `null` when the
 * caller should NOT preventDefault (no images, or not signed in / no folder).
 * Shows the one-time readiness Notice when images are present but setup is
 * incomplete. Deliberately does NOT call `evt.preventDefault()` — the handler
 * callbacks do that themselves, only when this returns images.
 */
function imagesToHandle(
  plugin: DriveImagesPlugin,
  list: FileList | null | undefined,
): File[] | null {
  const imgs = pickImageFiles(list);
  if (imgs.length === 0) return null; // no images — let Obsidian handle it

  const { settings } = plugin;
  // Readiness guard: only intercept once we can actually upload. Otherwise let
  // Obsidian save locally as usual and (once) nudge the user to finish setup.
  if (!settings.tokens || !settings.folderName) {
    if (!readinessNoticeShown) {
      readinessNoticeShown = true;
      new Notice('Drive Images: sign in and set a folder name in settings to enable Drive upload');
    }
    return null;
  }

  return imgs;
}

/** Kick off a per-file async upload for each picked image. */
function startUploads(
  plugin: DriveImagesPlugin,
  editor: Editor,
  info: MarkdownView | MarkdownFileInfo,
  imgs: File[],
): void {
  const sourceFile: TFile | null = info.file ?? null;
  for (const file of imgs) {
    void processOne(plugin, editor, sourceFile, file);
  }
}

async function processOne(
  plugin: DriveImagesPlugin,
  editor: Editor,
  sourceFile: TFile | null,
  file: File,
): Promise<void> {
  const name = deriveFileName(file.name, file.type, new Date());
  const uid = nextUid();
  const placeholder = makePlaceholder(uid, name);
  // Insert the placeholder synchronously at the cursor before any await, so the
  // user sees immediate feedback and concurrent uploads don't clobber cursors.
  editor.replaceSelection(placeholder);

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch (e) {
    replacePlaceholder(editor, placeholder, '');
    new Notice(`Drive Images: could not read image (${errorMessage(e)})`);
    return;
  }

  const driveClient = new DriveClient(plugin.getRequest(), () => plugin.getAccessToken());

  try {
    const url = await uploadAndGetLink(
      {
        driveClient,
        refresh: () => plugin.refreshAccessToken(),
        ensureFolderId: () => plugin.ensureFolderId(),
        settings: plugin.settings,
        getCachedFileId: (h) => plugin.getCachedFileId(h),
        setCachedFileId: (h, id) => plugin.setCachedFileId(h, id),
      },
      bytes,
      file.type,
      name,
    );
    replacePlaceholder(editor, placeholder, `![](${url})`);
    new Notice(`Uploaded ${name} to Drive.`);
  } catch (uploadErr) {
    // Upload failed — save locally so no data is lost.
    try {
      const embed = await saveLocalAttachment(plugin.app, sourceFile, name, bytes);
      replacePlaceholder(editor, placeholder, embed);
      new Notice(`Drive upload failed; saved ${name} locally. (${errorMessage(uploadErr)})`);
    } catch (localErr) {
      replacePlaceholder(editor, placeholder, '');
      new Notice(
        `Drive upload and local save both failed for ${name}: ${errorMessage(localErr)}`,
      );
    }
  }
}
