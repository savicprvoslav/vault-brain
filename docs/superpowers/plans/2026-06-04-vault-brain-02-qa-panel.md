# Vault Brain — Plan 2: Note Q&A Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A right-sidebar chat panel (P0-4) that answers questions over the active note + its 1-hop linked notes, streamed token-by-token, with a hard token cap + truncation warning and conversation reset on note switch.

**Architecture:** Pure logic (token estimate, context assembly, prompt building) in obsidian-free `core/` modules (unit-tested), consumed by a thin `ItemView` (`features/qa-view.ts`) that does the Obsidian I/O (gather notes, render chat, stream). Reuses Plan 1's `OllamaProvider.chatStream` unchanged.

**Tech Stack:** TypeScript, Obsidian `ItemView`, `node:test` + `tsx`. Builds on Plan 1 (foundation must be complete).

**Reference spec:** `docs/superpowers/specs/2026-06-04-vault-brain-design.md` §8 (P0-4).

---

## File Structure (this plan)

| File | Responsibility |
|---|---|
| `src/core/tokens.ts` | `estimate(text)` + `truncateToBudget(text, cap)` — pure |
| `src/core/context.ts` | `NoteDoc`, `assembleContext(active, linked, cap)` — pure |
| `src/core/qa-prompt.ts` | `buildQaMessages(context, history, question)` → `ChatMessage[]` — pure |
| `src/features/qa-view.ts` | `VaultBrainQaView` ItemView: gather notes, stream, render chat (obsidian) |
| `src/main.ts` | register the view + ribbon icon + "Open Q&A panel" command (modify) |
| `styles.css` | panel styles (modify) |
| `tests/tokens.test.ts`, `tests/context.test.ts`, `tests/qa-prompt.test.ts` | unit tests |

**Testability boundary:** `tokens.ts`, `context.ts`, `qa-prompt.ts` must NOT import `obsidian`. `qa-view.ts` does.

---

## Task 1: Token estimate + budget (TDD)

**Files:** Create `src/core/tokens.ts`, `tests/tokens.test.ts`

- [ ] **Step 1: Failing test** — `tests/tokens.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate, truncateToBudget } from "../src/core/tokens.ts";

test("estimate ~4 chars per token", () => {
  assert.equal(estimate(""), 0);
  assert.equal(estimate("abcd"), 1);
  assert.equal(estimate("abcde"), 2);
});

test("truncateToBudget leaves short text alone", () => {
  const r = truncateToBudget("hello", 100);
  assert.equal(r.text, "hello");
  assert.equal(r.truncated, false);
});

test("truncateToBudget cuts long text and flags it", () => {
  const long = "x".repeat(100);
  const r = truncateToBudget(long, 5); // cap 5 tokens = 20 chars
  assert.equal(r.truncated, true);
  assert.equal(r.text.length, 20);
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test` (module not found).

- [ ] **Step 3: Implement** — `src/core/tokens.ts`:
```ts
// Rough token estimate: ~4 characters per token (good enough for EN and SR caps).
export function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate text so its estimate fits within capTokens. Reports whether it was cut.
export function truncateToBudget(text: string, capTokens: number): { text: string; truncated: boolean } {
  const capChars = Math.max(0, capTokens) * 4;
  if (text.length <= capChars) return { text, truncated: false };
  return { text: text.slice(0, capChars), truncated: true };
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/tokens.ts tests/tokens.test.ts && git commit -m "feat: add token estimate and budget truncation with tests"`

---

## Task 2: Context assembly (TDD)

**Files:** Create `src/core/context.ts`, `tests/context.test.ts`

- [ ] **Step 1: Failing test** — `tests/context.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleContext } from "../src/core/context.ts";

const note = (title: string, body: string) => ({ title, body });

test("includes active note alone", () => {
  const r = assembleContext(note("A", "alpha"), [], 1000);
  assert.equal(r.included, 1);
  assert.equal(r.truncated, false);
  assert.match(r.text, /## A\nalpha/);
});

test("includes linked notes until cap", () => {
  const r = assembleContext(note("A", "alpha"), [note("B", "beta"), note("C", "gamma")], 1000);
  assert.equal(r.included, 3);
  assert.equal(r.truncated, false);
  assert.match(r.text, /## B\nbeta/);
  assert.match(r.text, /## C\ngamma/);
});

test("truncates when active note alone exceeds cap", () => {
  const r = assembleContext(note("A", "x".repeat(1000)), [], 5); // cap 5 tokens
  assert.equal(r.truncated, true);
  assert.equal(r.included, 1);
});

test("omits linked notes that don't fit and flags truncation", () => {
  const big = "y".repeat(400); // ~100 tokens each
  const r = assembleContext(note("A", "alpha"), [note("B", big), note("C", big)], 40);
  assert.equal(r.truncated, true);
  assert.ok(r.included < 3);
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement** — `src/core/context.ts`:
```ts
import { estimate, truncateToBudget } from "./tokens.ts";

