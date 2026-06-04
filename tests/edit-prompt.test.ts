import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEditMessages } from "../src/core/edit-prompt.ts";

test("carries the note in system and the instruction as the user message", () => {
  const m = buildEditMessages("hello world", "replace hello with hi");
  assert.equal(m.length, 2);
  assert.equal(m[0].role, "system");
  assert.match(m[0].parts[0].type === "text" ? m[0].parts[0].text : "", /hello world/);
  assert.equal(m[1].role, "user");
  assert.equal(m[1].parts[0].type === "text" ? m[1].parts[0].text : "", "replace hello with hi");
});
