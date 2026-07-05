> **English** · [한국어](google-cloud-setup.ko.md)

# Google Cloud Setup Guide — for Device Flow authentication (M2 prerequisite)

This plugin uploads images to **your own Google Drive**. To make that possible, each user issues an OAuth client once in Google Cloud. Below is the procedure for creating a **"TVs and Limited Input devices"** (= OAuth 2.0 Device Flow) client.

> Takes ~10 minutes. Free. No credit card required.  
> The console UI changes often (recently parts moved from 'APIs & Services' to 'Google Auth Platform'). If a menu name differs, type the bold keyword into the search box to find it.

---

## 0\. Why this approach (summary)

*   **Device Flow / 'Limited Input' client**: the client\_secret is treated as non-confidential, which suits open-source distribution and works on both desktop and mobile.
*   **The scope is** `**drive.file**`: the app can access **only the files it creates itself**. It cannot see the rest of your Drive → least privilege + no Google verification required.

---

## 1\. Create a project

1.  Go to https://console.cloud.google.com (sign in with your Google account).
2.  Click the **project selector dropdown** on the left of the top blue bar → **New Project**.
3.  Name it, e.g. `obsidian-drive-images` → **Create**.
4.  After creation, confirm the project you just made is **selected** in the dropdown.

## 2\. Enable the Drive API

1.  Type `**Google Drive API**` into the top search box → click the result.
2.  Click the **Enable** button.
    *   If it's already enabled, you'll see 'Manage' — just leave it as is.

## 3\. Configure the OAuth consent screen

Left menu **APIs & Services → OAuth consent screen** (or search `OAuth consent`).

1.  **User Type**: choose **External** → Create.
    *   (For an organization Workspace account, Internal is also possible, but a personal Gmail account uses External.)
2.  **App information**:
    *   App name: e.g. `Obsidian Drive Images`
    *   User support email: select your own email
    *   Developer contact information: your own email
    *   The rest (logo/domain) can be left blank → **Save and Continue**.
3.  **Scopes** step:
    *   Click **Add or Remove Scopes** → type `drive.file` into the filter.
    *   Check `.../auth/drive.file` ("See, edit, create, and delete only the specific Google Drive files you use with this app") → **Update** → **Save and Continue**.
4.  **Test users** step:
    *   **Add Users** → add your own Google email → **Save and Continue**.
    *   ⚠ While the app is in 'Testing' status, **only the users added here** can sign in, and the **refresh token expires after 7 days**.
5.  **Summary** → Back to Dashboard.

### (Recommended) Publish the app to 'Production'

*   `drive.file` is a non-sensitive scope, so you can publish **without verification**, and publishing removes the 7-day refresh-token expiry limit.
*   On the **OAuth consent screen** dashboard, click **Publish App** → confirm. (Even if "Needs verification" appears, using only `drive.file` causes no problems in real use.)

## 4\. Issue an OAuth client ID (the key step)

Left menu **APIs & Services → Credentials** (search `Credentials`).

1.  At the top, **\+ Create Credentials → OAuth client ID**.
2.  **Application type** dropdown → choose **TVs and Limited Input devices**.
    *   If this item doesn't appear: it only shows up once the consent screen (step 3) is complete. Try again after finishing it.
3.  Name it, e.g. `obsidian-device-client` → **Create**.
4.  Copy the **Client ID** and **Client Secret** shown in the popup and keep them somewhere safe.
    *   In Device Flow this secret is treated as 'non-confidential', but still don't expose it anywhere carelessly.
    *   To view them again later, click the client in the Credentials list.

## 5\. Get a target folder ID for testing

1.  In https://drive.google.com, **create a folder** to use as the upload destination (e.g. `Obsidian Images`).
2.  When you open that folder, the address bar looks like `https://drive.google.com/drive/folders/**<this part is the folder ID>**`.
3.  The string after `folders/` is the **folder ID**. Copy it.

---

## Checklist of values to secure (used in M2)

Values to enter into the plugin settings / PoC:

*   `client_id` (step 4)
*   `client_secret` (step 4)
*   Target folder ID (step 5)
*   Drive API enabled (step 2)
*   Your account added as a test user, or the app Published (step 3)

> Do not commit these values to the repository (git). During development, handle them only via a local `data.json` / environment variables.

---

## Device Flow behavior preview (reference for implementation)

1.  The plugin sends `POST https://oauth2.googleapis.com/device/code` (client\_id + scope) → receives `device_code`, `user_code`, `verification_url`, `interval`.
2.  It tells the user to "enter code `XXXX-XXXX` at `google.com/device`".
3.  The plugin polls `POST https://oauth2.googleapis.com/token` (grant\_type=`urn:ietf:params:oauth:grant-type:device_code`, device\_code, client\_id, client\_secret) every `interval` → once approved, receives `access_token` + `refresh_token`.
4.  From then on, it refreshes the access token with the `refresh_token`, and uploads to Drive `files.create` using the `access_token`.

Reference doc: https://developers.google.com/identity/protocols/oauth2/limited-input-device
