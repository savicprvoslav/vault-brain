# Vault Brain — Plan 3: Image → Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A command (P0-3) that finds the image embed near the cursor, extracts its text/structure as clean Markdown via Gemma 4 vision, and inserts the result below the embed. Failures show a notice; never silently empty.

**Architecture:** Pure helpers (`parseImageEmbed`, `mimeFromExtension`, `buildVisionMessages`) in obsidian-free `core/` (unit-tested). The `features/vision.ts` command does Obsidian I/O (editor, read image bytes) and reuses `OllamaProvider.chatStream` with an image part.

**Tech Stack:** TypeScript, Obsidian editor API, `node:test`. Builds on Plan 1.

**Reference spec:** `docs/superpowers/specs/2026-06-04-vault-brain-design.md` §8 (P0-3).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/image-embed.ts` | `parseImageEmbed(line)` + `mimeFromExtension(ext)` — pure |
| `src/core/vision-prompt.ts` | `buildVisionMessages(mime, b64)` → `ChatMessage[]` — pure |
| `src/features/vision.ts` | `registerVisionCommand(plugin)` — editor command (obsidian) |
| `src/main.ts` | call `registerVisionCommand(this)` in onload (modify) |
| `tests/image-embed.test.ts`, `tests/vision-prompt.test.ts` | unit tests |

---

## Task 1: Embed parsing + mime (TDD)

**Files:** Create `src/core/image-embed.ts`, `tests/image-embed.test.ts`

- [ ] **Step 1: Failing test** — `tests/image-embed.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImageEmbed, mimeFromExtension } from "../src/core/image-embed.ts";

test("parses wiki embed", () => {
  assert.equal(parseImageEmbed("![[diagram.png]]"), "diagram.png");
  assert.equal(parseImageEmbed("text ![[folder/shot.jpg|alt]] more"), "folder/shot.jpg");
});

test("parses markdown image", () => {
  assert.equal(parseImageEmbed("![alt](images/a.png)"), "images/a.png");
  assert.equal(parseImageEmbed("![](b%20c.jpg)"), "b c.jpg");
});

test("returns null when no embed", () => {
  assert.equal(parseImageEmbed("just text [[a note]]"), null);
});

