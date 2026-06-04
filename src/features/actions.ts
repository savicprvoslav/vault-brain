import { Editor, Menu, Notice } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { ACTIONS, buildActionMessages, QuickAction } from "../core/actions.ts";

export function registerQuickActions(plugin: VaultBrainPlugin): void {
  for (const action of ACTIONS) {
    plugin.addCommand({
      id: `action-${action.id}`,
      name: `Selection: ${action.label}`,
      editorCallback: (editor: Editor) => void runAction(plugin, editor, action),
    });
  }

  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
      if (!editor.getSelection()) return;
      menu.addItem((item) => {
        item.setTitle("Vault Brain").setIcon("brain");
        // setSubmenu() exists at runtime but is absent from the bundled Obsidian type
        // declarations (obsidian@1.5.7-1), so we cast minimally to call it.
        const sub = (item as unknown as { setSubmenu(): Menu }).setSubmenu();
        for (const action of ACTIONS) {
          sub.addItem((s) =>
            s
              .setTitle(action.label)
              .setIcon(action.icon)
              .onClick(() => void runAction(plugin, editor, action))
          );
        }
      });
    })
  );
}

async function runAction(
  plugin: VaultBrainPlugin,
  editor: Editor,
  action: QuickAction
): Promise<void> {
  const selection = editor.getSelection();
  if (!selection.trim()) {
    new Notice("Vault Brain: select some text first.");
    return;
  }
  const notice = new Notice(`Vault Brain: ${action.label}…`, 0);
  let out = "";
  try {
    await plugin.activity.run(action.label, () =>
      plugin.provider.chatStream(buildActionMessages(action.id, selection), {
        signal: AbortSignal.timeout(120000),
        onToken: (t) => { out += t; },
      })
    );
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
    return;
  }
  notice.hide();
  const result = out.trim();
  if (!result) {
    new Notice("Vault Brain: no result produced.");
    return;
  }
  if (action.mode === "replace") {
    editor.replaceSelection(result);
  } else {
    editor.replaceRange(`\n\n${result}`, editor.getCursor("to"));
  }
}
