# Vault Brain — Design Spec

**Status:** Approved design (v1) · **Owner:** Prvoslav · **Date:** 2026-06-04
**Source PRD:** `prd-obsidian-local-gemma-plugin.md` · **Scope:** Complete P0 in one build
**Architecture:** Approach ① — layered core, thin features

---

## 1. Summary

Vault Brain is a fully-local, multimodal AI plugin for Obsidian, backed by Gemma 4 running
through Ollama. It turns voice memos into structured notes, extracts markdown from images, and
answers questions over the active note and its links — with **zero cloud calls**. Desktop-only,
single model, read + append-only.

## 2. What is already validated (Phase 0 spike — done)

All probes run live against the local Ollama on this machine.

| Capability | Endpoint / wire format | Result |
|---|---|---|
| Audio → text | `POST /v1/chat/completions`, content part `{"type":"input_audio","input_audio":{"data":<b64>,"format":"wav"}}` | ✅ verbatim transcript + task extraction, ~23s cold |
| Streaming | `/v1/chat/completions` with `stream:true` (SSE `data:` deltas) | ✅ **first token 0.55s warm**, token-by-token |
| Vision → text | content part `{"type":"image_url","image_url":{"url":"data:image/png;base64,<b64>"}}` | ✅ OCR'd "Q3 Revenue: $1,234,567", 3.9s |
| Native `/api/chat` audio | message `audio:[...]` field | ❌ silently ignored — **do not use** |

**Conclusion:** use the **OpenAI-compatible `/v1/chat/completions` endpoint uniformly** for text,
audio, and vision. One content-parts format, native streaming, one auditable egress point.

## 3. Model & runtime decision

- **Model (all features):** `gemma4:latest` — the **8B multimodal GGUF** build. It is the only
  Gemma 4 in Ollama that supports **audio + vision** (validated §2): caps =
  `completion, vision, audio, tools, thinking`. First token 0.55s warm.
