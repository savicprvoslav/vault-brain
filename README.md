# Vault Brain

[![CI](https://github.com/savicprvoslav/vault-brain/actions/workflows/ci.yml/badge.svg)](https://github.com/savicprvoslav/vault-brain/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Platform: desktop](https://img.shields.io/badge/platform-desktop-blue) ![100% local](https://img.shields.io/badge/AI-100%25%20local-brightgreen) ![Gemma 4 + Ollama](https://img.shields.io/badge/Gemma%204-Ollama-orange)

**Fully-local, multimodal AI for Obsidian.** Talk to your vault, snap images into notes, search across everything semantically, and write with AI — all powered by **Gemma 4** on **Ollama**. No cloud. No API keys. **Zero data leaves your machine.**

> Every AI feature runs against a local Ollama endpoint on `127.0.0.1`. There is exactly **one** network call site in the entire codebase ([`src/core/ollama-provider.ts`](src/core/ollama-provider.ts)) and it only ever talks to your configured localhost endpoint. See [Privacy & network audit](#privacy--network-audit).

**Contents:** [Features](#features) · [Requirements](#requirements) · [Setup](#setup) · [Commands](#commands) · [Settings](#settings) · [Privacy](#privacy--network-audit) · [Development](#development) · [License](#license)

---

## Features

### 🎙️ Voice
- **Voice memo → structured note** — right-click an audio file (or process your most recent) → verbatim **transcript** + ≤5-bullet **summary** + extracted `- [ ]` **tasks**, written to your daily note (or a new note). Serbian & English. *Your original audio is never modified.*
- **In-app recording** — a mic ribbon button opens a floating control bar with **Pause / Resume / Stop / Cancel** and a live timer. Stop → it transcribes and **opens the note at the new memo**. (Transcribe-and-discard — no audio clutter.)
- **Microphone selection** — choose your input device in settings.
- **Meeting mode** — right-click audio → "Process as meeting (who said what)" → diarized transcript + decisions + action items.
- **Auto-watch folder** — drop audio into a configured folder and it's transcribed automatically.

### 🖼️ Vision
- **Image → Markdown** — cursor on an embedded image → "Extract text from image below cursor" → clean Markdown (tables included) inserted below it.

### 💬 Chat, search & edit
A right-sidebar panel with three modes:
- **This note + links** — chat over the active note and its 1-hop links. Add more with the **+ Context** picker (any note or folder).
- **Whole vault (RAG)** — semantic search across your whole vault with `[[note]]` **citations** (local `nomic-embed-text`, file-based index, auto-built & incremental).
- **Edit this note** — give an instruction (*"replace X with Y"*, *"make headings consistent"*); preview a **red/green diff**, then **Apply** (Cmd-Z undoable).

Answers render as Markdown with clickable `[[links]]`, a copy button, and modern chat bubbles.

### 🔗 Discovery
- **Related notes sidebar** — a live panel showing the most semantically-related notes to whatever you're viewing (reuses the vault index).

### ✍️ Writing
- **Selection actions** (right-click → Vault Brain): **Summarize · Improve · Format · Translate SR↔EN · Fix grammar**.
- **Custom prompts** — define your own `Name :: instruction` actions in settings; they appear in the same submenu.
- **Continue writing** — "Continue writing at cursor" streams an AI continuation in place.
- **Suggest tags** — AI suggests tags and writes them to the note's frontmatter.
- **Link mentions** — wraps plain-text mentions of your other note titles in `[[ ]]` (deterministic, no AI).

### 🔌 Status
- **Connection indicator** (🟢/🟡/🔴) with one-click fixes, and a **🧠 activity indicator** showing live status of every running operation + a recent-activity log.

---

## Requirements

- **Obsidian 1.5.0+ on desktop** (macOS / Windows / Linux). Desktop-only — local inference isn't available on mobile.
- **[Ollama](https://ollama.com) 0.30.5+** installed and running.
- **`gemma4:12b`** (multimodal — audio + vision + text) and, for vault search, **`nomic-embed-text`**.
- ~16 GB RAM recommended (the 12B model is ~7.6 GB on disk). Apple Silicon or comparable.

## Setup

1. **Install Ollama** ([ollama.com](https://ollama.com)) and make sure it's running (`ollama serve`, or open the app).
2. **Pull the models:**
   ```bash
   ollama pull gemma4:12b
   ollama pull nomic-embed-text   # for whole-vault search
   ```
3. **Install the plugin** (until it's in the community directory): copy `main.js`, `manifest.json`, and `styles.css` into `<your-vault>/.obsidian/plugins/vault-brain/`, then enable **Vault Brain** under Settings → Community plugins.
4. Open Settings → **Vault Brain** — defaults work out of the box; the status bar should show **🟢 Vault Brain**.

> **About the model:** `gemma4:12b` is the recommended build — it's **fully multimodal** (audio + vision + text), so voice, image OCR, and chat all run on one model. It needs **Ollama 0.30.5+** (older versions return a `412` when pulling it). Want something lighter? The 8B **`gemma4:latest`** is also fully multimodal and faster (just less capable) — pick it in Settings → Vault Brain → **Model**. Avoid **`gemma4:12b-mlx`**: that MLX build is **text-only** (no voice or vision).

### Remote server (advanced)

Vault Brain can also talk to Ollama running on **another machine you own** — a home server or a
DGX-class box — so a light laptop can use a heavy model:

- **Bare Ollama on your LAN** — set *Ollama host* to `http://192.168.x.y` (keep the port). Recent
  Ollama allows Obsidian's origin by default; if you hit a CORS error, start the server with
  `OLLAMA_ORIGINS="app://obsidian.md"`.
- **Open WebUI** (fronts Ollama with API keys) — set *Ollama host* to `https://your-host/ollama`
  (Open WebUI's Ollama proxy path; the port setting is ignored when the host has a path) and paste
  an API key from Open WebUI → Settings → Account into the **API token** setting. The token is sent
  as `Authorization: Bearer …` on every request.

> **Privacy:** pointing the plugin at a remote server sends your note content to that machine — only
> use hardware you trust. The token is stored unencrypted in
> `.obsidian/plugins/vault-brain/data.json`. The single auditable network egress is unchanged.

## Commands

Voice memo → note · Start/Stop voice recording · Process as meeting · Extract text from image · Open Q&A panel · Open related notes · Rebuild vault index · Selection: Summarize/Improve/Format/Translate/Fix grammar (+ your custom prompts) · Continue writing at cursor · Suggest tags for this note · Link mentions of existing notes · Test connection.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Ollama host / port | `http://127.0.0.1` / `11434` | Localhost only; non-local triggers a privacy warning |
| Model | `gemma4:12b` | multimodal (audio + vision + text); pick any installed model from the dropdown |
| Embedding model | `nomic-embed-text:latest` | for whole-vault search |
| Vault search results (top-K) | 6 | chunks retrieved per question |
| Daily-note mode | Append to today's note | or "new note per memo" |
| Output language | Auto | or force EN / SR |
| Context token cap | 8000 | hard cap for chat context |
| Microphone | System default | input device for recording |
| Auto-watch folder | (off) | auto-transcribe audio dropped here |
| Keep model warm | off | periodic ping to avoid cold starts |
| Output template | (editable) | `{{date}} {{title}} {{summary}} {{tasks}} {{transcript}}` |
| Custom prompts | (empty) | one per line: `Name :: instruction` |

---

## Privacy & network audit

Local-only by design. Verify it yourself:

1. **Read the code.** One network call site — [`src/core/ollama-provider.ts`](src/core/ollama-provider.ts):
   ```bash
   grep -rln fetch src/      # → only src/core/ollama-provider.ts
   ```
2. **Watch the traffic.** With Little Snitch / `lsof -i` / a proxy, exercise every feature — the only connections are to `127.0.0.1:11434`.
3. **Pull the plug.** Turn Wi-Fi off and record/transcribe a memo — it still works end-to-end.

---

## Development

```bash
npm install
npm run dev      # esbuild watch → main.js
npm test         # node:test unit + live Ollama contract tests (skip if offline)
npm run build    # type-check + production bundle
```

Architecture: a thin, obsidian-free `src/core/` (24 unit-tested modules — transport, context building, prompts, parsing, similarity, diff) behind an `LlmProvider` interface, with 9 feature orchestrators in `src/features/`. 87 tests. Design specs and build plans live in [`docs/`](docs/).

## License

MIT — see [LICENSE](LICENSE).