export interface NoteDoc {
  title: string;
  body: string;
}

export interface ContextResult {
  text: string;
  truncated: boolean;
  included: number; // count of notes (incl. active) that made it in
}

function block(n: NoteDoc): string {
  return `## ${n.title}\n${n.body}`;
}

// Active note is always included (truncated if it alone exceeds the cap);
// linked notes are appended in order until the cap is reached.
export function assembleContext(active: NoteDoc, linked: NoteDoc[], capTokens: number): ContextResult {
  let text = block(active);
  if (estimate(text) > capTokens) {
    return { text: truncateToBudget(text, capTokens).text, truncated: true, included: 1 };
  }
  let included = 1;
  let truncated = false;
  for (const n of linked) {
    const next = `${text}\n\n${block(n)}`;
    if (estimate(next) > capTokens) {
      truncated = true;
      break;
    }
    text = next;
    included++;
  }
  return { text, truncated, included };
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/context.ts tests/context.test.ts && git commit -m "feat: add active-note + 1-hop context assembly with cap"`

---

## Task 3: Q&A prompt builder (TDD)

**Files:** Create `src/core/qa-prompt.ts`, `tests/qa-prompt.test.ts`

- [ ] **Step 1: Failing test** — `tests/qa-prompt.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQaMessages } from "../src/core/qa-prompt.ts";

test("system carries context, ends with the question", () => {
  const msgs = buildQaMessages("CTX-HERE", [], "What is X?");
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].parts[0].type === "text" ? msgs[0].parts[0].text : "", /CTX-HERE/);
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[1].parts[0].type === "text" ? msgs[1].parts[0].text : "", "What is X?");
});

