# Vault Brain — Plan 4: Voice Memo → Structured Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A command on an audio attachment (P0-2) that transcribes it, produces a ≤5-bullet summary and extracted `- [ ]` tasks, fills a user template, and appends to today's daily note (or a new note). Works offline; original audio is never modified; Serbian and English both supported.

**Architecture:** Pure logic — WAV encoding, template rendering, the voice prompt, and output parsing — lives in obsidian-free `core/` (unit-tested). `features/voice.ts` does the browser/Obsidian work: decode+resample audio to 16 kHz mono via Web Audio, base64, stream through `OllamaProvider`, resolve the daily note, and write. Audio is sent as a content part the transport already supports (validated: `input_audio` wav).

**Tech Stack:** TypeScript, Web Audio (`OfflineAudioContext`), Obsidian vault + `moment`, `node:test`. Builds on Plan 1.

**Reference spec:** `docs/superpowers/specs/2026-06-04-vault-brain-design.md` §8 (P0-2).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/wav.ts` | `encodeWavPcm16(pcm, sampleRate)` → WAV bytes — pure |
| `src/core/template.ts` | `render(template, vars)` — pure |
| `src/core/voice-prompt.ts` | `buildVoiceMessages(audioB64)` → `ChatMessage[]` — pure |
| `src/core/voice-parse.ts` | `parseVoiceOutput(text)` → `{transcript, summary, tasks}` — pure |
| `src/features/voice.ts` | audio decode/resample, daily-note resolve, write; command + file-menu (obsidian) |
| `src/main.ts` | call `registerVoiceCommands(this)` (modify) |
| `tests/wav.test.ts`, `tests/template.test.ts`, `tests/voice-prompt.test.ts`, `tests/voice-parse.test.ts` | unit tests |

---

## Task 1: WAV encoder (TDD)

**Files:** Create `src/core/wav.ts`, `tests/wav.test.ts`

- [ ] **Step 1: Failing test** — `tests/wav.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeWavPcm16 } from "../src/core/wav.ts";

function ascii(bytes: Uint8Array, off: number, len: number): string {
  return String.fromCharCode(...bytes.slice(off, off + len));
}

test("writes a valid 16-bit mono WAV header", () => {
  const pcm = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const wav = encodeWavPcm16(pcm, 16000);
  assert.equal(ascii(wav, 0, 4), "RIFF");
  assert.equal(ascii(wav, 8, 4), "WAVE");
  assert.equal(ascii(wav, 36, 4), "data");
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 1); // mono
  assert.equal(view.getUint32(24, true), 16000); // sample rate
  assert.equal(view.getUint16(34, true), 16); // bits per sample
  assert.equal(wav.length, 44 + pcm.length * 2);
});

test("clamps and converts samples", () => {
  const wav = encodeWavPcm16(new Float32Array([1, -1]), 8000);
  const view = new DataView(wav.buffer);
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(46, true), -32768);
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement** — `src/core/wav.ts`:
```ts
// Encode mono float PCM (-1..1) as a 16-bit PCM WAV file (44-byte header + samples).
export function encodeWavPcm16(pcm: Float32Array, sampleRate: number): Uint8Array {
  const numSamples = pcm.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/wav.ts tests/wav.test.ts && git commit -m "feat: add 16-bit mono WAV encoder with tests"`

---

## Task 2: Template renderer (TDD)

**Files:** Create `src/core/template.ts`, `tests/template.test.ts`

- [ ] **Step 1: Failing test** — `tests/template.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/core/template.ts";

test("replaces known placeholders", () => {
  assert.equal(render("{{a}} and {{b}}", { a: "1", b: "2" }), "1 and 2");
});

test("unknown placeholder becomes empty string", () => {
  assert.equal(render("x {{missing}} y", {}), "x  y");
});

test("leaves text without placeholders unchanged", () => {
  assert.equal(render("plain text", { a: "1" }), "plain text");
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement** — `src/core/template.ts`:
```ts
// Replace {{name}} placeholders from vars; unknown names become "".
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/template.ts tests/template.test.ts && git commit -m "feat: add template renderer with tests"`

---

## Task 3: Voice prompt + output parser (TDD)

**Files:** Create `src/core/voice-prompt.ts`, `src/core/voice-parse.ts`, `tests/voice-prompt.test.ts`, `tests/voice-parse.test.ts`

- [ ] **Step 1: Failing tests**

`tests/voice-prompt.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVoiceMessages } from "../src/core/voice-prompt.ts";

