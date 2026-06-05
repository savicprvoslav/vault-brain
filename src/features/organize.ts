import { Editor, MarkdownFileInfo, MarkdownView, Notice, TFile } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { linkMentions } from "../core/autolink.ts";
import { buildTagMessages, parseTags } from "../core/tag-prompt.ts";

export function registerOrganizeCommands(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "suggest-tags",
    name: "Suggest tags for this note",
    editorCallback: (_editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => void suggestTags(plugin, ctx.file),
  });
  plugin.addCommand({
    id: "link-mentions",
    name: "Link mentions of existing notes",
    editorCallback: (editor: Editor) => linkMentionsInEditor(plugin, editor),
  });
}

async function suggestTags(plugin: VaultBrainPlugin, file: TFile | null): Promise<void> {
  if (!file) return;
  const text = await plugin.app.vault.cachedRead(file);
  const notice = new Notice("Vault Brain: suggesting tags…", 0);
  let out = "";
  try {
    await plugin.activity.run("Suggesting tags", () =>
      plugin.provider.chatStream(buildTagMessages(text.slice(0, 8000)), {
        signal: AbortSignal.timeout(600000),
        onThinking: () => notice.setMessage("Vault Brain: suggesting tags — thinking…"),
        onToken: (t) => { out += t; },
      })
    );
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
    return;
  }
  notice.hide();
  const tags = parseTags(out);
  if (tags.length === 0) {
    new Notice("Vault Brain: no tags suggested.");
    return;
  }
  await plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    const existing = Array.isArray(fm.tags) ? (fm.tags as string[]) : typeof fm.tags === "string" ? [fm.tags] : [];
    fm.tags = [...new Set([...existing, ...tags])];
  });
  new Notice(`Vault Brain: added tags — ${tags.join(", ")}`);
}

function linkMentionsInEditor(plugin: VaultBrainPlugin, editor: Editor): void {
  const active = plugin.app.workspace.getActiveFile();
  const titles = plugin.app.vault.getMarkdownFiles().map((f) => f.basename).filter((b) => b !== active?.basename);
  const original = editor.getValue();
  const linked = linkMentions(original, titles);
  if (linked !== original) {
    editor.setValue(linked);
    new Notice("Vault Brain: linked existing-note mentions.");
  } else {
    new Notice("Vault Brain: no new mentions to link.");
  }
}