test("mimeFromExtension maps known types, null otherwise", () => {
  assert.equal(mimeFromExtension("PNG"), "image/png");
  assert.equal(mimeFromExtension("jpg"), "image/jpeg");
  assert.equal(mimeFromExtension("jpeg"), "image/jpeg");
  assert.equal(mimeFromExtension("webp"), "image/webp");
  assert.equal(mimeFromExtension("txt"), null);
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement** — `src/core/image-embed.ts`:
```ts
// Extract the target path/name of an image embed on a single line, or null.
// Handles wiki embeds (![[target|alt]]) and markdown images (![alt](target)).
export function parseImageEmbed(line: string): string | null {
  const wiki = line.match(/!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/);
  if (wiki) return wiki[1].trim();
  const md = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (md) {
    try {
      return decodeURIComponent(md[1].trim());
    } catch {
      return md[1].trim();
    }
  }
  return null;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

export function mimeFromExtension(ext: string): string | null {
  return MIME[ext.toLowerCase()] ?? null;
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/image-embed.ts tests/image-embed.test.ts && git commit -m "feat: add image-embed parsing and mime mapping with tests"`

---

## Task 2: Vision prompt (TDD)

**Files:** Create `src/core/vision-prompt.ts`, `tests/vision-prompt.test.ts`

- [ ] **Step 1: Failing test** — `tests/vision-prompt.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVisionMessages } from "../src/core/vision-prompt.ts";

test("builds a single user message with text + image parts", () => {
  const msgs = buildVisionMessages("image/png", "B64DATA");
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, "user");
  const parts = msgs[0].parts;
  assert.equal(parts[0].type, "text");
  assert.deepEqual(parts[1], { type: "image", mime: "image/png", dataB64: "B64DATA" });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement** — `src/core/vision-prompt.ts`:
```ts
import type { ChatMessage } from "./provider.ts";

const INSTRUCTION = `Extract ALL text and structure from this image as clean Markdown.
- Preserve headings, lists, and tables (render tables as Markdown tables).
- Transcribe text verbatim; do not summarize or add commentary.
- If the image contains no text, reply with exactly: (no text found)`;

export function buildVisionMessages(mime: string, dataB64: string): ChatMessage[] {
  return [
    {
      role: "user",
      parts: [
        { type: "text", text: INSTRUCTION },
        { type: "image", mime, dataB64 },
      ],
    },
  ];
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/vision-prompt.ts tests/vision-prompt.test.ts && git commit -m "feat: add vision prompt builder with tests"`

---

## Task 3: Vision command + wiring

**Files:** Create `src/features/vision.ts`, modify `src/main.ts`

- [ ] **Step 1: Implement** — `src/features/vision.ts`:
```ts
import { Editor, Notice, TFile } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { parseImageEmbed, mimeFromExtension } from "../core/image-embed.ts";
import { buildVisionMessages } from "../core/vision-prompt.ts";

export function registerVisionCommand(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "extract-image",
    name: "Extract text from image below cursor",
    editorCallback: (editor: Editor) => void runImageExtraction(plugin, editor),
  });
}

async function runImageExtraction(plugin: VaultBrainPlugin, editor: Editor): Promise<void> {
  const cursor = editor.getCursor();
  // Search the cursor line and up to 20 lines above for an image embed.
  let embedLine = -1;
  let target: string | null = null;
  for (let line = cursor.line; line >= 0 && line >= cursor.line - 20; line--) {
    const t = parseImageEmbed(editor.getLine(line));
    if (t) {
      target = t;
      embedLine = line;
      break;
    }
  }
  if (!target) {
    new Notice("Vault Brain: no image embed found near the cursor.");
    return;
  }

  const activePath = plugin.app.workspace.getActiveFile()?.path ?? "";
  const file = plugin.app.metadataCache.getFirstLinkpathDest(target, activePath);
  if (!(file instanceof TFile)) {
    new Notice(`Vault Brain: couldn't resolve image "${target}".`);
    return;
  }
  const mime = mimeFromExtension(file.extension);
  if (!mime) {
    new Notice(`Vault Brain: ".${file.extension}" is not a supported image type.`);
    return;
  }

  const bytes = await plugin.app.vault.readBinary(file);
  const b64 = Buffer.from(new Uint8Array(bytes)).toString("base64");
  const messages = buildVisionMessages(mime, b64);

  const notice = new Notice("Vault Brain: extracting text from image…", 0);
  let out = "";
  try {
    await plugin.provider.chatStream(messages, {
      signal: AbortSignal.timeout(120000),
      onToken: (t) => {
        out += t;
      },
    });
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
    return;
  }
  notice.hide();

  const text = out.trim();
  if (!text || text === "(no text found)") {
    new Notice("Vault Brain: no text could be extracted from that image.");
    return;
  }

  const endOfEmbed = { line: embedLine, ch: editor.getLine(embedLine).length };
  editor.replaceRange(`\n\n${text}\n`, endOfEmbed);
  new Notice("Vault Brain: image text inserted.");
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — add import after the qa-view import:
```ts
import { registerVisionCommand } from "./features/vision.ts";
```
In `onload()`, after the `addCommand({ id: "open-qa", ... })` block, add:
```ts
    registerVisionCommand(this);
```

- [ ] **Step 3: Build** — `npm run build` (must be clean, produce main.js).

- [ ] **Step 4: Manual verification in Obsidian** (reload plugin):
  1. Paste/drag an image (a screenshot with text) into a note.
  2. Put the cursor on or just below the image embed.
  3. Cmd-P → "Vault Brain: Extract text from image below cursor".
  4. A notice shows progress; then the extracted Markdown is inserted below the image.
  5. Try a photo and a screenshot; confirm tables/structure come through.
  6. Run it with the cursor not near any image → friendly "no image embed found" notice.

- [ ] **Step 5: Commit** — `git add src/features/vision.ts src/main.ts && git commit -m "feat: add image-to-markdown extraction command"`

---

## Definition of Done (Plan 3)

- `npm test` green (prior + image-embed + vision-prompt tests).
- `npm run build` clean.
- In Obsidian: extracts text from a screenshot/photo into the note below the embed; failure paths show notices, never silently empty.
- Vision core (`image-embed`, `vision-prompt`) has no `obsidian` import.

---

## Self-Review

**Spec coverage (P0-3):** command on an embedded image ✅ (Task 3, finds embed near cursor); extracts text/structure into the note below the image ✅ (`replaceRange` after embed line); handles screenshots and photos ✅ (any raster mime); output inserted below embed ✅; failure shows a notice, never silently empty ✅ (every early-return + empty-result path has a Notice).

**Placeholder scan:** none — full code in every step.

**Type consistency:** `parseImageEmbed`/`mimeFromExtension` (Task 1) used in `vision.ts` (Task 3). `buildVisionMessages` (Task 2) returns `ChatMessage[]` (from Plan 1) used by `chatStream`. The `{ type: "image", mime, dataB64 }` part matches the `Part` union from `provider.ts`.
