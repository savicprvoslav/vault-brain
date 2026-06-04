# Vault Brain — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, installable Obsidian plugin that connects to local Ollama, streams a response from `gemma4:latest`, exposes a settings tab, and shows a live connection/model status indicator.

**Architecture:** Layered core (Approach ①). A pure-logic transport layer (`OllamaProvider` against Ollama's OpenAI-compatible `/v1/chat/completions`) sits behind an `LlmProvider` interface. Obsidian-coupled code (settings tab, status bar, plugin lifecycle) is thin and wires the pure core in. All network I/O lives in one file (`ollama-provider.ts`) — the single auditable egress point.

**Tech Stack:** TypeScript, esbuild (bundling), Obsidian plugin API, `node:test` + `tsx` for unit tests. Zero runtime dependencies beyond `obsidian`.

**Reference spec:** `docs/superpowers/specs/2026-06-04-vault-brain-design.md`

---

## File Structure (this plan)

| File | Responsibility |
|---|---|
| `manifest.json` | Obsidian plugin manifest (id, name, desktop-only) |
| `package.json` | npm scripts + devDeps |
| `tsconfig.json` | TypeScript config |
| `esbuild.config.mjs` | Bundle `src/main.ts` → `main.js` |
| `.gitignore` | Ignore `node_modules`, `main.js` |
| `styles.css` | Plugin styles (empty for now) |
| `src/core/provider.ts` | `LlmProvider` interface + `Part`/`ChatMessage` types (no `obsidian` import) |
| `src/core/ollama-provider.ts` | `OllamaProvider` + pure helpers; **only file with `fetch`** |
| `src/core/health.ts` | `checkHealth()` → `HealthState` (uses provider, no direct fetch) |
| `src/core/status-bar.ts` | `renderStatus()` pure view-model for the status bar |
| `src/settings.ts` | `VaultBrainSettings`, `DEFAULT_SETTINGS`, settings tab UI (imports `obsidian`) |
| `src/main.ts` | Plugin lifecycle; wires everything; "Test connection" command |
| `tests/ollama-provider.test.ts` | Unit tests for request building + SSE parsing |
| `tests/status-bar.test.ts` | Unit tests for status rendering |
| `tests/contract.test.ts` | Live test against local Ollama (skips if offline) |

**Testability boundary:** `provider.ts`, `ollama-provider.ts`, `health.ts`, `status-bar.ts` do NOT import `obsidian`, so they run under `node:test`. `settings.ts` and `main.ts` import `obsidian` and are verified manually in Obsidian.

---

## Task 1: Project scaffold + git + build + install into vault

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `.gitignore`, `styles.css`, `src/main.ts` (stub)

- [ ] **Step 1: Initialize git and npm**

```bash
cd /Users/prvoslavsavic/Documents/ai-gemma-4-obsidian-plugin
git init
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "vault-brain",
  "version": "0.1.0",
  "description": "Fully-local multimodal AI for Obsidian via Gemma 4 on Ollama.",
  "type": "module",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production",
    "test": "node --import tsx --test tests/*.test.ts"
  },
  "author": "Prvoslav",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^24.0.0",
    "esbuild": "0.21.5",
    "obsidian": "1.5.7-1",
    "tsx": "^4.16.0",
    "typescript": "5.4.5"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noImplicitAny": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 4: Create `esbuild.config.mjs`**

```js
import esbuild from "esbuild";

const production = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", "node:*"],
  format: "cjs",
  target: "es2022",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  platform: "browser",
});

if (production) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
  console.log("esbuild watching…");
}
```

- [ ] **Step 5: Create `manifest.json`**

```json
{
  "id": "vault-brain",
  "name": "Vault Brain",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "Fully-local, multimodal AI for your vault (voice, vision, Q&A) via Gemma 4 on Ollama. No cloud calls.",
  "author": "Prvoslav",
  "isDesktopOnly": true
}
```

- [ ] **Step 6: Create `.gitignore` and empty `styles.css`**

`.gitignore`:
```
node_modules/
main.js
main.js.map
*.log
.DS_Store
```

`styles.css`:
```css
/* Vault Brain styles */
```

- [ ] **Step 7: Create stub `src/main.ts`**

```ts
import { Plugin } from "obsidian";

