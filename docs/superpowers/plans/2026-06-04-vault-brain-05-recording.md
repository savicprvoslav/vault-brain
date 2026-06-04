# Vault Brain — Plan 5: In-app Voice Recording

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** A 🎙️ mic button that records from the microphone and feeds the recording straight into the existing voice→note pipeline (transcribe & discard — no audio saved).

**Architecture:** Refactor `voice.ts` to expose `processAudioBytes(plugin, bytes, title)` (the existing decode→transcribe→write core); add `recorder.ts` (MediaRecorder glue) that calls it. Browser/Obsidian glue → build-verified + manual.

---

## Task 1: Refactor `voice.ts` to accept raw bytes

**Files:** Modify `src/features/voice.ts`

- [ ] **Step 1:** Read `src/features/voice.ts`. Extract the body of `processAudioFile` (everything from the WAV conversion through writing the note) into a new exported function, and make `processAudioFile` a thin wrapper:
```ts
// New exported core — takes raw audio bytes + a title (no TFile dependency).
export async function processAudioBytes(plugin: VaultBrainPlugin, bytes: ArrayBuffer, title: string): Promise<void> {
  const notice = new Notice(`Vault Brain: processing ${title}…`, 0);
  try {
    const wav = await toWav16kMono(bytes);
    const messages = buildVoiceMessages(bytesToBase64(wav));
    let out = "";
    await plugin.provider.chatStream(messages, {
      signal: AbortSignal.timeout(300000),
      onToken: (t) => { out += t; },
    });
    const sections = parseVoiceOutput(out);
    const filled = render(plugin.settings.outputTemplate, {
      date: (moment as unknown as () => { format: (f: string) => string })().format("YYYY-MM-DD"),
      title,
      summary: sections.summary,
      tasks: sections.tasks,
      transcript: sections.transcript,
    });
    if (plugin.settings.dailyNoteMode === "new") {
      const path = `${title} (memo).md`;
      const existing = plugin.app.vault.getAbstractFileByPath(path);
      const target = existing instanceof TFile ? existing : await plugin.app.vault.create(path, "");
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

async function processAudioFile(plugin: VaultBrainPlugin, file: TFile): Promise<void> {
  const bytes = await plugin.app.vault.readBinary(file);
  await processAudioBytes(plugin, bytes, file.basename);
}
```
Keep `toWav16kMono`, `bytesToBase64`, `resolveDailyNote`, `registerVoiceCommands`, and the imports as they are. The `moment` cast must match whatever is already used in the file.

- [ ] **Step 2:** `npm run build` (clean) + `npm test` (still 48 pass — no behavior change).

- [ ] **Step 3:** Commit — `git add src/features/voice.ts && git commit -m "refactor: extract processAudioBytes so recordings can reuse the voice pipeline"`

---

## Task 2: Recorder + wiring

**Files:** Create `src/features/recorder.ts`, modify `src/main.ts`

- [ ] **Step 1:** Create `src/features/recorder.ts`:
```ts
import { Notice, moment } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { processAudioBytes } from "./voice.ts";

class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  async stop(): Promise<ArrayBuffer> {
    const mr = this.mediaRecorder;
    if (!mr) throw new Error("not recording");
    const done = new Promise<ArrayBuffer>((resolve, reject) => {
      mr.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: mr.mimeType || "audio/webm" });
          resolve(await blob.arrayBuffer());
        } catch (err) {
          reject(err as Error);
        } finally {
          this.cleanup();
        }
      };
    });
    mr.stop();
    return done;
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

export function registerRecorder(plugin: VaultBrainPlugin): void {
  const recorder = new Recorder();
  let statusEl: HTMLElement | null = null;

  const setRecordingUi = (on: boolean) => {
    if (on && !statusEl) {
      statusEl = plugin.addStatusBarItem();
      statusEl.setText("🔴 Recording…");
    } else if (!on && statusEl) {
      statusEl.remove();
      statusEl = null;
    }
  };

  const toggle = async () => {
    if (recorder.isRecording()) {
      setRecordingUi(false);
      const notice = new Notice("Vault Brain: finishing recording…", 0);
      try {
        const bytes = await recorder.stop();
        notice.hide();
        const stamp = (moment as unknown as () => { format: (f: string) => string })().format("YYYY-MM-DD HH-mm");
        await processAudioBytes(plugin, bytes, `Voice recording ${stamp}`);
      } catch (e) {
        notice.hide();
        new Notice("Vault Brain error: " + (e as Error).message);
      }
    } else {
      try {
        await recorder.start();
        setRecordingUi(true);
        new Notice("Vault Brain: recording… click the mic again to stop.");
      } catch (e) {
        new Notice("Vault Brain: couldn't access the microphone — " + (e as Error).message);
      }
    }
  };

  plugin.addRibbonIcon("microphone", "Vault Brain: record voice memo", () => void toggle());
  plugin.addCommand({
    id: "toggle-recording",
    name: "Start/stop voice recording",
    callback: () => void toggle(),
  });
}
```

- [ ] **Step 2:** Wire into `src/main.ts` — add `import { registerRecorder } from "./features/recorder.ts";` after the voice import, and `registerRecorder(this);` after `registerVoiceCommands(this);` in onload.

- [ ] **Step 3:** `npm run build` (clean) + `npm test` (48 pass).

- [ ] **Step 4: Manual:** reload → 🎙️ ribbon → grant mic → "recording…" → click mic again → daily note gets the memo section; no audio file is left in the vault.

- [ ] **Step 5:** Commit — `git add src/features/recorder.ts src/main.ts && git commit -m "feat: in-app voice recording (transcribe & discard)"`

---

## Definition of Done
- `npm test` 48 pass · `npm run build` clean · ribbon mic records → note; existing file command still works; no audio saved.
