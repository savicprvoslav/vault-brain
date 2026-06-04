import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { assembleContext, NoteDoc } from "../core/context.ts";
import { buildQaMessages, QaTurn } from "../core/qa-prompt.ts";
import { assembleRagContext } from "../core/rag-context.ts";

export const QA_VIEW_TYPE = "vault-brain-qa";

type Mode = "note" | "vault";

export class VaultBrainQaView extends ItemView {
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private chipEl!: HTMLElement;
  private history: QaTurn[] = [];
  private currentPath: string | null = null;
  private abort: AbortController | null = null;
  private mode: Mode = "note";

  constructor(leaf: WorkspaceLeaf, private plugin: VaultBrainPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return QA_VIEW_TYPE;
  }
  getDisplayText(): string {
    return "Vault Brain Q&A";
  }
  getIcon(): string {
    return "message-circle";
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("vault-brain-qa");

    const header = root.createDiv({ cls: "vault-brain-qa-header" });
    const modeSelect = header.createEl("select", { cls: "vault-brain-qa-mode" });
    modeSelect.createEl("option", { value: "note", text: "This note + links" });
    modeSelect.createEl("option", { value: "vault", text: "Whole vault (search)" });
    modeSelect.value = this.mode;
    modeSelect.onchange = () => {
      this.mode = modeSelect.value as Mode;
      this.renderModeInfo();
    };

    this.chipEl = root.createDiv({ cls: "vault-brain-qa-chip" });
    this.chipEl.hide();
    this.messagesEl = root.createDiv({ cls: "vault-brain-qa-messages" });

    const inputRow = root.createDiv({ cls: "vault-brain-qa-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { rows: "3", placeholder: "Ask about your notes… (Cmd/Ctrl-Enter to send)" },
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
    this.currentPath = this.app.workspace.getActiveFile()?.path ?? null;
    this.renderModeInfo();
  }

  async onClose(): Promise<void> {
    this.abort?.abort();
  }

  private resetConversation(): void {
    this.history = [];
    this.messagesEl.empty();
    this.chipEl.hide();
  }

  private renderModeInfo(): void {
    this.resetConversation();
    if (this.mode === "vault") {
      this.renderInfo("Whole-vault search — ask anything about your notes.");
    } else {
      const file = this.app.workspace.getActiveFile();
      this.renderInfo(file ? `Context: ${file.basename} + linked notes` : "Open a note to ask about it.");
    }
  }

  // Reset when the active note changes — only in "this note" mode.
  private syncToActiveFile(): void {
    if (this.mode !== "note") return;
    const file = this.app.workspace.getActiveFile();
    const path = file?.path ?? null;
    if (path === this.currentPath) return;
    this.currentPath = path;
    this.resetConversation();
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
    if (!question) return;
    if (this.mode === "note" && !this.app.workspace.getActiveFile()) {
      this.addBubble("assistant", "Open a note first to ask about it.");
      return;
    }
    this.inputEl.value = "";
    this.addBubble("user", question);

    const cap = this.plugin.settings.contextTokenCap;
    let contextText = "";
    let sources: string[] = [];
    let truncated = false;

    if (this.mode === "vault") {
      const hits = await this.plugin.vaultIndex.search(question, this.plugin.settings.ragTopK);
      const ctx = assembleRagContext(hits, cap);
      contextText = ctx.text;
      sources = ctx.sources;
      truncated = ctx.truncated;
      if (!contextText) {
        this.addBubble("assistant", 'No indexed notes matched. If your vault has notes, run “Rebuild vault index”.');
        return;
      }
    } else {
      const file = this.app.workspace.getActiveFile() as TFile;
      const { active, linked } = await this.gatherNotes(file);
      const ctx = assembleContext(active, linked, cap);
      contextText = ctx.text;
      truncated = ctx.truncated;
    }

    if (truncated) {
      this.chipEl.setText(`⚠︎ Context truncated to ~${cap} tokens — some content was omitted.`);
      this.chipEl.show();
    } else {
      this.chipEl.hide();
    }

    const messages = buildQaMessages(contextText, this.history, question);
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
      let finalText = answer;
      if (this.mode === "vault" && sources.length > 0) {
        finalText = `${answer}\n\nSources: ${sources.map((s) => `[[${s}]]`).join(", ")}`;
        bubble.setText(finalText);
      }
      this.history.push({ role: "user", text: question }, { role: "assistant", text: finalText });
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
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
