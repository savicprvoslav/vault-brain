import { Editor, Notice } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { buildContinueMessages } from "../core/continue-prompt.ts";

export function registerContinueCommand(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "continue-writing",
    name: "Continue writing at cursor",
    editorCallback: (editor: Editor) => void continueWriting(plugin, editor),
  });
}

async function continueWriting(plugin: VaultBrainPlugin, editor: Editor): Promise<void> {
  const startOffset = editor.posToOffset(editor.getCursor());
  const before = editor.getValue().slice(0, startOffset);
  if (!before.trim()) {
    new Notice("Vault Brain: write something first.");
    return;
  }
  const context = before.slice(-6000);
  let acc = "";
  let prevLen = 0;
  try {
    await plugin.activity.run("Continuing writing", () =>
      plugin.provider.chatStream(buildContinueMessages(context), {
        signal: AbortSignal.timeout(120000),
        onToken: (t) => {
          acc += t;
          editor.replaceRange(acc, editor.offsetToPos(startOffset), editor.offsetToPos(startOffset + prevLen));
          prevLen = acc.length;
        },
      })
    );
    if (!acc.trim()) new Notice("Vault Brain: nothing to continue.");
  } catch (e) {
    new Notice("Vault Brain error: " + (e as Error).message);
  }
}
