import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSnippet } from "../src/core/snippet.ts";

test("strips frontmatter, heading and bold markers", () => {
  assert.equal(cleanSnippet("---\nstatus: active\n---\n# SDLC\n**Goal:** automate it"), "SDLC Goal: automate it");
});
test("unwraps wikilinks and removes list/checkbox markers", () => {
  assert.equal(cleanSnippet("- [ ] [[Maksym Lupei]] to create a PO"), "Maksym Lupei to create a PO");
});
test("uses alias for piped wikilinks and strips template placeholders", () => {
  assert.equal(cleanSnippet("# {{title}} — see [[Calendar V2|the calendar]]"), "title — see the calendar");
});
test("collapses whitespace and truncates with an ellipsis", () => {
  const s = cleanSnippet("a".repeat(200), 50);
  assert.equal(s.length, 51);
  assert.ok(s.endsWith("…"));
});
