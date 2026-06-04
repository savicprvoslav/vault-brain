# Vault Brain — Vault RAG Search Design Spec

**Status:** Approved · **Date:** 2026-06-04 · **Owner:** Prvoslav
**Builds on:** the v1 P0 plugin + P1 additions. Realizes the PRD's P2 "whole-vault retrieval."

## Summary
Local, file-based semantic search over the whole vault, integrated into the Q&A panel as a "Whole vault" mode. Ask "what did we commit to on our last security call" → the question is embedded, the most similar note chunks are retrieved by cosine similarity, and Gemma answers grounded in them with `[[note]]` citations. No database, no server — a single vector file the plugin loads into memory.

## Validated (spike)
- `nomic-embed-text:latest` via Ollama `/api/embed` (batch) → 768-dim vectors, ~109 chunks/sec warm.
- AW2: 60 notes / ~29 chunks → full index < 1s, vector file < 100 KB. Scale concerns from the PRD do not apply here.

## Architecture

**Pure core (unit-tested, no `obsidian`):**
- `core/chunk.ts` — `chunkNote(text, maxTokens=500): string[]` on paragraph boundaries; hard-splits oversized paragraphs.
- `core/similarity.ts` — `cosine(a,b)`; `topK(query, items, k)`.
- `core/rag-context.ts` — `assembleRagContext(hits, capTokens): { text, sources, truncated }` (joins chunk blocks under note titles within the cap; dedups sources).

**Transport (one addition, same single egress):**
- `LlmProvider.embed(model, texts[]): Promise<number[][]>` → `OllamaProvider` POSTs `/api/embed` `{model, input: texts}` (generous timeout). New setting **embed model** (default `nomic-embed-text:latest`).

**Index (`features/vault-index.ts`, obsidian):**
- In-memory `Record<path, { mtime, chunks: {text, vector}[] }>`, persisted to `vault-index.json` in the plugin folder (gitignored; not a note).
- `load()`, `save()` (debounced), `updateFile(file)`, `removeFile(path)`, `reconcile()` (re-embed changed/new, drop deleted), `reindexAll()`, `search(query, k): RagHit[]`.

**Auto-indexing (wiring in `main.ts`):**
- On `onLayoutReady`: `load()` then `reconcile()` in the background.
- Live updates via vault `create`/`modify`/`delete`/`rename` events (md only).
- Command **"Rebuild vault index"**.

**Chat integration (`features/qa-view.ts`):**
- A **"This note" / "Whole vault"** mode toggle in the panel header. Switching mode clears the conversation. The note-switch reset only applies in "this note" mode.
- Whole-vault mode: `search(question, ragTopK)` → `assembleRagContext` → `buildQaMessages` → stream → append `Sources: [[note]]…`. Truncation chip from `assembleRagContext`.

**Settings:** + embed model (`nomic-embed-text:latest`), + results count `ragTopK` (default 6). Added to `core/settings-model.ts` (incl. `normalizeSettings`) and the settings tab.

## Testing
- `chunk`, `similarity`, `rag-context` → TDD.
- `embed()` → live contract test (skips offline).
- Index, panel toggle, auto-index → manual verification.

## Out of scope
- Binary/quantized vector storage (JSON is fine at this scale; future optimization).
- Re-ranking, hybrid keyword+vector, multi-hop retrieval.
- Indexing non-markdown files.