test("builds a user message with instruction + audio part", () => {
  const msgs = buildVoiceMessages("AUDIOB64");
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, "user");
  assert.equal(msgs[0].parts[0].type, "text");
  assert.deepEqual(msgs[0].parts[1], { type: "audio", format: "wav", dataB64: "AUDIOB64" });
});
```

`tests/voice-parse.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoiceOutput } from "../src/core/voice-parse.ts";

test("splits the three sections", () => {
  const text = [
    "### TRANSCRIPT",
    "hello world",
    "",
    "### SUMMARY",
    "- point one",
    "",
    "### TASKS",
    "- [ ] call dentist",
  ].join("\n");
  const r = parseVoiceOutput(text);
  assert.equal(r.transcript, "hello world");
  assert.match(r.summary, /point one/);
  assert.match(r.tasks, /\- \[ \] call dentist/);
});

test("falls back to transcript when no headers", () => {
  const r = parseVoiceOutput("just a raw transcript");
  assert.equal(r.transcript, "just a raw transcript");
  assert.equal(r.summary, "");
  assert.equal(r.tasks, "");
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement**

`src/core/voice-prompt.ts`:
```ts
import type { ChatMessage } from "./provider.ts";

const INSTRUCTION = `You are processing a voice memo. Respond in the language spoken in the audio.
Output EXACTLY these three sections with these exact headers and nothing else:

### TRANSCRIPT
<verbatim transcript of everything spoken>

### SUMMARY
<up to 5 concise bullet points, each line starting with "- ">

### TASKS
<each actionable item as a Markdown checkbox line "- [ ] ..."; if there are none, write "- [ ] (none)">`;

export function buildVoiceMessages(audioB64: string): ChatMessage[] {
  return [
    {
      role: "user",
      parts: [
        { type: "text", text: INSTRUCTION },
        { type: "audio", format: "wav", dataB64: audioB64 },
      ],
    },
  ];
}
```

`src/core/voice-parse.ts`:
```ts
export interface VoiceSections {
  transcript: string;
  summary: string;
  tasks: string;
}

function grab(text: string, name: string): string {
  const re = new RegExp(`###\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

// Parse the model's three-section output. If no headers are present, treat the whole
// thing as the transcript so nothing is lost.
export function parseVoiceOutput(text: string): VoiceSections {
  const transcript = grab(text, "TRANSCRIPT");
  const summary = grab(text, "SUMMARY");
  const tasks = grab(text, "TASKS");
  if (!transcript && !summary && !tasks) {
    return { transcript: text.trim(), summary: "", tasks: "" };
  }
  return { transcript, summary, tasks };
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/core/voice-prompt.ts src/core/voice-parse.ts tests/voice-prompt.test.ts tests/voice-parse.test.ts && git commit -m "feat: add voice prompt and output parser with tests"`

---

## Task 4: Voice feature (decode, transcribe, write) + wiring

**Files:** Create `src/features/voice.ts`, modify `src/main.ts`

- [ ] **Step 1: Implement** — `src/features/voice.ts`:
```ts
import { Notice, TFile, TAbstractFile, moment, Menu } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { encodeWavPcm16 } from "../core/wav.ts";
import { buildVoiceMessages } from "../core/voice-prompt.ts";
import { parseVoiceOutput } from "../core/voice-parse.ts";
import { render } from "../core/template.ts";

const AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "webm", "aac", "flac", "mp4"];

export function registerVoiceCommands(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "process-voice-memo",
    name: "Voice memo → note (pick audio file)",
    callback: () => void pickAndProcess(plugin),
  });

  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
      if (file instanceof TFile && AUDIO_EXTS.includes(file.extension.toLowerCase())) {
        menu.addItem((item) =>
          item
            .setTitle("Vault Brain: Voice memo → note")
            .setIcon("microphone")
            .onClick(() => void processAudioFile(plugin, file))
        );
      }
    })
  );
}

async function pickAndProcess(plugin: VaultBrainPlugin): Promise<void> {
  const audio = plugin.app.vault.getFiles().filter((f) => AUDIO_EXTS.includes(f.extension.toLowerCase()));
  if (audio.length === 0) {
    new Notice("Vault Brain: no audio files found in the vault.");
    return;
  }
  audio.sort((a, b) => b.stat.mtime - a.stat.mtime);
  await processAudioFile(plugin, audio[0]);
}

