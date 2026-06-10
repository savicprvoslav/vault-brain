import { test } from "node:test";
import assert from "node:assert/strict";
import { advancePos } from "../src/core/editor-pos.ts";

test("advancePos same-line append moves ch only", () => {
  assert.deepEqual(advancePos({ line: 2, ch: 5 }, "hello"), { line: 2, ch: 10 });
});

test("advancePos multi-line append moves to last line's length", () => {
  assert.deepEqual(advancePos({ line: 2, ch: 5 }, "a\nbb\nccc"), { line: 4, ch: 3 });
});

test("advancePos append starting mid-line ending on a new line", () => {
  assert.deepEqual(advancePos({ line: 0, ch: 7 }, "end.\n"), { line: 1, ch: 0 });
});

test("advancePos empty string is a no-op", () => {
  assert.deepEqual(advancePos({ line: 3, ch: 4 }, ""), { line: 3, ch: 4 });
});
