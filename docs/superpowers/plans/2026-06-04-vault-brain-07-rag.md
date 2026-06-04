# Vault Brain — Plan 7: Vault RAG Search

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Full implementation code is carried in the dispatch prompts; this is the task map + acceptance.

**Goal:** Whole-vault semantic search in the Q&A panel — embed the question, retrieve top-K note chunks by cosine, answer grounded in them with `[[note]]` citations. File-based, auto-indexed. (Spec: `docs/superpowers/specs/2026-06-04-vault-brain-rag-design.md`.)

## Tasks & order

**Unit A — RAG core (provider.embed + pure modules + settings):**
- **A1** `provider.ts`: add `embed(model, texts[]): Promise<number[][]>` to `LlmProvider`. `ollama-provider.ts`: implement via `POST /api/embed` `{model, input: texts}` (60s timeout). Update the `LlmProvider` stub in `tests/health.test.ts` (+ `embed: async () => []`). Add an `embed` case to `tests/contract.test.ts` (768-dim, skips offline).
- **A2** `core/chunk.ts` (TDD) — `chunkNote(text, maxTokens=500): string[]`.
- **A3** `core/similarity.ts` (TDD) — `cosine(a,b)`, `topK(query, items, k)`.
- **A4** `core/rag-context.ts` (TDD) — `RagHit`, `assembleRagContext(hits, cap): { text, sources, truncated }`.
- **A5** `core/settings-model.ts`: add `embedModel` (`"nomic-embed-text:latest"`) + `ragTopK` (`6`) to the interface, `DEFAULT_SETTINGS`, and `normalizeSettings` (clamp `ragTopK` ≥1). `settings.ts`: two new controls.

**Unit B — Index + wiring:**
- **B1** `features/vault-index.ts` — `VaultIndex` class (load/save-debounced/updateFile/removeFile/reconcile/reindexAll/search).
- **B2** `main.ts` — add `vaultIndex` field; on `onLayoutReady` load + reconcile; register md `create/modify/delete/rename` events; "Rebuild vault index" command. Add `vault-index.json` to `.gitignore`.

**Unit C — Panel integration:**
- **C1** `features/qa-view.ts` — add a "This note / Whole vault" mode toggle; in vault mode use `vaultIndex.search` → `assembleRagContext` → `buildQaMessages` → stream → append `Sources:` line; truncation chip from the rag context; note-switch reset only in "this note" mode; switching mode clears the conversation.

## Definition of Done
- `npm test` green (prior 52 + chunk + similarity + rag-context tests; contract gains an embed check).
- `npm run build` clean; privacy invariant intact (embed goes through `ollama-provider.ts`).
- In Obsidian: "Whole vault" mode answers from across notes with citations; index auto-builds on load and updates on edits; "Rebuild vault index" works.
- RAG core (`chunk`, `similarity`, `rag-context`) has no `obsidian` import.
