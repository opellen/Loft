import { App, Modal, Notice } from 'obsidian';

const DEFAULT_VERIFICATION_URL = 'https://www.google.com/device';

/**
 * Shows the user_code prominently plus a link to the verification URL and a
 * copy button. Closing the modal flips a cancel flag consumed by pollForToken.
 * DOM is built with createEl/setText — no innerHTML (marketplace review rule).
 */
export class DeviceCodeModal extends Modal {
  private cancelled = false;
  private statusEl!: HTMLElement;
  private onCancel?: () => void;

  constructor(
    app: App,
    private readonly userCode: string,
    private readonly verificationUrl: string = DEFAULT_VERIFICATION_URL,
  ) {
    super(app);
  }

  /** Called by the poller loop to decide whether to stop. */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /** Register a callback invoked when the user cancels (closes) the modal. */
  setOnCancel(cb: () => void): void {
    this.onCancel = cb;
  }

  /** Update the status line (e.g. "Waiting…", "Authenticated!"). */
  setStatus(text: string): void {
    if (this.statusEl) this.statusEl.setText(text);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('od-device-code-modal');

    contentEl.createEl('h2', { text: 'Authorize Google Drive' });

    const url = this.verificationUrl || DEFAULT_VERIFICATION_URL;
    const p = contentEl.createEl('p');
    p.appendText('Open ');
    p.createEl('a', { text: url, href: url, attr: { target: '_blank', rel: 'noopener' } });
    p.appendText(' and enter this code:');

    const codeEl = contentEl.createEl('div', { text: this.userCode, cls: 'od-user-code' });
    codeEl.style.fontSize = '2em';
    codeEl.style.fontWeight = 'bold';
    codeEl.style.letterSpacing = '0.15em';
    codeEl.style.textAlign = 'center';
    codeEl.style.margin = '1em 0';
    codeEl.style.userSelect = 'all';

    const btnRow = contentEl.createEl('div', { cls: 'od-btn-row' });
    const copyBtn = btnRow.createEl('button', { text: 'Copy code' });
    copyBtn.addEventListener('click', () => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(this.userCode);
          new Notice('Code copied to clipboard');
        } catch {
          new Notice('Could not copy code');
        }
      })();
    });

    this.statusEl = contentEl.createEl('p', {
      text: 'Waiting for approval…',
      cls: 'od-status',
    });
    this.statusEl.style.marginTop = '1em';
    this.statusEl.style.opacity = '0.8';
  }

  onClose(): void {
    // If closed before we programmatically closed it on success, treat as cancel.
    this.cancelled = true;
    this.onCancel?.();
    this.contentEl.empty();
  }
}
