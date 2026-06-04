import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContinueMessages } from "../src/core/continue-prompt.ts";

test("carries the preceding text as the user message", () => {
  const m = buildContinueMessages("Once upon a time");
  assert.equal(m.length, 2);
  assert.equal(m[0].role, "system");
  assert.equal(m[1].role, "user");
  assert.equal(m[1].parts[0].type === "text" ? m[1].parts[0].text : "", "Once upon a time");
});
