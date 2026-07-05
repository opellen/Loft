import type { App, TFile } from 'obsidian';

/**
 * Save bytes into the vault as a normal attachment and return a markdown embed
 * for it. Used when a Drive upload fails so no image data is ever lost.
 *
 * Uses a `![[basename]]` wikilink — Obsidian resolves it regardless of the
 * attachment folder, and it avoids URL-encoding pitfalls of relative paths.
 */
export async function saveLocalAttachment(
  app: App,
  sourceFile: TFile | null,
  name: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const path = await app.fileManager.getAvailablePathForAttachment(name, sourceFile?.path);
  await app.vault.createBinary(path, bytes);

  const slash = path.lastIndexOf('/');
  const basename = slash >= 0 ? path.slice(slash + 1) : path;
  return `![[${basename}]]`;
}
