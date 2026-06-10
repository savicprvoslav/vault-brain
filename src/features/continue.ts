import { Editor, Notice } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { buildContinueMessages } from "../core/continue-prompt.ts";
import { advancePos } from "../core/editor-pos.ts";

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
  const file = plugin.app.workspace.getActiveFile();
  const controller = new AbortController();
  // AbortSignal.any is available in Node 18.17+/browsers but not typed in TS 5.4's DOM lib.
  const signal = (AbortSignal as typeof AbortSignal & { any(signals: AbortSignal[]): AbortSignal }).any([
    controller.signal,
    AbortSignal.timeout(600000),
  ]);
  const startPos = editor.getCursor("to");
  let endPos = startPos;
  let acc = "";
  let guardStopped = false;
  try {
    await plugin.activity.run("Continuing writing", () =>
      plugin.provider.chatStream(buildContinueMessages(context), {
        signal,
        onToken: (t) => {
          // Append-only: stop instead of writing into the wrong note or over user edits.
          if (plugin.app.workspace.getActiveFile()?.path !== file?.path) {
            guardStopped = true;
            controller.abort();
            return;
          }
          if (editor.getRange(startPos, endPos) !== acc) {
            guardStopped = true;
            controller.abort();
            new Notice("Vault Brain: continue writing stopped — the note changed while generating.");
            return;
          }
          editor.replaceRange(t, endPos);
          acc += t;
          endPos = advancePos(endPos, t);
        },
      })
    );
    if (!acc.trim()) new Notice("Vault Brain: nothing to continue.");
  } catch (e) {
    // Guard aborts already handled their own UX; timeouts/other errors still surface.
    if (!guardStopped) new Notice("Vault Brain error: " + (e as Error).message);
  }
}
