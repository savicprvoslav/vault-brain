# Vault Brain — P1 Additions Design Spec

**Status:** Approved design · **Date:** 2026-06-04 · **Owner:** Prvoslav
**Builds on:** the v1 P0 plugin (`2026-06-04-vault-brain-design.md`).
**Scope:** two independent P1 features — ① in-app voice recording, ② editor selection quick-actions. (Vault RAG search is a separate, larger initiative with its own spec — deferred.)

---

## Feature ① — In-app voice recording (P1, "record button")

**Goal:** Hit a mic button, talk, hit stop → a structured note appears. No audio file is kept (transcribe & discard). Reuses the entire validated voice pipeline.

**Design:**
- **`src/features/recorder.ts`** — a `Recorder` class over `navigator.mediaDevices.getUserMedia({audio:true})` + `MediaRecorder`: `start()`, `stop(): Promise<ArrayBuffer>`, `cancel()`, `isRecording()`. Collects `dataavailable` chunks; on stop builds a Blob and returns its `ArrayBuffer`. Always stops the mic tracks (no lingering mic).
- **`registerRecorder(plugin)`** — a 🎙️ ribbon icon + "Start/stop voice recording" command that toggles: not recording → `start()` + status bar shows **🔴 Recording…**; recording → `stop()` → hand bytes to the shared pipeline + clear the status.
- **Refactor `src/features/voice.ts`** — extract `export async function processAudioBytes(plugin, bytes: ArrayBuffer, title: string)` containing the existing decode→16 kHz WAV→transcribe→parse→template→write logic. `processAudioFile` becomes: read the file, then `processAudioBytes(bytes, file.basename)`. The recorder calls `processAudioBytes(bytes, "Voice recording <HH:mm>")`.
- **Discard:** the recorded blob is processed in memory and never written to the vault; only the resulting note is created (per the existing daily-note / new-note setting).
- **Errors:** mic permission denied or unavailable → clear Notice; silence/no speech → existing "nothing extracted" path. Mic permission is a one-time macOS prompt.

**Acceptance:** click mic → record → click stop → daily note gains the templated section within the usual latency; no audio file left behind; the existing "process audio file" command still works.

**Testing:** recording is browser glue (`MediaRecorder`/`getUserMedia`) → manual verification. The shared `processAudioBytes` reuses already-tested pure modules (wav, prompt, parse, template). One tiny pure helper (`recordingTitle(date)`) may be unit-tested.

---

## Feature ② — Editor selection quick-actions (P1-1)

**Goal:** Select text → run an action (Summarize / Improve / Format / Translate SR↔EN / Fix grammar) from the right-click menu or command palette; the result replaces the selection (Summarize inserts its bullets below instead).

**Design:**
- **`src/core/actions.ts`** (pure, unit-tested):
  - `type ActionId = "summarize" | "improve" | "format" | "translate" | "grammar"`.
  - `interface QuickAction { id: ActionId; label: string; icon: string; mode: "replace" | "below" }` — `summarize` → `"below"`, the rest → `"replace"`.
  - `ACTIONS: QuickAction[]` and `buildActionMessages(id, selectedText): ChatMessage[]` — a per-action system instruction ("output ONLY the result, no preamble/quotes") + the selected text as the user message.
  - Instructions: **summarize** ≤5 bullets · **improve** clarity/flow, preserve meaning + Markdown · **format** clean Markdown, keep wording · **translate** SR↔EN auto-detect · **grammar** fix grammar/spelling/punctuation only.
- **`src/features/actions.ts`** (Obsidian) — `registerQuickActions(plugin)`:
  - One command per action (palette + assignable hotkeys).
  - An `editor-menu` handler that, **only when text is selected**, adds a "Vault Brain" submenu with the 5 actions.
  - On trigger: `editor.getSelection()` (empty → "select some text first" Notice) → progress Notice → accumulate `chatStream` result (like vision/voice) → `editor.replaceSelection(result)` for `replace`, or insert `\n\n{result}` after the selection for `below`.
  - Errors → Notice; abort via `AbortSignal.timeout`.
- **`src/main.ts`** — `registerQuickActions(this)`.

**Acceptance:** select text, run each action from menu + palette; replace/insert-below behaves per mode; empty selection is handled; no new network surface (reuses the provider).

**Testing:** `tests/actions.test.ts` — for each action, `buildActionMessages` carries the right instruction and the selected text; `ACTIONS` modes are correct. The command wiring is manual-verify.

---

## Out of scope (these additions)
- Vault-wide RAG / embeddings (separate initiative).
- Live streaming of action results into the editor (accumulate-then-write is intentional).
- Saving recordings as attachments (user chose discard).
