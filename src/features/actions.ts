import { Editor, Menu, Notice } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { ACTIONS, buildActionMessages, parseCustomPrompts, QuickAction } from "../core/actions.ts";

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
        const customs = parseCustomPrompts(plugin.settings.customPrompts);
        if (customs.length > 0) {
          sub.addSeparator();
          for (const c of customs) {
            sub.addItem((s) =>
              s.setTitle(c.name).setIcon("sparkles").onClick(() => void runCustom(plugin, editor, c.name, c.prompt))
            );
          }
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
  let phase = "";
  const setPhase = (p: string) => {
    if (phase === p) return;
    phase = p;
    notice.setMessage(`Vault Brain: ${action.label} — ${p}…`);
  };
  let out = "";
  try {
    await plugin.activity.run(action.label, () =>
      plugin.provider.chatStream(buildActionMessages(action.id, selection), {
        signal: AbortSignal.timeout(600000),
        onThinking: () => setPhase("thinking"),
        onToken: (t) => { setPhase("writing"); out += t; },
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

async function runCustom(plugin: VaultBrainPlugin, editor: Editor, name: string, prompt: string): Promise<void> {
  const selection = editor.getSelection();
  if (!selection.trim()) {
    new Notice("Vault Brain: select some text first.");
    return;
  }
  const notice = new Notice(`Vault Brain: ${name}…`, 0);
  let phase = "";
  const setPhase = (p: string) => {
    if (phase === p) return;
    phase = p;
    notice.setMessage(`Vault Brain: ${name} — ${p}…`);
  };
  let out = "";
  try {
    await plugin.activity.run(name, () =>
      plugin.provider.chatStream(
        [
          { role: "system", parts: [{ type: "text", text: `${prompt}\nOutput ONLY the result, no preamble.` }] },
          { role: "user", parts: [{ type: "text", text: selection }] },
        ],
        {
          signal: AbortSignal.timeout(600000),
          onThinking: () => setPhase("thinking"),
          onToken: (t) => { setPhase("writing"); out += t; },
        }
      )
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
  editor.replaceSelection(result);
}