test("includes prior turns in order", () => {
  const msgs = buildQaMessages("CTX", [{ role: "user", text: "Q1" }, { role: "assistant", text: "A1" }], "Q2");
  assert.equal(msgs.length, 4);
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[2].role, "assistant");
  assert.equal(msgs[3].role, "user");
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement** — `src/core/qa-prompt.ts`:
```ts
import type { ChatMessage } from "./provider.ts";

export interface QaTurn {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM = `You are Vault Brain, answering questions about the user's Obsidian notes.
Use ONLY the CONTEXT below. If the answer is not in the context, say you don't know rather than guessing.
Be concise and reference note titles when useful.`;

// system (with context) -> prior turns -> new question
export function buildQaMessages(contextText: string, history: QaTurn[], question: string): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", parts: [{ type: "text", text: `${SYSTEM}\n\nCONTEXT:\n\n${contextText}` }] },
  ];
  for (const turn of history) {
    messages.push({ role: turn.role, parts: [{ type: "text", text: turn.text }] });
  }
  messages.push({ role: "user", parts: [{ type: "text", text: question }] });
  return messages;
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/qa-prompt.ts tests/qa-prompt.test.ts && git commit -m "feat: add Q&A prompt builder with tests"`

---

## Task 4: The Q&A side-panel view

**Files:** Create `src/features/qa-view.ts`

- [ ] **Step 1: Implement** — `src/features/qa-view.ts`:
```ts
import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { assembleContext, NoteDoc } from "../core/context.ts";
import { buildQaMessages, QaTurn } from "../core/qa-prompt.ts";

export const QA_VIEW_TYPE = "vault-brain-qa";

export class VaultBrainQaView extends ItemView {
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private chipEl!: HTMLElement;
  private history: QaTurn[] = [];
  private currentPath: string | null = null;
  private abort: AbortController | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: VaultBrainPlugin) {
    super(leaf);
  }

  getViewType(): string { return QA_VIEW_TYPE; }
  getDisplayText(): string { return "Vault Brain Q&A"; }
  getIcon(): string { return "message-circle"; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("vault-brain-qa");

    this.chipEl = root.createDiv({ cls: "vault-brain-qa-chip" });
    this.chipEl.hide();
    this.messagesEl = root.createDiv({ cls: "vault-brain-qa-messages" });

    const inputRow = root.createDiv({ cls: "vault-brain-qa-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { rows: "3", placeholder: "Ask about this note and its links… (Cmd/Ctrl-Enter to send)" },
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
    this.syncToActiveFile();
  }

  async onClose(): Promise<void> {
    this.abort?.abort();
  }

  // Reset the conversation whenever the active note changes (no hidden cross-note state).
  private syncToActiveFile(): void {
    const file = this.app.workspace.getActiveFile();
    const path = file?.path ?? null;
    if (path === this.currentPath) return;
    this.currentPath = path;
    this.history = [];
    this.messagesEl.empty();
    this.chipEl.hide();
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
    const file = this.app.workspace.getActiveFile();
    if (!question || !file) return;
    this.inputEl.value = "";
    this.addBubble("user", question);

    const { active, linked } = await this.gatherNotes(file);
    const cap = this.plugin.settings.contextTokenCap;
    const ctx = assembleContext(active, linked, cap);
    if (ctx.truncated) {
      this.chipEl.setText(`⚠︎ Context truncated to ~${cap} tokens — some linked notes were omitted.`);
      this.chipEl.show();
    } else {
      this.chipEl.hide();
    }

    const messages = buildQaMessages(ctx.text, this.history, question);
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
      this.history.push({ role: "user", text: question }, { role: "assistant", text: answer });
    } catch (e) {
      bubble.setText(`${answer}\n\n[error: ${(e as Error).message}]`);
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
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit --skipLibCheck` (expect clean; `./main.ts` type import resolves after Task 5 — if a transient "cannot find module './main.ts'" appears, proceed, it's structural).

- [ ] **Step 3: Commit** — `git add src/features/qa-view.ts && git commit -m "feat: add Q&A side-panel ItemView (gather, assemble, stream, reset-on-switch)"`

---

## Task 5: Wire the view into the plugin + styles

**Files:** Modify `src/main.ts`, `styles.css`

- [ ] **Step 1: Add to `src/main.ts`** — add this import near the other imports:
```ts
import { VaultBrainQaView, QA_VIEW_TYPE } from "./features/qa-view.ts";
```
Inside `onload()`, after the `addCommand` for test-connection, add:
```ts
    this.registerView(QA_VIEW_TYPE, (leaf) => new VaultBrainQaView(leaf, this));
    this.addRibbonIcon("message-circle", "Vault Brain Q&A", () => void this.activateQaView());
    this.addCommand({
      id: "open-qa",
      name: "Open Q&A panel",
      callback: () => void this.activateQaView(),
    });
```
Add this method to the class (e.g. after `testConnection`):
```ts
  async activateQaView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(QA_VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: QA_VIEW_TYPE, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
  }
```

- [ ] **Step 2: Append to `styles.css`**:
```css

.vault-brain-qa {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.vault-brain-qa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.vault-brain-qa-msg {
  margin-bottom: 10px;
}
.vault-brain-qa-user .vault-brain-qa-body {
  font-weight: 600;
}
.vault-brain-qa-assistant .vault-brain-qa-body {
  white-space: pre-wrap;
}
.vault-brain-qa-info {
  color: var(--text-muted);
  font-style: italic;
  padding: 8px;
}
.vault-brain-qa-chip {
  background: var(--background-modifier-error);
  color: var(--text-on-accent);
  padding: 4px 8px;
  font-size: 12px;
}
.vault-brain-qa-input textarea {
  width: 100%;
  resize: vertical;
}
.vault-brain-qa-buttons {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
}
```

- [ ] **Step 3: Build** — `npm run build` (must be clean, produce main.js).

- [ ] **Step 4: Manual verification in Obsidian** (reload plugin):
  1. A new ribbon icon (speech bubble) appears; clicking it opens a right-sidebar "Vault Brain Q&A" panel. (Also via Cmd-P → "Vault Brain: Open Q&A panel".)
  2. Open a note that links to other notes. Ask a question whose answer is in the note or a linked note → a streamed answer appears.
  3. Ask something not in the notes → it should say it doesn't know (not hallucinate).
  4. Switch to a different note → the conversation clears and the info line shows the new note's name.
  5. Set the context token cap very low (e.g. 50) in settings, ask again → the ⚠︎ truncation chip appears.
  6. Start a long answer and click **Stop** → streaming halts.

- [ ] **Step 5: Commit** — `git add src/main.ts styles.css && git commit -m "feat: register Q&A view with ribbon icon and command"`

---

## Definition of Done (Plan 2)

- `npm test` green (Plan 1 tests + new tokens/context/qa-prompt tests).
- `npm run build` clean.
- In Obsidian: panel opens, streams answers over note+links context, resets on note switch, shows truncation chip when capped, Stop works.
- Core Q&A logic (`tokens`, `context`, `qa-prompt`) has no `obsidian` import.

---

## Self-Review

**Spec coverage (P0-4):** context = active + 1-hop links ✅ (Task 4 `gatherNotes` via `resolvedLinks`); hard token cap ✅ (Task 2 + settings `contextTokenCap`); truncation warning ✅ (Task 4 chip); conversation cleared per note switch ✅ (Task 4 `syncToActiveFile`); streamed ✅ (reuses `chatStream`); read-only/append-only ✅ (view never writes to the vault).

**Placeholder scan:** none — full code in every step.

**Type consistency:** `NoteDoc` (Task 2) used by `assembleContext` and `qa-view.gatherNotes`. `QaTurn` (Task 3) used by `buildQaMessages` and the view's `history`. `ChatMessage`/`chatStream` reused from Plan 1 unchanged. `QA_VIEW_TYPE` defined in Task 4, used in Task 5.
