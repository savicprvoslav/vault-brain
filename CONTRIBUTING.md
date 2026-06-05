# Contributing to Vault Brain

Thanks for your interest! Vault Brain is a **fully-local** Obsidian plugin — every AI feature runs
against your own Ollama endpoint. Privacy is a hard invariant here, not a marketing feature.

## Development

```bash
npm install
npm run dev     # esbuild watch → main.js
npm run build   # type-check (tsc) + production bundle
npm test        # unit tests (Node's test runner via tsx)
```

To try a build in Obsidian, copy or symlink `main.js`, `manifest.json`, and `styles.css` into a test
vault's `.obsidian/plugins/vault-brain/`, then enable the plugin and reload.

## Architecture

The code is split into two layers so the logic stays testable and the network surface stays auditable:

- **`src/core/`** — pure, Obsidian-free logic: prompt building, parsing, RAG math, the Ollama
  transport. Unit-tested in isolation with `node:test`. Nothing here imports from `obsidian`.
- **`src/features/`** — thin Obsidian glue: views, commands, modals, ribbons. Wires core logic to the
  app via the `LlmProvider` interface.

When a `core` file grows large or starts doing two things, split it. Keep units small and focused.

## The single-egress invariant

**All network I/O lives in exactly one file: [`src/core/ollama-provider.ts`](src/core/ollama-provider.ts).**
There is one `fetch` call site in the whole codebase, and it only ever talks to the user's configured
localhost Ollama endpoint. Please keep it that way — do **not** add `fetch`, `requestUrl`,
`XMLHttpRequest`, WebSockets, or any other network call elsewhere. If a feature needs the model, route
it through `LlmProvider`. This is what lets users (and reviewers) trust that nothing leaves the machine.

## Pull requests

- Run `npm run build` and `npm test` before opening a PR — CI runs both on every push.
- Add unit tests for new `core` behavior; keep core logic pure.
- Avoid new runtime dependencies unless there's a clear need.
- Match the existing TypeScript style.

## Reporting issues

Use the [issue tracker](https://github.com/savicprvoslav/vault-brain/issues). For bugs, include your
OS, Obsidian version, Ollama version, and the model you're running (`gemma4:12b` by default).
