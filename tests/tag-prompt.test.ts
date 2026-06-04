import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTagMessages, parseTags } from "../src/core/tag-prompt.ts";

test("buildTagMessages carries the note", () => {
  const m = buildTagMessages("my note");
  assert.equal(m.length, 2);
  assert.equal(m[1].parts[0].type === "text" ? m[1].parts[0].text : "", "my note");
});
test("parseTags normalizes and caps", () => {
  assert.deepEqual(parseTags("#Project Management, AI, ai"), ["project-management", "ai"]);
  assert.equal(parseTags("a,b,c,d,e,f,g,h,i").length, 7);
});
