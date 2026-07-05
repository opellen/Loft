import { MarkdownView } from 'obsidian';
import type DriveImagesPlugin from './main';
import { hasImageEmbed } from '../editor/imageEmbeds';
import { convertLocalImages } from './batchConvert';

/**
 * Register an `editor-menu` (right-click) entry that converts local image
 * embeds to Drive links. The item is only added when the current scope actually
 * contains a convertible local image, mirroring `convertLocalImages`'s scope
 * rule (selection text if any, else the whole note) so the menu never appears
 * when the command would find nothing. Clicking delegates to the same
 * `convertLocalImages` used by the command palette — no duplicated logic.
 */
export function registerConvertContextMenu(plugin: DriveImagesPlugin): void {
  plugin.registerEvent(
    plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
      if (!(view instanceof MarkdownView) || !view.file) return;
      const hasSelection = editor.somethingSelected();
      const scopeText = hasSelection ? editor.getSelection() : editor.getValue();
      if (!hasImageEmbed(scopeText)) return;
      menu.addItem((item) => {
        item
          .setTitle(
            hasSelection
              ? 'Convert images in selection to Drive links'
              : 'Convert local images in note to Drive links',
          )
          .setIcon('image-up')
          .onClick(() => void convertLocalImages(plugin, editor, view));
      });
    }),
  );
}
