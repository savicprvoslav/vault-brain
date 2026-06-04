# Vault Brain — Plan 6: Editor Selection Quick-Actions (P1-1)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Select text → Summarize / Improve / Format / Translate SR↔EN / Fix grammar, from the right-click menu or command palette. Transform actions replace the selection; Summarize inserts bullets below.

**Architecture:** Pure `actions.ts` (action metadata + message builder, unit-tested) + `features/actions.ts` (commands + editor-menu submenu, reuses `provider.chatStream`).

---

## Task 1: `src/core/actions.ts` (TDD)

**Files:** Create `src/core/actions.ts`, `tests/actions.test.ts`

- [ ] **Step 1: Failing test** — `tests/actions.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, buildActionMessages, getAction } from "../src/core/actions.ts";

test("summarize inserts below, others replace", () => {
  assert.equal(getAction("summarize").mode, "below");
  for (const id of ["improve", "format", "translate", "grammar"] as const) {
    assert.equal(getAction(id).mode, "replace");
  }
});

test("there are 5 actions with unique ids", () => {
  assert.equal(ACTIONS.length, 5);
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, 5);
});

test("buildActionMessages = system instruction + user selection", () => {
  const msgs = buildActionMessages("summarize", "the text");
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[1].parts[0].type === "text" ? msgs[1].parts[0].text : "", "the text");
});

test("translate instruction mentions both languages", () => {
  const msgs = buildActionMessages("translate", "zdravo");
  const sys = msgs[0].parts[0].type === "text" ? msgs[0].parts[0].text : "";
  assert.match(sys, /Serbian/i);
  assert.match(sys, /English/i);
});
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3: Implement** — `src/core/actions.ts`:
```ts
import type { ChatMessage } from "./provider.ts";

export type ActionId = "summarize" | "improve" | "format" | "translate" | "grammar";

export interface QuickAction {
  id: ActionId;
  label: string;
  icon: string;
  mode: "replace" | "below";
}

export const ACTIONS: QuickAction[] = [
  { id: "summarize", label: "Summarize", icon: "list", mode: "below" },
  { id: "improve", label: "Improve", icon: "wand", mode: "replace" },
  { id: "format", label: "Format as Markdown", icon: "heading", mode: "replace" },
  { id: "translate", label: "Translate SR↔EN", icon: "languages", mode: "replace" },
  { id: "grammar", label: "Fix grammar & spelling", icon: "check", mode: "replace" },
];

const INSTRUCTIONS: Record<ActionId, string> = {
  summarize: "Summarize the user's text into at most 5 concise Markdown bullet points. Output ONLY the bullets, no preamble.",
  improve: "Rewrite the user's text to improve clarity, flow, and word choice while preserving meaning and any Markdown. Output ONLY the rewritten text — no preamble, no quotes.",
  format: "Reformat the user's text into clean, well-structured Markdown (headings, lists, tables where appropriate) WITHOUT changing the wording. Output ONLY the formatted Markdown.",
  translate: "If the user's text is in Serbian, translate it to English; if it is in English, translate it to Serbian. Preserve Markdown. Output ONLY the translation.",
  grammar: "Correct ONLY grammar, spelling, and punctuation in the user's text. Do not reword or change meaning. Output ONLY the corrected text.",
};

export function getAction(id: ActionId): QuickAction {
  const a = ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`unknown action: ${id}`);
  return a;
}

export function buildActionMessages(id: ActionId, selectedText: string): ChatMessage[] {
  return [
    { role: "system", parts: [{ type: "text", text: INSTRUCTIONS[id] }] },
    { role: "user", parts: [{ type: "text", text: selectedText }] },
  ];
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit — `git add src/core/actions.ts tests/actions.test.ts && git commit -m "feat: add selection action metadata and message builder with tests"`

---

## Task 2: `src/features/actions.ts` + wiring

**Files:** Create `src/features/actions.ts`, modify `src/main.ts`

- [ ] **Step 1: Implement** — `src/features/actions.ts`:
```ts
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
        const sub = item.setSubmenu();
        for (const action of ACTIONS) {
          sub.addItem((s) =>
            s.setTitle(action.label).setIcon(action.icon).onClick(() => void runAction(plugin, editor, action))
          );
        }
      });
    })
  );
}

async function runAction(plugin: VaultBrainPlugin, editor: Editor, action: QuickAction): Promise<void> {
  const selection = editor.getSelection();
  if (!selection.trim()) {
    new Notice("Vault Brain: select some text first.");
    return;
  }
  const notice = new Notice(`Vault Brain: ${action.label}…`, 0);
  let out = "";
  try {
    await plugin.provider.chatStream(buildActionMessages(action.id, selection), {
      signal: AbortSignal.timeout(120000),
      onToken: (t) => { out += t; },
    });
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
```
Note: if `item.setSubmenu()` is not in the Obsidian type defs, cast minimally: `const sub = (item as unknown as { setSubmenu(): Menu }).setSubmenu();` and report it.

- [ ] **Step 2: Wire** `src/main.ts` — `import { registerQuickActions } from "./features/actions.ts";` after the recorder import, and `registerQuickActions(this);` after `registerRecorder(this);` in onload.

- [ ] **Step 3:** `npm run build` (clean) + `npm test` (52 pass — 48 + 4 new).

- [ ] **Step 4: Manual:** reload → select text → right-click → "Vault Brain" submenu → each action; also via Cmd-P "Selection: …". Improve/Format/Translate/Grammar replace the selection; Summarize adds bullets below. Empty selection → notice.

- [ ] **Step 5:** Commit — `git add src/features/actions.ts src/main.ts && git commit -m "feat: editor selection quick-actions (summarize/improve/format/translate/grammar)"`

---

## Definition of Done
- `npm test` 52 pass · `npm run build` clean · 5 actions work from menu + palette with correct replace/below behavior; empty selection handled. `actions.ts` core has no obsidian import.
