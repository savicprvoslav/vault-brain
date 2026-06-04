import { App, ItemView, WorkspaceLeaf, TFile, TFolder, TAbstractFile, MarkdownRenderer, MarkdownView, FuzzySuggestModal, Notice } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { assembleContext, NoteDoc } from "../core/context.ts";
import { buildQaMessages, QaTurn } from "../core/qa-prompt.ts";
import { assembleRagContext } from "../core/rag-context.ts";
import { buildEditMessages } from "../core/edit-prompt.ts";
import { lineDiff } from "../core/diff.ts";

export const QA_VIEW_TYPE = "vault-brain-qa";

type Mode = "note" | "vault" | "edit";

class ContextSuggest extends FuzzySuggestModal<TAbstractFile> {
  constructor(app: App, private onPick: (f: TAbstractFile) => void) {
    super(app);
    this.setPlaceholder("Add a note or folder as context…");
  }
  getItems(): TAbstractFile[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f) => (f instanceof TFile && f.extension === "md") || f instanceof TFolder);
  }
  getItemText(f: TAbstractFile): string {
    return f.path;
  }
  onChooseItem(f: TAbstractFile): void {
    this.onPick(f);
  }
}

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
  private manualContext: TFile[] = [];
  private contextEl!: HTMLElement;

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
    modeSelect.createEl("option", { value: "edit", text: "Edit this note" });
    modeSelect.value = this.mode;
    modeSelect.onchange = () => {
      this.mode = modeSelect.value as Mode;
      this.renderModeInfo();
    };
    const ctxBtn = header.createEl("button", { cls: "vault-brain-qa-ctxbtn", text: "+ Context" });
    ctxBtn.onclick = () => this.openContextPicker();
    this.contextEl = root.createDiv({ cls: "vault-brain-qa-chips" });

    this.chipEl = root.createDiv({ cls: "vault-brain-qa-chip" });
    this.chipEl.hide();
    this.messagesEl = root.createDiv({ cls: "vault-brain-qa-messages" });
    this.messagesEl.addEventListener("click", (e) => {
      const link = (e.target as HTMLElement).closest("a.internal-link") as HTMLElement | null;
      if (link) {
        e.preventDefault();
        const href = link.getAttribute("data-href") ?? link.getAttribute("href") ?? "";
        if (href) void this.app.workspace.openLinkText(href, "", false);
      }
    });

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
    this.renderContextChips();
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
    } else if (this.mode === "edit") {
      this.renderInfo("Edit mode — type an instruction (e.g. “replace X with Y”). You’ll preview before applying.");
    } else {
      const file = this.app.workspace.getActiveFile();
      this.renderInfo(file ? `Context: ${file.basename} + linked notes` : "Open a note to ask about it.");
    }
  }

  private renderContextChips(): void {
    this.contextEl.empty();
    for (const f of this.manualContext) {
      const chip = this.contextEl.createDiv({ cls: "vault-brain-qa-chip2" });
      chip.createSpan({ text: f.basename });
      const x = chip.createSpan({ cls: "vault-brain-qa-chipx", text: "×" });
      x.onclick = () => {
        this.manualContext = this.manualContext.filter((m) => m.path !== f.path);
        this.renderContextChips();
      };
    }
  }

  private openContextPicker(): void {
    new ContextSuggest(this.app, (picked) => {
      const files: TFile[] = [];
      if (picked instanceof TFile && picked.extension === "md") {
        files.push(picked);
      } else if (picked instanceof TFolder) {
        for (const f of this.app.vault.getMarkdownFiles()) {
          if (f.path.startsWith(picked.path + "/")) files.push(f);
        }
      }
      for (const f of files) {
        if (!this.manualContext.some((m) => m.path === f.path)) this.manualContext.push(f);
      }
      this.renderContextChips();
    }).open();
  }

  // Reset when the active note changes — only in "this note" mode.
  private syncToActiveFile(): void {
    if (this.mode === "vault") return;
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
    if (this.mode === "edit") {
      void this.runEdit(question);
      return;
    }
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
      const extra: NoteDoc[] = [];
      for (const f of this.manualContext) {
        if (f.path === file.path) continue;
        extra.push({ title: f.basename, body: await this.app.vault.cachedRead(f) });
      }
      const ctx = assembleContext(active, [...linked, ...extra], cap);
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
      }
      bubble.empty();
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
      await MarkdownRenderer.render(this.app, finalText, bubble, sourcePath, this);
      this.addCopyButton(bubble, finalText);
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

  private async runEdit(instruction: string): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      this.addBubble("assistant", "Open a note to edit it.");
      return;
    }
    this.inputEl.value = "";
    this.addBubble("user", instruction);
    const content = await this.app.vault.read(file);
    const bubble = this.addBubble("assistant", "");
    this.setStreaming(true);
    this.abort = new AbortController();
    let revised = "";
    try {
      await this.plugin.activity.run("Editing note", () =>
        this.plugin.provider.chatStream(buildEditMessages(content, instruction), {
          signal: this.abort!.signal,
          onToken: (t) => {
            revised += t;
            bubble.setText(revised);
            this.scrollToBottom();
          },
        })
      );
      const finalRevised = revised.trim();
      bubble.empty();
      bubble.createDiv({ cls: "vault-brain-qa-editlabel", text: `Proposed edit of "${file.basename}" — review, then apply:` });
      const diffEl = bubble.createDiv({ cls: "vault-brain-qa-diff" });
      for (const line of lineDiff(content, finalRevised)) {
        const cls = line.type === "add" ? "vbd-add" : line.type === "del" ? "vbd-del" : "vbd-same";
        const prefix = line.type === "add" ? "+ " : line.type === "del" ? "- " : "  ";
        diffEl.createDiv({ cls: `vbd-line ${cls}`, text: prefix + line.text });
      }
      const applyBtn = bubble.createEl("button", { cls: "vault-brain-qa-apply", text: "Apply to note" });
      applyBtn.onclick = async () => {
        const current = await this.app.vault.read(file);
        if (current !== content) {
          new Notice("Vault Brain: this note changed since the preview — re-run the edit.");
          applyBtn.setText("Out of date");
          applyBtn.disabled = true;
          return;
        }
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = leaf.view;
        if (view instanceof MarkdownView) {
          view.editor.setValue(finalRevised);
          applyBtn.setText("Applied ✓ (Cmd-Z to undo)");
        } else {
          await this.app.vault.modify(file, finalRevised);
          applyBtn.setText("Applied ✓");
        }
        applyBtn.disabled = true;
      };
    } catch (e) {
      const err = e as Error;
      if (err.name !== "AbortError") bubble.setText(`[error: ${err.message}]`);
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

  private addCopyButton(bubble: HTMLElement, text: string): void {
    const wrap = bubble.parentElement;
    if (!wrap) return;
    const btn = wrap.createEl("button", { cls: "vault-brain-qa-copy", text: "Copy" });
    btn.onclick = async () => {
      await navigator.clipboard.writeText(text);
      btn.setText("Copied");
      window.setTimeout(() => btn.setText("Copy"), 1500);
    };
  }

  private setStreaming(on: boolean): void {
    this.sendBtn.disabled = on;
    this.stopBtn.disabled = !on;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
