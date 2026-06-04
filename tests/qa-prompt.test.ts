import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQaMessages } from "../src/core/qa-prompt.ts";

test("system carries context, ends with the question", () => {
  const msgs = buildQaMessages("CTX-HERE", [], "What is X?");
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].parts[0].type === "text" ? msgs[0].parts[0].text : "", /CTX-HERE/);
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[1].parts[0].type === "text" ? msgs[1].parts[0].text : "", "What is X?");
});

test("includes prior turns in order", () => {
  const msgs = buildQaMessages("CTX", [{ role: "user", text: "Q1" }, { role: "assistant", text: "A1" }], "Q2");
  assert.equal(msgs.length, 4);
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[2].role, "assistant");
  assert.equal(msgs[3].role, "user");
});
