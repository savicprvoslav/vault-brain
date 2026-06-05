# Vault Brain — Launch Plan

## Positioning (the wedge)
**Vault Brain is the only *multimodal* AI plugin for Obsidian — talk to your vault, snap images into notes, and chat across everything, 100% locally.** Every other AI plugin is text-only and/or cloud-default. Lead with **voice + privacy**: *"Drop a voice memo, get a structured note — nothing leaves your machine."* That's a story no competitor can tell.

**One-liner:** Fully-local, multimodal AI for Obsidian — voice memos → notes, image OCR, whole-vault RAG chat, and AI writing, powered by Gemma 4 on Ollama.

---

## 1. Demo GIFs (record these first — they carry the launch)
Short (8–15s each), captioned, retina, in a clean demo vault. Order by "wow":

1. **Voice → note** *(the hero)* — click the mic, say a 2-line memo with a couple of tasks, stop → the daily note fills with summary + `- [ ]` tasks + transcript. Caption: *"Voice memo → structured note. Local. ~10s."*
2. **Whole-vault RAG** — open the Q&A panel → "Whole vault" → ask *"what did we commit to on our last security call?"* → streamed answer + `Sources: [[...]]`. Caption: *"Ask your whole vault. With citations."*
3. **Related notes** — scroll between notes; the sidebar live-updates with semantically related notes. Caption: *"See related notes as you write — semantic, not keyword."*
4. **Edit with diff** — "Edit this note" → *"make the headings consistent"* → red/green diff → Apply. Caption: *"Edit by instruction. Preview the diff. Cmd-Z to undo."*
5. *(optional)* **Image → Markdown** — paste a screenshot → extract → clean table appears.

Tools: macOS screen recording → [Gifski](https://gif.ski/) or Kap. Keep each < 3 MB.

---

## 2. Obsidian Forum — "Share & showcase" post

**Title:** `Vault Brain — fully-local, multimodal AI (voice, vision, RAG) via Gemma 4 + Ollama`

**Body:**

> I wanted AI in Obsidian without sending my vault to the cloud — and I wanted **voice**, which nothing local seemed to do. So I built **Vault Brain**: a fully-local, **multimodal** assistant running on **Gemma 4** via **Ollama**. No cloud, no API keys, one auditable localhost call.
>
> **What it does**
> - 🎙️ **Voice memo → structured note** — transcript + summary + `- [ ]` tasks. In-app recording (pause/stop/cancel + mic select), meeting/diarization mode, and an auto-watch folder.
> - 🖼️ **Image → Markdown** — OCR screenshots/photos (tables included). Plus **PDF → text** via the vision model.
> - 💬 **Chat** — over the active note + links, or **semantic search across your whole vault** with `[[note]]` citations. Plus an **"Edit this note"** mode (instruction → diff → apply, undoable).
> - 🔗 **Related-notes sidebar** — live, semantic.
> - ✍️ **Writing** — summarize/improve/format/translate/grammar, **your own custom prompts**, "continue writing", auto-tag, auto-link.
>
> **Private by design:** exactly one network call site, localhost-only, with a non-loopback warning. Turn Wi-Fi off and voice still works.
>
> **Requirements:** desktop, [Ollama](https://ollama.com), and `gemma4:latest` (+ `nomic-embed-text` for search). A **guided setup** detects everything and **one-click-pulls** missing models for you.
>
> Repo + README: `github.com/savicprvoslav/vault-brain`. Feedback very welcome — especially on Serbian/other-language voice and on hardware/setup friction.
>
> *(GIFs: voice→note, vault RAG, related notes, edit-diff)*

---

## 3. r/ObsidianMD post (hook-first, short)

**Title:** `I built a 100% local AI plugin for Obsidian that turns voice memos into structured notes — no cloud`

**Body:**

> Most Obsidian AI plugins are text-only and cloud-default. I wanted **voice** and **privacy**, so I built **Vault Brain** — multimodal AI running entirely on your machine via Ollama + Gemma 4.
>
> - 🎙️ Record a voice memo → transcript + summary + tasks in your daily note
> - 💬 Chat over your whole vault (semantic search, with citations)
> - 🖼️ Screenshot/PDF → Markdown (OCR)
> - 🔗 Live related-notes sidebar · ✍️ AI writing + custom prompts
> - 🔒 One localhost call, nothing leaves your machine
>
> Desktop + Ollama required; a guided setup pulls the models for you. Repo in comments. Would love feedback. *(GIF)*

Post mid-week morning ET. Reply to every comment for the first few hours (drives the algorithm).

---

## 4. Release notes — v0.1.0

> **Vault Brain 0.1.0 — first release**
> Fully-local, multimodal AI for Obsidian via Gemma 4 on Ollama.
> - 🎙️ Voice: memo→note, in-app recording (pause/cancel/mic-select), meeting mode, auto-watch folder
> - 🖼️ Vision: image→Markdown, PDF→text (OCR)
> - 💬 Chat: this-note / whole-vault RAG (cited) / edit-with-diff; `+context`, Markdown render, clickable links
> - 🔗 Live related-notes sidebar
> - ✍️ Selection actions, custom prompts, continue-writing, auto-tag, auto-link
> - 🧠 Activity tracker · guided setup with one-click model pull · single auditable egress
> Requires desktop Obsidian 1.5+, Ollama, `gemma4:latest` (+ `nomic-embed-text`).

---

## 5. Launch checklist
- [ ] Record the 4–5 demo GIFs
- [ ] `gh repo edit savicprvoslav/vault-brain --visibility public --accept-visibility-change-consequences`
- [ ] `npm run build` → `gh release create 0.1.0 main.js manifest.json styles.css --title 0.1.0 --notes-file <release notes>`
- [ ] PR to `obsidianmd/obsidian-releases` adding the `community-plugins.json` entry
- [ ] Post to Obsidian Forum (Share & showcase) with GIFs
- [ ] Post to r/ObsidianMD
- [ ] *(optional)* Ollama Discord/showcase, Hacker News "Show HN", LinkedIn (you're an AI Eng Director — the privacy/multimodal angle plays well there)

## 6. Talking points / FAQ
- **"Why local?"** Privacy (NDA/journals/legal), $0 per use, works offline.
- **"Why Gemma 4?"** Only model that does text+audio+vision in one local model via Ollama.
- **"Hardware?"** ~16 GB RAM, the model is ~10 GB; Apple Silicon shines.
- **"vs Smart Connections / Copilot?"** They're great at text/cloud; Vault Brain owns **voice + vision + absolute-local**.
