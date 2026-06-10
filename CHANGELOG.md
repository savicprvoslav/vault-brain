# Changelog

All notable changes to Vault Brain are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] — 2026-06-10

Stability patch — fixes from a full code review of the feature layer.

### Fixed
- **Startup no longer re-processes existing files**: the auto-watch folder doesn't re-transcribe old
  audio on launch (no more duplicate memos in your daily note), and the vault isn't pointlessly
  re-embedded every time Obsidian starts.
- **"Continue writing" can no longer corrupt your note**: it streams append-only and stops safely if
  you edit the note or switch files mid-generation — instead of overwriting your text or writing into
  the wrong note.
- **Whole-vault Q&A shows a clear error** when Ollama is unreachable instead of silently doing nothing.
- **Vault index durability**: the index is saved atomically (a crash can't corrupt it), "Rebuild vault
  index" keeps your existing index until the rebuild actually succeeds, reports real success/failure
  counts, and aborts early with a helpful message when the embedding model is missing.
- **Voice memos are never lost**: missing daily-note folders are created automatically, a disabled
  Daily Notes plugin is handled, and if the target note can't be written the transcript is saved to a
  fallback note instead of being discarded.
- **"Keep model warm" no longer burns GPU on thinking models** — it uses Ollama's native keep-alive
  instead of sending a real prompt.
- Fixed a race where double-clicking the record button during the microphone permission prompt could
  leak a live mic stream.

### Changed
- CI/release workflows updated for the GitHub Actions Node 24 runtime (checkout v5, setup-node v5,
  attest-build-provenance v3).

## [0.1.2] — 2026-06-05

### Changed
- Releases are now built and signed in GitHub Actions with **build-provenance attestations**, so the
  published `main.js` and `styles.css` can be cryptographically verified against this source repository.

## [0.1.1] — 2026-06-05

### Fixed
- **Thinking models** (e.g. `gemma4:12b`): the model's chain-of-thought is now shown as a live
  "thinking…" indicator and the final answer is captured correctly — selection actions, voice/vision,
  and the setup test buttons no longer appear to hang.
- Code-quality pass for the community-directory review: CSS-class styling (no inline styles), settings
  headings, stronger typing, popout-window compatibility, and async lifecycle.

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

[0.1.3]: https://github.com/savicprvoslav/vault-brain/releases/tag/0.1.3
[0.1.2]: https://github.com/savicprvoslav/vault-brain/releases/tag/0.1.2
[0.1.1]: https://github.com/savicprvoslav/vault-brain/releases/tag/0.1.1
[0.1.0]: https://github.com/savicprvoslav/vault-brain/releases/tag/0.1.0