export default class VaultBrainPlugin extends Plugin {
  async onload() {
    console.log("Vault Brain loaded");
  }
  onunload() {
    console.log("Vault Brain unloaded");
  }
}
```

- [ ] **Step 8: Install deps and build**

Run:
```bash
npm install
npm run build
```
Expected: `main.js` is produced at the repo root, no TypeScript errors.

- [ ] **Step 9: Symlink the plugin into the AW2 vault**

Run:
```bash
ln -sfn /Users/prvoslavsavic/Documents/ai-gemma-4-obsidian-plugin \
  "/Users/prvoslavsavic/Documents/Obsidian/AW2/.obsidian/plugins/vault-brain"
ls -la "/Users/prvoslavsavic/Documents/Obsidian/AW2/.obsidian/plugins/vault-brain/main.js"
```
Expected: the symlink resolves and `main.js` is listed.

- [ ] **Step 10: Enable in Obsidian (manual)**

In Obsidian (AW2): Settings → Community plugins → enable "Vault Brain". Open the developer console (Cmd-Opt-I) and confirm `Vault Brain loaded` is printed.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vault Brain plugin (esbuild + TS + manifest)"
```

---

## Task 2: Provider interface and shared types

**Files:**
- Create: `src/core/provider.ts`

- [ ] **Step 1: Create `src/core/provider.ts`**

```ts
// Multimodal content part. Audio is always normalized to wav before reaching here.
export type Part =
  | { type: "text"; text: string }
  | { type: "image"; mime: string; dataB64: string }
  | { type: "audio"; format: "wav"; dataB64: string };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  parts: Part[];
}

export interface ChatStreamOpts {
  signal: AbortSignal;
  onToken: (token: string) => void;
}

// Decouples features from Ollama specifics; future MLX/other = new implementation.
export interface LlmProvider {
  chatStream(messages: ChatMessage[], opts: ChatStreamOpts): Promise<string>;
  listModels(): Promise<string[]>;
  showCapabilities(model: string): Promise<string[]>;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/provider.ts
git commit -m "feat: add LlmProvider interface and multimodal Part types"
```

---

## Task 3: Ollama transport — pure helpers (TDD)

**Files:**
- Create: `src/core/ollama-provider.ts` (helpers only this task)
- Test: `tests/ollama-provider.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/ollama-provider.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { partToOpenAi, buildChatRequest, parseSseLine } from "../src/core/ollama-provider.ts";

test("partToOpenAi maps text", () => {
  assert.deepEqual(partToOpenAi({ type: "text", text: "hi" }), { type: "text", text: "hi" });
});

test("partToOpenAi maps audio -> input_audio", () => {
  assert.deepEqual(
    partToOpenAi({ type: "audio", format: "wav", dataB64: "AAA" }),
    { type: "input_audio", input_audio: { data: "AAA", format: "wav" } }
  );
});

test("partToOpenAi maps image -> image_url data URL", () => {
  assert.deepEqual(
    partToOpenAi({ type: "image", mime: "image/png", dataB64: "AAA" }),
    { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }
  );
});

test("buildChatRequest builds /v1 body", () => {
  const body = buildChatRequest("gemma4:latest", [{ role: "user", parts: [{ type: "text", text: "hi" }] }], true) as any;
  assert.equal(body.model, "gemma4:latest");
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages[0], { role: "user", content: [{ type: "text", text: "hi" }] });
});

test("parseSseLine extracts delta content", () => {
  assert.equal(parseSseLine('data: {"choices":[{"delta":{"content":"Hel"}}]}'), "Hel");
});

test("parseSseLine returns null on [DONE]", () => {
  assert.equal(parseSseLine("data: [DONE]"), null);
});

test("parseSseLine returns empty string for non-data / unparseable", () => {
  assert.equal(parseSseLine(": keep-alive"), "");
  assert.equal(parseSseLine("data: not-json"), "");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/core/ollama-provider.ts'` (file not created yet).