- **Why not the 12B:** the model is multimodal by design (per Google's announcement), but **no
  runtime available today can do 12B audio**. `gemma4:12b-mlx` is **text-only** — the MLX runtime
  drops multimodal input (validated: caps = `completion, tools, thinking`; live audio + vision both
  failed, ~12s cold first token). No multimodal 12B GGUF exists in Ollama yet (`gemma4:12b` → 404);
  the community GGUF (`unsloth/gemma-4-12b-it-GGUF`) ships a vision projector but **no audio
  projector**. Voice (P0-2) — the headline feature — therefore requires the 8B.
- **Future-proofing:** the model is a single settings field behind the `LlmProvider` abstraction.
  Point text/Q&A at a larger model later (the text-only `gemma4:12b-mlx` is installed), or switch
  everything to a 12B the day Ollama publishes a multimodal 12B build — no code change.
- **Hardware:** M1 Pro / 32 GB — the PRD's 16 GB contention risk does not apply.

## 4. Architecture

Layered core (one responsibility per unit, testable without Obsidian) + thin feature orchestrators.

```
src/
  main.ts                  # plugin lifecycle; registers commands, file-menu items, the Q&A view
  settings.ts              # VaultBrainSettings model + DEFAULT_SETTINGS + VaultBrainSettingTab UI
  core/
    provider.ts            # LlmProvider interface (decouples features from Ollama specifics)
    ollama-provider.ts     # OllamaProvider: builds /v1 requests, streams SSE, aborts
    health.ts              # checkHealth(): server reachable? model present? capabilities? -> HealthState
    status-bar.ts          # status bar item reflecting HealthState with one-line fixes
    context-builder.ts     # ContextBuilder interface + ActiveNoteContextBuilder (note + 1-hop links)
    daily-note.ts          # resolveDailyNote(): read core daily-notes config, fall back to root/YYYY-MM-DD
    template.ts            # render(template, vars): {{transcript}} {{summary}} {{tasks}} {{date}} {{title}}
    audio.ts               # toWav16kMono(bytes): decode via Web Audio API -> mono 16kHz PCM -> WAV
    tokens.ts              # estimate(text) + truncateToBudget(text, cap)
    prompts.ts             # system/user prompt builders per feature
  features/
    voice.ts               # P0-2 orchestrator
    vision.ts              # P0-3 orchestrator
    qa-view.ts             # P0-4 ItemView (chat panel)
  util/
    notice.ts              # showError(msg, fix) / showInfo(msg) — consistent, never silent
```

## 5. Core component contracts

**`LlmProvider` (provider.ts)**
```ts
type Part =
  | { type: 'text'; text: string }
  | { type: 'image'; mime: string; dataB64: string }
  | { type: 'audio'; format: 'wav'; dataB64: string };
interface ChatMessage { role: 'system' | 'user' | 'assistant'; parts: Part[]; }
interface LlmProvider {
  chatStream(messages: ChatMessage[], opts: { signal: AbortSignal; onToken: (t: string) => void }): Promise<string>;
  listModels(): Promise<string[]>;
  showCapabilities(model: string): Promise<string[]>; // ['completion','vision','audio',...]
}
```
- `OllamaProvider` maps `Part` → OpenAI content parts (`text` / `image_url` data URL / `input_audio`),
  POSTs to `{host}/v1/chat/completions`, parses SSE `delta.content`, honors `AbortSignal`, applies a
  fetch timeout. **This file contains the only `fetch` in the codebase.**

**`ContextBuilder` (context-builder.ts)** — `build(file): Promise<{ text: string; truncated: boolean }>`.
`ActiveNoteContextBuilder` = active note body + bodies of 1-hop links (`metadataCache.resolvedLinks`),
joined with `## <title>` headers, capped via `tokens.truncateToBudget`. Pluggable for future RAG (P2).

**`health.ts`** — `HealthState = { server: 'up'|'down'; model: 'ready'|'missing'; caps: string[] }`.

**`daily-note.ts`** — reads `app.internalPlugins` daily-notes config (folder, date format, template);
falls back to vault root + `YYYY-MM-DD` (AW2's current effective defaults). Creates today's note if absent.

**`audio.ts`** — `toWav16kMono(ArrayBuffer): Promise<Uint8Array>` via `AudioContext.decodeAudioData`
(handles m4a/mp3/wav/ogg/webm) → downmix mono → resample 16 kHz → encode 16-bit PCM WAV. No ffmpeg,
no external binary. **Never writes back to the original attachment.**

## 6. Health & status (P0-1)

On load, on interval (configurable, default 30s), and before each operation: `checkHealth()` —
which calls `LlmProvider.listModels()` / `showCapabilities()` (no direct `fetch`, so the single
egress point in §9 holds). Status bar item:
- 🟢 **Ready** — server up, model present.
- 🟡 **Model not pulled** — click → notice with copyable `ollama pull gemma4:latest` (the configured model).
- 🔴 **Ollama not running** — click → notice "Start Ollama (run `ollama serve` or open Ollama.app)".

All requests are localhost-only by default. No silent failure states anywhere.

## 7. Settings (P0-6) — defaults work out of the box

| Setting | Default | Notes |
|---|---|---|
| Host | `http://127.0.0.1` | Validated as loopback; non-local triggers a warning |
| Port | `11434` | |
| Model | `gemma4:latest` | 8B multimodal (audio+vision+text). The text-only `gemma4:12b-mlx` can be set for text features later |
| Output template | (see §8) | User-editable textarea |
| Daily-note mode | **append-to-daily** | or `new-note-per-memo` |
| Daily-note folder / format | auto-detected | overridable; falls back to root / `YYYY-MM-DD` |
| Context token cap | `8000` | hard cap for Q&A context |
| Output language | **auto** | or `EN` / `SR` |
| Keep-alive | off | P1-3; pings to keep the model warm during a session |

## 8. Features

### P0-2 Voice memo → structured note
1. Trigger: file-menu "Vault Brain: Voice memo → note" on an audio file (`.m4a/.mp3/.wav/.ogg/.webm`),
   or command on the active audio file.
2. `readBinary` → `audio.toWav16kMono` (original untouched).
3. One multimodal call. System prompt: *transcribe verbatim in the spoken language; then a ≤5-bullet
   summary; then action items as `- [ ]`.* Output in fenced sections for reliable parsing.
4. Parse sections → `template.render` → write per daily-note mode.
5. Progress notices; optional latency footer (P1-4).

Default template:
```
## 🎙️ Voice memo — {{date}}
**Summary**
{{summary}}

**Tasks**
{{tasks}}

**Transcript**
{{transcript}}
```
**Acceptance:** offline (Wi-Fi off); 5-min memo < 60s warm; template-driven; original audio never
modified; Serbian and English both validated (10-memo eval set).

### P0-3 Image → markdown extraction
Trigger on an embedded image / image file → base64 → prompt "extract all text and structure as clean
markdown; tables as markdown tables" → insert below the embed / at cursor.
**Acceptance:** screenshots and photos handled; failure shows an error notice, never silently empty.

### P0-4 Note Q&A side panel
Right-sidebar `ItemView`: message list + input + send + **stop**. On open / active-note change,
`ActiveNoteContextBuilder` builds context (active note + 1-hop links, hard token cap). Truncation →
visible warning chip. Answers streamed. **Conversation resets on note switch** (no hidden state).
Context is read-only; the plugin never performs agentic vault edits (injection boundary).
**Acceptance:** context = active note + 1-hop; cap enforced; truncation warned; per-note reset.

## 9. Privacy (P0-5)

Exactly one network egress (`ollama-provider.ts`), to the configured localhost endpoint. Host
validated as loopback by default; override warns. Stated in README + settings. Verified by: bundle
grep for network APIs (CI check) + a documented runtime network audit.

## 10. Error handling

Central `notice.ts`. Every failure path surfaces *what broke + the one-line fix*. No empty catches.
Fetch timeouts. Abort in-flight requests on view close / note switch / explicit stop.

## 11. Testing strategy

- **Unit (no Obsidian):** template, tokens, context-builder (mock vault), WAV encoder (header/PCM
  assertions), section parser, daily-note resolver — `node:test`, no heavy deps.
- **Contract:** the §2 probes against local Ollama, skipped when offline.
- **SR/EN eval:** 10 voice memos (5 SR, 5 EN); ≥80% processed without manual retry.
- **Privacy audit:** bundle grep + runtime network capture, documented in README.
- **Manual:** install into `AW2`, exercise each command.

## 12. Build, dev & install

esbuild bundle → `main.js` + `manifest.json` + `styles.css`, output symlinked into
`AW2/.obsidian/plugins/vault-brain/`. `esbuild --watch` for live iteration; reload Obsidian to test.

## 13. Build order (lowest-risk first, one cohesive build)

1. Scaffold + transport core + settings + health/status (foundation).
2. Q&A panel (exercises streaming + context-builder).
3. Vision (image transport + insertion).
4. Voice (audio normalize + template + daily-note).
5. Privacy audit + polish + install into `AW2`.

## 14. Out of scope (v1) — mirrors PRD non-goals

Whole-vault RAG/embeddings; agentic write actions; cloud fallback; mobile; model
download/management inside the plugin; multi-model beyond the Gemma 4 family.

## 15. Notes & future options

- **No setup blockers remain.** Ollama is on 0.30.4; `gemma4:latest` (8B) is installed and fully
  validated; the default and only model the plugin needs is `gemma4:latest`.
- **12B (text-only) is installed** (`gemma4:12b-mlx`) and may be opted into for the Q&A panel / text
  actions later via the model setting — if its larger reasoning is worth the ~12s cold first token.
- **Multimodal 12B:** revisit when Ollama publishes a multimodal 12B GGUF (with an audio projector);
  switching is a one-field change.
