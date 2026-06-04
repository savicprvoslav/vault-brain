import { TFile, normalizePath } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { chunkNote } from "../core/chunk.ts";
import { topK, cosine, averageVectors } from "../core/similarity.ts";
import type { RagHit } from "../core/rag-context.ts";

interface IndexedNote {
  mtime: number;
  chunks: { text: string; vector: number[] }[];
}

export class VaultIndex {
  private data: Record<string, IndexedNote> = {};
  private saveTimer: number | null = null;

  constructor(private plugin: VaultBrainPlugin) {}

  private indexPath(): string {
    return normalizePath(`${this.plugin.manifest.dir}/vault-index.json`);
  }

  get size(): number {
    return Object.keys(this.data).length;
  }

  async load(): Promise<void> {
    try {
      const raw = await this.plugin.app.vault.adapter.read(this.indexPath());
      this.data = JSON.parse(raw) as Record<string, IndexedNote>;
    } catch {
      this.data = {};
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.save(), 1500);
  }

  async save(): Promise<void> {
    await this.plugin.app.vault.adapter.write(this.indexPath(), JSON.stringify(this.data));
  }

  async updateFile(file: TFile): Promise<void> {
    const text = await this.plugin.app.vault.cachedRead(file);
    const chunks = chunkNote(text);
    if (chunks.length === 0) {
      delete this.data[file.path];
      this.scheduleSave();
      return;
    }
    const vectors = await this.plugin.provider.embed(this.plugin.settings.embedModel, chunks);
    this.data[file.path] = {
      mtime: file.stat.mtime,
      chunks: chunks.map((t, i) => ({ text: t, vector: vectors[i] ?? [] })),
    };
    this.scheduleSave();
  }

  removeFile(path: string): void {
    if (this.data[path]) {
      delete this.data[path];
      this.scheduleSave();
    }
  }

  // Re-embed changed/new notes, drop deleted. Returns number of notes (re)embedded.
  async reconcile(): Promise<number> {
    return this.plugin.activity.run("Indexing vault", async () => {
      const files = this.plugin.app.vault.getMarkdownFiles();
      const present = new Set(files.map((f) => f.path));
      for (const p of Object.keys(this.data)) {
        if (!present.has(p)) delete this.data[p];
      }
      let changed = 0;
      for (const f of files) {
        const cur = this.data[f.path];
        if (!cur || cur.mtime !== f.stat.mtime) {
          await this.updateFile(f);
          changed++;
        }
      }
      if (changed > 0) await this.save();
      return changed;
    });
  }

  async reindexAll(): Promise<number> {
    return this.plugin.activity.run("Indexing vault", async () => {
      this.data = {};
      const files = this.plugin.app.vault.getMarkdownFiles();
      for (const f of files) await this.updateFile(f);
      await this.save();
      return files.length;
    });
  }

  async related(path: string, k: number): Promise<{ path: string; title: string; score: number; snippet: string }[]> {
    let qvec: number[] | undefined;
    const self = this.data[path];
    if (self && self.chunks.length > 0) {
      qvec = averageVectors(self.chunks.map((c) => c.vector));
    } else {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const text = await this.plugin.app.vault.cachedRead(file);
        [qvec] = await this.plugin.provider.embed(this.plugin.settings.embedModel, [text.slice(0, 8000)]);
      }
    }
    if (!qvec || qvec.length === 0) return [];
    const best = new Map<string, { score: number; snippet: string }>();
    for (const [p, note] of Object.entries(this.data)) {
      if (p === path) continue;
      for (const c of note.chunks) {
        const s = cosine(qvec, c.vector);
        const cur = best.get(p);
        if (!cur || s > cur.score) best.set(p, { score: s, snippet: c.text.replace(/\s+/g, " ").slice(0, 120) });
      }
    }
    return [...best.entries()]
      .map(([p, v]) => ({ path: p, title: p.replace(/\.md$/, "").split("/").pop() ?? p, score: v.score, snippet: v.snippet }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async search(query: string, k: number): Promise<RagHit[]> {
    const [qvec] = await this.plugin.provider.embed(this.plugin.settings.embedModel, [query]);
    if (!qvec) return [];
    const items: { vector: number[]; value: { path: string; text: string } }[] = [];
    for (const [path, note] of Object.entries(this.data)) {
      for (const c of note.chunks) items.push({ vector: c.vector, value: { path, text: c.text } });
    }
    return topK(qvec, items, k).map((h) => ({
      path: h.value.path,
      title: h.value.path.replace(/\.md$/, "").split("/").pop() ?? h.value.path,
      text: h.value.text,
      score: h.score,
    }));
  }
}
