// Obsidian-agnostic content hashing for duplicate-upload prevention.
// Uses the Web Crypto `crypto.subtle` global (available in Obsidian's Electron
// renderer and in Node/Vitest), so this module stays unit-testable.

/** SHA-256 of `bytes` as a lowercase hex string. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}
