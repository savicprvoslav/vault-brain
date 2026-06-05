# Changelog

All notable changes to Vault Brain are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-06-05

First public release — fully-local, multimodal AI for Obsidian via **Gemma 4** on **Ollama**.

### Added

- **Voice** — voice memo → structured note (verbatim transcript + summary + extracted `- [ ]` tasks);
  in-app recording with pause / resume / stop / cancel + microphone selection; meeting (diarization)
  mode; auto-watch folder for drop-in transcription.
- **Vision** — image → Markdown OCR (tables included); PDF → text via the vision model.
- **Chat, search & edit** — chat over the active note and its links; whole-vault semantic RAG with
  `[[note]]` citations (local `nomic-embed-text`, incremental file-based index); "Edit this note"
  (instruction → red/green diff → apply, Cmd-Z undoable).
- **Related-notes sidebar** — live, semantic suggestions for whatever you're viewing.
- **Writing** — summarize / improve / format / translate (SR↔EN) / fix grammar; user-defined custom
  prompts; continue-writing at cursor; suggest tags; link mentions of existing notes.
- **Status & setup** — connection indicator (🟢/🟡/🔴) with one-click fixes, live activity tracker,
  and a guided setup that detects Ollama and one-click-pulls missing models.
- **Privacy by design** — a single auditable network egress (`src/core/ollama-provider.ts`),
  localhost-only, with a non-loopback warning.

### Requirements

- Desktop Obsidian 1.5.0+, [Ollama](https://ollama.com) 0.30.5+, `gemma4:12b` (+ `nomic-embed-text`
  for whole-vault search).

[0.1.0]: https://github.com/savicprvoslav/vault-brain/releases/tag/0.1.0
