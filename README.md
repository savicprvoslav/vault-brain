# Vault Brain

**Fully-local, multimodal AI for Obsidian.** Voice memos → structured notes, images → Markdown, and chat over your notes — powered by **Gemma 4** running on **Ollama**. No cloud. No API keys. **Zero data leaves your machine.**

> Every AI feature runs against a local Ollama endpoint on `127.0.0.1`. There is exactly **one** network call site in the entire codebase ([`src/core/ollama-provider.ts`](src/core/ollama-provider.ts)) and it only ever talks to your configured localhost endpoint. See [Privacy & network audit](#privacy--network-audit).

---

## Features

### 🎙️ Voice memo → structured note
Right-click an audio file (`.m4a`, `.wav`, `.mp3`, `.ogg`, `.webm`, …) → **"Vault Brain: Voice memo → note"** (or run the command to process your most recent recording). The audio is transcribed and turned into a templated note section:

- **Transcript** (verbatim, in the spoken language — Serbian and English both work)
- **Summary** (≤ 5 bullets)
- **Tasks** as `- [ ]` checkboxes

…appended to today's **daily note** (or a new note per memo — your choice in settings). Your original audio file is never modified.

### 🖼️ Image → Markdown
Put your cursor on (or just below) an embedded image and run **"Vault Brain: Extract text from image below cursor"**. Screenshots, photos, dashboards, and whiteboards become clean Markdown (tables included), inserted right below the image.

### 💬 Note Q&A panel
Click the speech-bubble ribbon icon (or run **"Vault Brain: Open Q&A panel"**) to chat over your **active note + its directly-linked notes**. Answers stream token-by-token. Context is capped (with a truncation warning when exceeded), the conversation resets when you switch notes, and the plugin only ever *reads* your vault.

### 🔌 Connection status
A status-bar item shows 🟢 ready / 🟡 model-not-pulled / 🔴 Ollama-not-running, each with a one-click actionable hint.

---

## Requirements

- **Obsidian** 1.5.0+ on **desktop** (macOS/Windows/Linux). This plugin is desktop-only — local inference isn't available on mobile.
- **[Ollama](https://ollama.com)** installed and running.
- The **`gemma4:latest`** model (the 8B multimodal build — supports audio + vision).
- ~16 GB RAM recommended (the model is ~10 GB). Apple Silicon or a comparable machine.

## Setup

1. **Install Ollama** from [ollama.com](https://ollama.com) and make sure it's running (`ollama serve`, or just open the app).
2. **Pull the model:**
   ```bash
   ollama pull gemma4:latest
   ```
3. **Install the plugin** (until it's in the community directory): copy `main.js`, `manifest.json`, and `styles.css` into `<your-vault>/.obsidian/plugins/vault-brain/`, then enable **Vault Brain** under Settings → Community plugins.
4. Open Settings → **Vault Brain** — the defaults work out of the box. The status bar should show **🟢 Vault Brain**.

> **About the model:** the default is `gemma4:latest` (8B), which is the only Gemma 4 build in Ollama today that supports **audio and vision** — the headline voice and image features need it. The 12B build (`gemma4:12b-mlx`) is currently **text-only** via Ollama's MLX runtime, so it can't do voice or images; you can point the model setting at it for text/Q&A if you prefer the larger model, but leave it on `gemma4:latest` for the full feature set.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Ollama host / port | `http://127.0.0.1` / `11434` | Localhost only; a non-local host triggers a privacy warning |
| Model | `gemma4:latest` | 8B multimodal |
| Daily-note mode | Append to today's note | or "new note per memo" |
| Output language | Auto (match input) | or force EN / SR |
| Context token cap | 8000 | hard cap for the Q&A panel |
| Output template | (see settings) | placeholders: `{{date}} {{title}} {{summary}} {{tasks}} {{transcript}}` |

---

## Privacy & network audit

Vault Brain is local-only by design. To verify it yourself:

1. **Read the code.** There is one network call site — [`src/core/ollama-provider.ts`](src/core/ollama-provider.ts). Confirm it:
   ```bash
   grep -rln fetch src/      # → only src/core/ollama-provider.ts
   ```
2. **Watch the traffic.** With a network monitor (Little Snitch, `lsof -i`, or a proxy), exercise every feature. The only connections are to your configured `127.0.0.1:11434`.
3. **Pull the plug.** Turn Wi-Fi off and process a voice memo — it still works end-to-end.

The host defaults to loopback and the plugin warns if you point it anywhere non-local.

---

## Development

```bash
npm install
npm run dev      # esbuild watch → main.js
npm test         # node:test unit + live Ollama contract tests (skip if offline)
npm run build    # type-check + production bundle
```

Architecture: a thin, obsidian-free `src/core/` (transport, context building, prompts, parsing — all unit-tested) behind an `LlmProvider` interface, with feature orchestrators in `src/features/`. Design notes live in [`docs/superpowers/specs`](docs/superpowers/specs) and the build plans in [`docs/superpowers/plans`](docs/superpowers/plans).

## License

MIT — see [LICENSE](LICENSE).
