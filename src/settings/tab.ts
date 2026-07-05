import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type DriveImagesPlugin from '../plugin/main';
import type { EmbedFormat } from '../drive/types';
import { UnauthorizedError } from '../drive/client';

export class DriveImagesSettingTab extends PluginSettingTab {
  plugin: DriveImagesPlugin;

  constructor(app: App, plugin: DriveImagesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Account').setHeading();

    const signedIn = !!this.plugin.settings.tokens;
    const accountSetting = new Setting(containerEl);
    if (signedIn) {
      accountSetting
        .setName('Signed in to Google Drive')
        .setDesc('Connected.')
        .addButton((btn) =>
          btn
            .setButtonText('Sign out')
            .setWarning()
            .onClick(async () => {
              btn.setDisabled(true).setButtonText('Signing out…');
              try {
                await this.plugin.signOut();
                // Re-renders the whole tab, rebuilding the buttons.
                this.display();
              } finally {
                // On the error path this.display() is skipped, so make sure the
                // button is never left stuck disabled. (After a successful
                // re-render this acts on the now-detached element: harmless.)
                btn.setDisabled(false).setButtonText('Sign out');
              }
            }),
        );
    } else {
      accountSetting.setName('Not signed in').addButton((btn) =>
        btn
          .setButtonText('Sign in')
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true).setButtonText('Signing in…');
            try {
              await this.plugin.signIn();
              // Re-renders the whole tab, rebuilding the buttons.
              this.display();
            } finally {
              // On the error path this.display() is skipped, so make sure the
              // button is never left stuck disabled. (After a successful
              // re-render this acts on the now-detached element: harmless.)
              btn.setDisabled(false).setButtonText('Sign in');
            }
          }),
      );
    }

    new Setting(containerEl).setName('Google Drive credentials').setHeading();

    new Setting(containerEl)
      .setName('Client ID')
      .setDesc('OAuth 2.0 "TVs and Limited Input devices" client ID.')
      .addText((text) =>
        text
          .setPlaceholder('xxxxx.apps.googleusercontent.com')
          .setValue(this.plugin.settings.clientId)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.clientId = value.trim();
              await this.plugin.saveSettings();
            })();
          }),
      );

    new Setting(containerEl)
      .setName('Client secret')
      .setDesc('Treated as non-confidential in Device Flow, but do not share it.')
      .addText((text) => {
        text
          .setPlaceholder('client secret')
          .setValue(this.plugin.settings.clientSecret)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.clientSecret = value.trim();
              await this.plugin.saveSettings();
            })();
          });
        text.inputEl.type = 'password';
      });

    new Setting(containerEl)
      .setName('Destination folder path')
      .setDesc('Folder path for uploads; use / for subfolders. The plugin creates and owns these folders.')
      .addText((text) =>
        text
          .setPlaceholder('Obsidian Images')
          .setValue(this.plugin.settings.folderName)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.folderName = value.trim();
              await this.plugin.saveSettings();
            })();
          }),
      )
      .addButton((btn) =>
        btn
          .setButtonText('Create / connect folder')
          .setTooltip('Find or create the plugin-owned folder path.')
          .onClick(async () => {
            const original = 'Create / connect folder';
            btn.setDisabled(true).setButtonText('Working…');
            try {
              // Keeps the existing find/create logic + Notices intact.
              await this.ensureFolder();
            } finally {
              // This button does not call this.display(), so restore the label
              // and re-enable it here on every path.
              btn.setDisabled(false).setButtonText(original);
            }
          }),
      );

    new Setting(containerEl)
      .setName('Parent folder ID (optional)')
      .setDesc(
        'If set, the path is created inside this existing Drive folder (paste its ID from the folder URL). Leave empty to use My Drive root.',
      )
      .addText((text) =>
        text
          .setPlaceholder('1AbC…')
          .setValue(this.plugin.settings.parentFolderId)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.parentFolderId = value.trim();
              await this.plugin.saveSettings();
            })();
          }),
      );

    new Setting(containerEl).setName('Embedding').setHeading();

    new Setting(containerEl)
      .setName('Embed URL format')
      .setDesc('URL form inserted into notes. lh3 is fastest but unofficial.')
      .addDropdown((dd) => {
        dd.addOption('lh3', 'lh3 (googleusercontent)');
        dd.addOption('thumbnail', 'thumbnail');
        dd.addOption('apiMedia', 'API media (alt=media)');
        dd.setValue(this.plugin.settings.embedFormat);
        dd.onChange((value) => {
          void (async () => {
            this.plugin.settings.embedFormat = value as EmbedFormat;
            await this.plugin.saveSettings();
          })();
        });
      });

    new Setting(containerEl)
      .setName('Make uploads public')
      .setDesc('Grant "anyone with the link" read access so images render directly.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.makePublic).onChange((value) => {
          void (async () => {
            this.plugin.settings.makePublic = value;
            await this.plugin.saveSettings();
          })();
        }),
      );

    new Setting(containerEl).setName('Bulk conversion').setHeading();

    new Setting(containerEl)
      .setName('Delete local file after converting')
      .setDesc(
        'Move the original attachment to system trash after a successful upload. Off by default; the file may still be referenced by other notes.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.deleteLocalAfterConvert).onChange((value) => {
          void (async () => {
            this.plugin.settings.deleteLocalAfterConvert = value;
            await this.plugin.saveSettings();
          })();
        }),
      );
  }

  /**
   * Find-or-create the plugin-owned folder named `folderName` and cache its id.
   * Since the plugin owns the folder, this genuinely verifies/creates it under
   * the drive.file scope.
   */
  private async ensureFolder(): Promise<void> {
    const name = this.plugin.settings.folderName;
    if (!name) {
      new Notice('Enter a folder name first.');
      return;
    }
    if (!this.plugin.settings.tokens) {
      new Notice('Sign in to Google Drive first.');
      return;
    }
    try {
      const { created } = await this.plugin.ensureFolderInfo();
      new Notice(
        created ? `Created folder: "${name}"` : `Connected to existing folder: "${name}"`,
      );
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        new Notice('Sign in to Google Drive first.');
        return;
      }
      new Notice(`Could not create/connect folder: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
