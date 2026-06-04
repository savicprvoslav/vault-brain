import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleRagContext } from "../src/core/rag-context.ts";

const hit = (title: string, text: string, score = 1) => ({ path: `${title}.md`, title, text, score });

test("joins hits and dedups sources", () => {
  const r = assembleRagContext([hit("A", "alpha"), hit("B", "beta"), hit("A", "alpha2")], 1000);
  assert.match(r.text, /## A\nalpha/);
  assert.match(r.text, /## B\nbeta/);
  assert.deepEqual(r.sources, ["A", "B"]);
  assert.equal(r.truncated, false);
});
test("truncates when over the cap", () => {
  const big = "z".repeat(400);
  const r = assembleRagContext([hit("A", big), hit("B", big)], 40);
  assert.equal(r.truncated, true);
  assert.ok(r.sources.length < 2);
});
test("empty hits yield empty context", () => {
  assert.deepEqual(assembleRagContext([], 1000), { text: "", sources: [], truncated: false });
});
