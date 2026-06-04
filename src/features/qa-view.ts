import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { assembleContext, NoteDoc } from "../core/context.ts";
import { buildQaMessages, QaTurn } from "../core/qa-prompt.ts";

export const QA_VIEW_TYPE = "vault-brain-qa";

export class VaultBrainQaView extends ItemView {
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private chipEl!: HTMLElement;
  private history: QaTurn[] = [];
  private currentPath: string | null = null;
  private abort: AbortController | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: VaultBrainPlugin) {
    super(leaf);
  }

  getViewType(): string { return QA_VIEW_TYPE; }
  getDisplayText(): string { return "Vault Brain Q&A"; }
  getIcon(): string { return "message-circle"; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("vault-brain-qa");

    this.chipEl = root.createDiv({ cls: "vault-brain-qa-chip" });
    this.chipEl.hide();
    this.messagesEl = root.createDiv({ cls: "vault-brain-qa-messages" });

    const inputRow = root.createDiv({ cls: "vault-brain-qa-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { rows: "3", placeholder: "Ask about this note and its links… (Cmd/Ctrl-Enter to send)" },
    });
    const btnRow = root.createDiv({ cls: "vault-brain-qa-buttons" });
    this.sendBtn = btnRow.createEl("button", { text: "Send" });
    this.stopBtn = btnRow.createEl("button", { text: "Stop" });
    this.stopBtn.disabled = true;

    this.sendBtn.onclick = () => void this.onSend();
    this.stopBtn.onclick = () => this.abort?.abort();
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.onSend();
      }
    });

    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncToActiveFile()));
    this.syncToActiveFile();
  }

  async onClose(): Promise<void> {
    this.abort?.abort();
  }

  // Reset the conversation whenever the active note changes (no hidden cross-note state).
  private syncToActiveFile(): void {
    const file = this.app.workspace.getActiveFile();
    const path = file?.path ?? null;
    if (path === this.currentPath) return;
    this.currentPath = path;
    this.history = [];
    this.messagesEl.empty();
    this.chipEl.hide();
    this.renderInfo(file ? `Context: ${file.basename} + linked notes` : "Open a note to ask about it.");
  }

  private renderInfo(text: string): void {
    this.messagesEl.createDiv({ cls: "vault-brain-qa-info", text });
  }

  private async gatherNotes(file: TFile): Promise<{ active: NoteDoc; linked: NoteDoc[] }> {
    const active: NoteDoc = { title: file.basename, body: await this.app.vault.cachedRead(file) };
    const links = this.app.metadataCache.resolvedLinks[file.path] ?? {};
    const linked: NoteDoc[] = [];
    for (const targetPath of Object.keys(links)) {
      const tf = this.app.vault.getAbstractFileByPath(targetPath);
      if (tf instanceof TFile && tf.extension === "md") {
        linked.push({ title: tf.basename, body: await this.app.vault.cachedRead(tf) });
      }
    }
    return { active, linked };
  }

  private async onSend(): Promise<void> {
    const question = this.inputEl.value.trim();
    const file = this.app.workspace.getActiveFile();
    if (!question || !file) return;
    this.inputEl.value = "";
    this.addBubble("user", question);

    const { active, linked } = await this.gatherNotes(file);
    const cap = this.plugin.settings.contextTokenCap;
    const ctx = assembleContext(active, linked, cap);
    if (ctx.truncated) {
      this.chipEl.setText(`⚠︎ Context truncated to ~${cap} tokens — some linked notes were omitted.`);
      this.chipEl.show();
    } else {
      this.chipEl.hide();
    }

    const messages = buildQaMessages(ctx.text, this.history, question);
    const bubble = this.addBubble("assistant", "");
    this.setStreaming(true);
    this.abort = new AbortController();
    let answer = "";
    try {
      await this.plugin.provider.chatStream(messages, {
        signal: this.abort.signal,
        onToken: (t) => {
          answer += t;
          bubble.setText(answer);
          this.scrollToBottom();
        },
      });
      this.history.push({ role: "user", text: question }, { role: "assistant", text: answer });
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        // User pressed Stop — keep whatever streamed so far and remember the turn.
        if (answer) this.history.push({ role: "user", text: question }, { role: "assistant", text: answer });
      } else {
        bubble.setText(`${answer}${answer ? "\n\n" : ""}[error: ${err.message}]`);
      }
    } finally {
      this.setStreaming(false);
      this.abort = null;
    }
  }

  private addBubble(role: "user" | "assistant", text: string): HTMLElement {
    const wrap = this.messagesEl.createDiv({ cls: `vault-brain-qa-msg vault-brain-qa-${role}` });
    const body = wrap.createDiv({ cls: "vault-brain-qa-body", text });
    this.scrollToBottom();
    return body;
  }

  private setStreaming(on: boolean): void {
    this.sendBtn.disabled = on;
    this.stopBtn.disabled = !on;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
