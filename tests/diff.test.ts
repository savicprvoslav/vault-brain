import { test } from "node:test";
import assert from "node:assert/strict";
import { lineDiff } from "../src/core/diff.ts";

test("marks added/removed/same lines", () => {
  assert.deepEqual(lineDiff("a\nb\nc", "a\nx\nc"), [
    { type: "same", text: "a" },
    { type: "del", text: "b" },
    { type: "add", text: "x" },
    { type: "same", text: "c" },
  ]);
});
test("identical text is all same", () => {
  assert.deepEqual(lineDiff("a\nb", "a\nb"), [
    { type: "same", text: "a" },
    { type: "same", text: "b" },
  ]);
});
test("appended line", () => {
  assert.deepEqual(lineDiff("a", "a\nb"), [
    { type: "same", text: "a" },
    { type: "add", text: "b" },
  ]);
});
