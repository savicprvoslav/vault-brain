import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkNote } from "../src/core/chunk.ts";

test("empty text -> no chunks", () => { assert.deepEqual(chunkNote(""), []); });
test("short text -> single chunk", () => { assert.deepEqual(chunkNote("hello world"), ["hello world"]); });
test("groups paragraphs under the cap", () => {
  const r = chunkNote("a\n\nb\n\nc", 100);
  assert.equal(r.length, 1);
  assert.match(r[0], /a\n\nb\n\nc/);
});
test("hard-splits a paragraph bigger than the cap", () => {
  const r = chunkNote("x".repeat(50), 10); // cap 40 chars
  assert.ok(r.length >= 2);
  for (const c of r) assert.ok(c.length <= 40);
});
test("starts a new chunk when adding a paragraph would exceed the cap", () => {
  const p = "y".repeat(30);
  const r = chunkNote(`${p}\n\n${p}`, 10);
  assert.equal(r.length, 2);
});
