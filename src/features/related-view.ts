import { ItemView, WorkspaceLeaf } from "obsidian";
import type VaultBrainPlugin from "../main.ts";

export const RELATED_VIEW_TYPE = "vault-brain-related";

export class RelatedNotesView extends ItemView {
  private listEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: VaultBrainPlugin) {
    super(leaf);
  }

  getViewType(): string { return RELATED_VIEW_TYPE; }
  getDisplayText(): string { return "Related notes"; }
  getIcon(): string { return "git-fork"; }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("vault-brain-related");
    this.listEl = this.contentEl.createDiv();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.refresh()));
    await this.refresh();
  }

  async onClose(): Promise<void> {}

  private async refresh(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    this.listEl.empty();
    if (!file) {
      this.listEl.createDiv({ cls: "vault-brain-related-info", text: "Open a note to see related notes." });
      return;
    }
    this.listEl.createDiv({ cls: "vault-brain-related-info", text: "Finding related notes…" });
    let related: { path: string; title: string; score: number; snippet: string }[] = [];
    try {
      related = await this.plugin.vaultIndex.related(file.path, 8);
    } catch {
      /* ignore */
    }
    this.listEl.empty();
    if (related.length === 0) {
      this.listEl.createDiv({ cls: "vault-brain-related-info", text: "No related notes yet — the index may still be building." });
      return;
    }
    for (const r of related) {
      const item = this.listEl.createDiv({ cls: "vault-brain-related-item" });
      const head = item.createDiv({ cls: "vault-brain-related-head" });
      head.createSpan({ cls: "vault-brain-related-title", text: r.title });
      head.createSpan({ cls: "vault-brain-related-score", text: `${Math.round(r.score * 100)}%` });
      item.createDiv({ cls: "vault-brain-related-snippet", text: r.snippet });
      item.onclick = () => void this.app.workspace.openLinkText(r.path, "", false);
    }
  }
}
