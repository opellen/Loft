> **English** · [한국어](README.ko.md)

# Loft — Upload images to Google Drive and replace local embeds with links

> Paste or drag an image into a note and Loft uploads it to your own Google Drive, then inserts a rendering `![](link)` — keeping your vault light.

---

## Why Loft

- **Your vault stays small.** Images live in your Google Drive, not inside the vault, so sync and backups stay fast and lean.
- **Desktop and mobile.** Sign-in and upload use Obsidian's `requestUrl()` and OAuth 2.0 Device Flow, which work on both.
- **Least-privilege `drive.file` scope.** Loft can only see the files it creates — it never touches the rest of your Drive, so no Google verification is required.
- **Resilient link handling.** The embed URL format is abstracted behind a setting, and a re-resolve command can repair or switch every link without re-uploading a single image.

---

## Features

- **Paste or drag to upload.** Paste or drag an image into a note and it auto-uploads to your Google Drive, then a rendering `![](link)` is inserted at the cursor.
- **Convert existing local images.** The "Convert local images to Drive links" command — also on the editor right-click menu — converts the local images already embedded in the current note, or only those within your selection.
- **Plugin-owned destination folder.** Set a folder path (e.g. `Attachments/Images`, using `/` for subfolders); the plugin creates and owns these folders. An optional Parent folder ID nests the path inside an existing Drive folder.
- **Sign in with Google.** OAuth 2.0 Device Flow works on desktop and mobile — enter a short code at `google.com/device` and you're connected.
- **Switchable embed URL format.** Choose `lh3`, `thumbnail`, or `apiMedia` (`alt=media`). The "Re-resolve Drive image links" command (current note or whole vault) rewrites existing links to the chosen format, or recovers them if Google changes its URL format — all without re-uploading.
- **Duplicate-upload prevention.** The same image content is uploaded only once, tracked by a content hash.
- **Automatic retry with backoff.** Rate-limit responses (HTTP 429) are retried with exponential backoff.
- **Safe filenames and fallbacks.** Uploads get timestamp-prefixed filenames. If an upload fails, the local image is kept losslessly; an optional "Delete local file after converting" setting trashes the original only after a successful upload.

---

## Requirements / Setup

Loft uploads to **your own Google Drive**, so each user creates their own Google Cloud OAuth client once (about 10 minutes, free, no credit card). You then paste the **Client ID** and **Client secret** into Loft's settings.

In brief:

1. **Create a project** in the [Google Cloud Console](https://console.cloud.google.com).
2. **Enable the Google Drive API** for that project.
3. **Configure the OAuth consent screen** (User type: External; add the `.../auth/drive.file` scope; add yourself as a test user, or publish the app).
4. **Create an OAuth client ID** of type **"TVs and Limited Input devices"** and copy the Client ID + Client secret.
5. **(Optional) grab a destination folder ID** from a Drive folder's URL if you want uploads nested under an existing folder.

See the step-by-step guide: [docs/reference/google-cloud-setup.md](docs/reference/google-cloud-setup.md).

---

## Installation

### Obsidian Community Plugins

1. **Settings → Community plugins → Browse**
2. Search for "Loft" → **Install** → **Enable**

### Manual install

1. Download the latest release from the [Releases](https://github.com/opellen/Loft/releases) page
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/loft/` folder
3. Enable **Loft** under **Settings → Community plugins**

---

## Usage

1. **Sign in.** Open **Settings → Loft → Account** and click **Sign in**, or run the command **"Sign in to Google Drive"**. Enter the shown code at `google.com/device` to authorize.
2. **Set the destination folder.** Enter a **Destination folder path** (e.g. `Attachments/Images`) and click **Create / connect folder**. Optionally set a **Parent folder ID** to nest it under an existing Drive folder.
3. **Add images.** Paste or drag an image into a note to upload it automatically, or run **"Convert local images to Drive links"** to convert images already in the note (or only within the selection). The same convert action is available from the editor **right-click menu**.
4. **Switch or repair links** anytime with **"Re-resolve Drive image links"** (current note) or **"Re-resolve Drive image links in vault"** (whole vault) after changing the embed URL format.

---

## Privacy & security

- Images are uploaded to **your** Google Drive and shared as **"anyone with the link"** — this is required so the image renders directly inside a note. Anyone who has the link or file ID can view the image. **Do not use Loft for sensitive images.**
- OAuth tokens are stored in the plugin's `data.json` inside your vault. They are **not** encrypted in an OS keychain yet, so treat your vault as you would any credential store.
- Loft only accesses files it creates, thanks to the `drive.file` scope. It cannot see the rest of your Drive.

---

## Compatibility

- Obsidian 1.5.0 or newer.
- **Desktop and mobile** (`isDesktopOnly: false`).
- Notes on mobile:
  - Drag-and-drop does not fire on mobile — use **paste** or the **convert command** instead.
  - The device-code **copy button** may be a no-op on locked-down mobile browsers, but the code itself is selectable so you can copy it manually.

---

## Screenshots

Coming soon.

---

## Credits / License

Released under the [MIT License](LICENSE).

Also available in [한국어](README.ko.md).