- [ ] **Step 3: Write the minimal implementation**

`src/core/ollama-provider.ts`:
```ts
import type { ChatMessage, Part } from "./provider.ts";

// Pure: map our Part to an OpenAI content part.
export function partToOpenAi(part: Part): unknown {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return { type: "image_url", image_url: { url: `data:${part.mime};base64,${part.dataB64}` } };
    case "audio":
      return { type: "input_audio", input_audio: { data: part.dataB64, format: part.format } };
  }
}

// Pure: build the /v1/chat/completions request body.
export function buildChatRequest(model: string, messages: ChatMessage[], stream: boolean): object {
  return {
    model,
    stream,
    messages: messages.map((m) => ({ role: m.role, content: m.parts.map(partToOpenAi) })),
  };
}

// Pure: parse one SSE line. Returns delta text, "" for non-content lines, or null on [DONE].
export function parseSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return "";
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    const json = JSON.parse(data);
    return json.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ollama-provider.ts tests/ollama-provider.test.ts
git commit -m "feat: add pure Ollama request builder and SSE parser with tests"
```

---

## Task 4: Ollama transport — the streaming client

**Files:**
- Modify: `src/core/ollama-provider.ts` (add `OllamaProvider` class)

- [ ] **Step 1: Add the config type and class**

Append to `src/core/ollama-provider.ts`:
```ts
import type { ChatStreamOpts, LlmProvider } from "./provider.ts";

export interface OllamaConfig {
  host: string; // e.g. "http://127.0.0.1"
  port: number; // e.g. 11434
  model: string; // e.g. "gemma4:latest"
}

export class OllamaProvider implements LlmProvider {
  // fetchFn is injectable for testing; defaults to the global fetch.
  constructor(private cfg: OllamaConfig, private fetchFn: typeof fetch = fetch) {}

  private base(): string {
    return `${this.cfg.host}:${this.cfg.port}`;
  }

  async chatStream(messages: ChatMessage[], opts: ChatStreamOpts): Promise<string> {
    const res = await this.fetchFn(`${this.base()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildChatRequest(this.cfg.model, messages, true)),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama returned HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const delta = parseSseLine(line);
        if (delta === null) return full; // [DONE]
        if (delta) {
          full += delta;
          opts.onToken(delta);
        }
      }
    }
    return full;
  }

  async listModels(): Promise<string[]> {
    const res = await this.fetchFn(`${this.base()}/api/tags`, { method: "GET" });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
    const json = (await res.json()) as { models?: { name: string }[] };
    return (json.models ?? []).map((m) => m.name);
  }

  async showCapabilities(model: string): Promise<string[]> {
    const res = await this.fetchFn(`${this.base()}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
    const json = (await res.json()) as { capabilities?: string[] };
    return json.capabilities ?? [];
  }
}
```

- [ ] **Step 2: Verify type-check and existing tests still pass**

Run: `npx tsc --noEmit --skipLibCheck && npm test`
Expected: no type errors; the 7 pure tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/ollama-provider.ts
git commit -m "feat: add OllamaProvider streaming client (single network egress)"
```

---

## Task 5: Health check + status rendering (TDD)

**Files:**
- Create: `src/core/health.ts`, `src/core/status-bar.ts`
- Test: `tests/status-bar.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/status-bar.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStatus } from "../src/core/status-bar.ts";

test("server down -> red + how to start", () => {
  const v = renderStatus({ server: "down", model: "unknown", caps: [] }, "gemma4:latest");
  assert.match(v.text, /🔴/);
  assert.match(v.tooltip, /ollama serve/);
});

test("model missing -> yellow + pull command", () => {
  const v = renderStatus({ server: "up", model: "missing", caps: [] }, "gemma4:latest");
  assert.match(v.text, /🟡/);
  assert.match(v.tooltip, /ollama pull gemma4:latest/);
});

test("ready -> green", () => {
  const v = renderStatus({ server: "up", model: "ready", caps: ["audio", "vision"] }, "gemma4:latest");
  assert.match(v.text, /🟢/);
  assert.match(v.tooltip, /Ready/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../src/core/status-bar.ts`.

- [ ] **Step 3: Implement `src/core/health.ts`**

```ts
import type { LlmProvider } from "./provider.ts";

export interface HealthState {
  server: "up" | "down";
  model: "ready" | "missing" | "unknown";
  caps: string[];
}

export async function checkHealth(provider: LlmProvider, model: string): Promise<HealthState> {
  try {
    const models = await provider.listModels();
    const present = models.includes(model);
    let caps: string[] = [];
    if (present) {
      try {
        caps = await provider.showCapabilities(model);
      } catch {
        caps = [];
      }
    }
    return { server: "up", model: present ? "ready" : "missing", caps };
  } catch {
    return { server: "down", model: "unknown", caps: [] };
  }
}
```

- [ ] **Step 4: Implement `src/core/status-bar.ts`**

```ts
import type { HealthState } from "./health.ts";

export interface StatusView {
  text: string;
  tooltip: string;
}

export function renderStatus(state: HealthState, model: string): StatusView {
  if (state.server === "down") {
    return {
      text: "🔴 Vault Brain",
      tooltip: "Ollama not reachable. Start it: run `ollama serve` or open Ollama.app.",
    };
  }
  if (state.model === "missing") {
    return {
      text: "🟡 Vault Brain",
      tooltip: `Model "${model}" not pulled. Run: ollama pull ${model}`,
    };
  }
  const caps = state.caps.length ? state.caps.join(", ") : "no capabilities reported";
  return { text: "🟢 Vault Brain", tooltip: `Ready — ${model} (${caps})` };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: all status tests PASS (and the earlier 7 still PASS).

- [ ] **Step 6: Commit**

```bash
git add src/core/health.ts src/core/status-bar.ts tests/status-bar.test.ts
git commit -m "feat: add health check and status rendering with tests"
```

---

## Task 6: Settings model + settings tab

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: Implement `src/settings.ts`**

```ts
import { App, PluginSettingTab, Setting } from "obsidian";
import type VaultBrainPlugin from "./main.ts";

export interface VaultBrainSettings {
  host: string;
  port: number;
  model: string;
  outputTemplate: string;
  dailyNoteMode: "append" | "new";
  contextTokenCap: number;
  outputLanguage: "auto" | "en" | "sr";
  keepAlive: boolean;
}

export const DEFAULT_TEMPLATE = `## 🎙️ Voice memo — {{date}}
**Summary**
{{summary}}

**Tasks**
{{tasks}}

**Transcript**
{{transcript}}
`;

export const DEFAULT_SETTINGS: VaultBrainSettings = {
  host: "http://127.0.0.1",
  port: 11434,
  model: "gemma4:latest",
  outputTemplate: DEFAULT_TEMPLATE,
  dailyNoteMode: "append",
  contextTokenCap: 8000,
  outputLanguage: "auto",
  keepAlive: false,
};

export class VaultBrainSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: VaultBrainPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Brain — local AI" });

    const save = async () => this.plugin.saveSettings();

    new Setting(containerEl)
      .setName("Ollama host")
      .setDesc("Local endpoint only. Defaults to loopback for privacy.")
      .addText((t) =>
        t.setValue(this.plugin.settings.host).onChange(async (v) => {
          this.plugin.settings.host = v.trim();
          await save();
        })
      );

    new Setting(containerEl).setName("Ollama port").addText((t) =>
      t.setValue(String(this.plugin.settings.port)).onChange(async (v) => {
        const n = Number(v);
        if (!Number.isNaN(n)) {
          this.plugin.settings.port = n;
          await save();
        }
      })
    );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("gemma4:latest (8B) supports audio + vision. The text-only gemma4:12b-mlx may be used once multimodal features are not needed.")
      .addText((t) =>
        t.setValue(this.plugin.settings.model).onChange(async (v) => {
          this.plugin.settings.model = v.trim();
          await save();
        })
      );

    new Setting(containerEl)
      .setName("Daily-note mode")
      .setDesc("Where processed voice memos go.")
      .addDropdown((d) =>
        d
          .addOption("append", "Append to today's daily note")
          .addOption("new", "New note per memo")
          .setValue(this.plugin.settings.dailyNoteMode)
          .onChange(async (v) => {
            this.plugin.settings.dailyNoteMode = v as "append" | "new";
            await save();
          })
      );

    new Setting(containerEl)
      .setName("Output language")
      .addDropdown((d) =>
        d
          .addOption("auto", "Auto (match input)")
          .addOption("en", "English")
          .addOption("sr", "Serbian")
          .setValue(this.plugin.settings.outputLanguage)
          .onChange(async (v) => {
            this.plugin.settings.outputLanguage = v as "auto" | "en" | "sr";
            await save();
          })
      );

    new Setting(containerEl)
      .setName("Context token cap")
      .setDesc("Hard cap on Q&A context size.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.contextTokenCap)).onChange(async (v) => {
          const n = Number(v);
          if (!Number.isNaN(n) && n > 0) {
            this.plugin.settings.contextTokenCap = n;
            await save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Keep model warm")
      .setDesc("Periodically ping Ollama to avoid cold starts during a session.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.keepAlive).onChange(async (v) => {
          this.plugin.settings.keepAlive = v;
          await save();
        })
      );

    new Setting(containerEl)
      .setName("Output template")
      .setDesc("Placeholders: {{date}} {{title}} {{summary}} {{tasks}} {{transcript}}")
      .addTextArea((t) => {
        t.setValue(this.plugin.settings.outputTemplate).onChange(async (v) => {
          this.plugin.settings.outputTemplate = v;
          await save();
        });
        t.inputEl.rows = 10;
        t.inputEl.style.width = "100%";
      });
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: no errors (note: `main.ts` referenced as a type import will resolve after Task 7; if a "cannot find module './main.ts'" error appears, proceed — Task 7 creates it, and the type is structural).

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add settings model, defaults, and settings tab"
```

---

## Task 7: Plugin lifecycle wiring

**Files:**
- Modify: `src/main.ts` (replace the stub)

- [ ] **Step 1: Replace `src/main.ts`**

```ts
import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, VaultBrainSettings, VaultBrainSettingTab } from "./settings.ts";
import { OllamaProvider } from "./core/ollama-provider.ts";
import { checkHealth } from "./core/health.ts";
import { renderStatus } from "./core/status-bar.ts";

export default class VaultBrainPlugin extends Plugin {
  settings!: VaultBrainSettings;
  provider!: OllamaProvider;
  private statusEl!: HTMLElement;

  async onload() {
    await this.loadSettings();
    this.rebuildProvider();

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText("⏳ Vault Brain");

    this.addSettingTab(new VaultBrainSettingTab(this.app, this));

    this.addCommand({
      id: "test-connection",
      name: "Test connection (stream a hello)",
      callback: () => this.testConnection(),
    });

    await this.refreshHealth();
    this.registerInterval(window.setInterval(() => void this.refreshHealth(), 30000));
  }

  onunload() {}

  rebuildProvider() {
    this.provider = new OllamaProvider({
      host: this.settings.host,
      port: this.settings.port,
      model: this.settings.model,
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.rebuildProvider();
    await this.refreshHealth();
  }

  async refreshHealth() {
    const state = await checkHealth(this.provider, this.settings.model);
    const view = renderStatus(state, this.settings.model);
    this.statusEl.setText(view.text);
    this.statusEl.ariaLabel = view.tooltip;
    this.statusEl.title = view.tooltip;
  }

  async testConnection() {
    const controller = new AbortController();
    const notice = new Notice("Vault Brain: …", 0);
    try {
      let acc = "";
      await this.provider.chatStream(
        [{ role: "user", parts: [{ type: "text", text: "Say hello in 5 words." }] }],
        {
          signal: controller.signal,
          onToken: (t) => {
            acc += t;
            notice.setMessage("Vault Brain: " + acc);
          },
        }
      );
      window.setTimeout(() => notice.hide(), 4000);
    } catch (e) {
      notice.hide();
      new Notice("Vault Brain error: " + (e as Error).message);
    }
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `main.js` rebuilt, no type errors.

- [ ] **Step 3: Manual verification in Obsidian**

Reload the plugin (disable/enable in Community plugins, or use the Hot Reload plugin). Verify:
1. Status bar shows **🟢 Vault Brain** (hover → "Ready — gemma4:latest (…capabilities…)").
2. Command palette → "Vault Brain: Test connection" → a Notice streams a short greeting token-by-token.
3. Stop Ollama (`Quit Ollama.app`), wait ~30s → status flips to **🔴**; restart → back to 🟢.
4. Settings → Vault Brain shows all fields; changing the model to a bogus name flips status to **🟡** with the pull hint.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire plugin lifecycle, status bar, and test-connection command"
```

---

## Task 8: Live contract test (optional, skips offline)

**Files:**
- Create: `tests/contract.test.ts`

- [ ] **Step 1: Write the contract test**

`tests/contract.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaProvider } from "../src/core/ollama-provider.ts";

const cfg = { host: "http://127.0.0.1", port: 11434, model: "gemma4:latest" };

async function ollamaUp(): Promise<boolean> {
  try {
    const r = await fetch(`${cfg.host}:${cfg.port}/api/tags`);
    return r.ok;
  } catch {
    return false;
  }
}

test("streams tokens from local Ollama", { skip: !(await ollamaUp()) }, async () => {
  const p = new OllamaProvider(cfg);
  const tokens: string[] = [];
  const out = await p.chatStream(
    [{ role: "user", parts: [{ type: "text", text: "Reply with the single word: ok" }] }],
    { signal: new AbortController().signal, onToken: (t) => tokens.push(t) }
  );
  assert.ok(tokens.length >= 1, "should receive at least one token");
  assert.ok(out.toLowerCase().includes("ok"));
});

test("lists models and gemma4:latest has audio+vision", { skip: !(await ollamaUp()) }, async () => {
  const p = new OllamaProvider(cfg);
  const models = await p.listModels();
  assert.ok(models.includes("gemma4:latest"));
  const caps = await p.showCapabilities("gemma4:latest");
  assert.ok(caps.includes("audio") && caps.includes("vision"), `caps were: ${caps.join(",")}`);
});
```

- [ ] **Step 2: Run it**

Run: `npm test`
Expected: with Ollama running, both contract tests PASS; with Ollama stopped, they SKIP (not fail).

- [ ] **Step 3: Commit**

```bash
git add tests/contract.test.ts
git commit -m "test: add live Ollama contract test (skips when offline)"
```

---

## Definition of Done (Plan 1)

- `npm test` green (10 unit tests + 2 contract tests when Ollama is up).
- `npm run build` produces `main.js` with no type errors.
- In Obsidian: 🟢 status, working Test-connection stream, settings tab, and correct 🔴/🟡 states.
- All network I/O confined to `src/core/ollama-provider.ts` (grep check: `grep -rn "fetch(" src/` returns only that file).

---

## Self-Review

**Spec coverage (foundation slice):** P0-1 connectivity/streaming/status ✅ (Tasks 3–7); P0-5 single-egress ✅ (Task 4 + DoD grep); P0-6 settings ✅ (Task 6, all fields incl. those used by later plans). Voice/vision/Q&A (P0-2/3/4) are out of scope for Plan 1 by design — covered in Plans 2–4.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows full assertions. ✅

**Type consistency:** `Part`, `ChatMessage`, `ChatStreamOpts`, `LlmProvider` defined in Task 2 are used unchanged in Tasks 3–7. `HealthState` (Task 5) consumed by `renderStatus` (Task 5) and `main.ts` (Task 7) with matching fields. `OllamaConfig` (Task 4) matches the object built in `main.rebuildProvider()` (Task 7). `VaultBrainSettings` fields (Task 6) match `DEFAULT_SETTINGS` and `main.ts` usage. ✅