// Decode any audio to 16 kHz mono via Web Audio, then encode WAV. Original file untouched.
async function toWav16kMono(bytes: ArrayBuffer): Promise<Uint8Array> {
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes.slice(0));
  } finally {
    void decodeCtx.close();
  }
  const targetRate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded; // multi-channel source -> mono destination downmixes
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return encodeWavPcm16(rendered.getChannelData(0), targetRate);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function resolveDailyNote(plugin: VaultBrainPlugin): Promise<TFile> {
  const dn = (plugin.app as any).internalPlugins?.getPluginById?.("daily-notes");
  const opts = dn?.instance?.options ?? {};
  const format: string = opts.format || "YYYY-MM-DD";
  const folder: string = (opts.folder || "").trim();
  const name = moment().format(format);
  const path = folder ? `${folder}/${name}.md` : `${name}.md`;
  const existing = plugin.app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  return plugin.app.vault.create(path, "");
}

async function processAudioFile(plugin: VaultBrainPlugin, file: TFile): Promise<void> {
  const notice = new Notice(`Vault Brain: processing ${file.name}…`, 0);
  try {
    const bytes = await plugin.app.vault.readBinary(file);
    const wav = await toWav16kMono(bytes);
    const messages = buildVoiceMessages(bytesToBase64(wav));

    let out = "";
    await plugin.provider.chatStream(messages, {
      signal: AbortSignal.timeout(300000),
      onToken: (t) => {
        out += t;
      },
    });

    const sections = parseVoiceOutput(out);
    const filled = render(plugin.settings.outputTemplate, {
      date: moment().format("YYYY-MM-DD"),
      title: file.basename,
      summary: sections.summary,
      tasks: sections.tasks,
      transcript: sections.transcript,
    });

    if (plugin.settings.dailyNoteMode === "new") {
      const path = `${file.basename} (memo).md`;
      const target =
        (plugin.app.vault.getAbstractFileByPath(path) as TFile) ?? (await plugin.app.vault.create(path, ""));
      await plugin.app.vault.append(target, `${filled}\n`);
      await plugin.app.workspace.getLeaf(true).openFile(target);
    } else {
      const daily = await resolveDailyNote(plugin);
      await plugin.app.vault.append(daily, `\n${filled}\n`);
    }

    notice.hide();
    new Notice("Vault Brain: voice memo added.");
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
  }
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — add import after the vision import:
```ts
import { registerVoiceCommands } from "./features/voice.ts";
```
In `onload()`, after `registerVisionCommand(this);`, add:
```ts
    registerVoiceCommands(this);
```

- [ ] **Step 3: Build** — `npm run build` (clean, produce main.js).

- [ ] **Step 4: Manual verification in Obsidian** (reload plugin; Wi-Fi OFF to prove offline):
  1. Have an audio file in the vault (e.g. a `.m4a`/`.wav` voice memo). Right-click it → "Vault Brain: Voice memo → note" (or Cmd-P → "Voice memo → note (pick audio file)" to use the most recent).
  2. A progress notice appears; within ~60s for a 5-min memo the daily note gains a section with **summary + tasks + transcript** per the template.
  3. The original audio file is unchanged.
  4. Test a Serbian memo and an English memo; both transcribe.
  5. Switch Daily-note mode to "new note per memo" in settings → a new note is created and opened instead.

- [ ] **Step 5: Commit** — `git add src/features/voice.ts src/main.ts && git commit -m "feat: add voice memo to structured note (decode, transcribe, write)"`

---

## Definition of Done (Plan 4)

- `npm test` green (prior + wav + template + voice-prompt + voice-parse tests).
- `npm run build` clean.
- In Obsidian: an audio file becomes a templated note section (summary + `- [ ]` tasks + transcript) in the daily note or a new note; works with Wi-Fi off; original audio untouched; SR + EN both work.
- Voice core (`wav`, `template`, `voice-prompt`, `voice-parse`) has no `obsidian` import.

---

## Self-Review

**Spec coverage (P0-2):** command on an audio attachment ✅ (file-menu + command); transcript + ≤5-bullet summary + `- [ ]` tasks ✅ (prompt + parser); appended to daily note or new note per template ✅ (Task 4 write paths + `render`); works offline ✅ (only local Ollama); original audio never modified ✅ (read-only `readBinary`, decode in-memory); SR + EN ✅ (prompt says respond in spoken language); 5-min < 60s warm is a runtime property to confirm in manual test.

**Placeholder scan:** none — full code in every step.

**Type consistency:** `encodeWavPcm16` (Task 1) used by `toWav16kMono` (Task 4). `render` (Task 2) used in Task 4 with the documented vars. `buildVoiceMessages` (Task 3) returns `ChatMessage[]`; the `{type:"audio", format:"wav", dataB64}` part matches the `Part` union. `parseVoiceOutput` → `VoiceSections` consumed in Task 4. `moment` imported from `obsidian`.
