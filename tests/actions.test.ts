import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, buildActionMessages, getAction } from "../src/core/actions.ts";

test("summarize inserts below, others replace", () => {
  assert.equal(getAction("summarize").mode, "below");
  for (const id of ["improve", "format", "translate", "grammar"] as const) {
    assert.equal(getAction(id).mode, "replace");
  }
});

test("there are 5 actions with unique ids", () => {
  assert.equal(ACTIONS.length, 5);
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, 5);
});

test("buildActionMessages = system instruction + user selection", () => {
  const msgs = buildActionMessages("summarize", "the text");
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[1].parts[0].type === "text" ? msgs[1].parts[0].text : "", "the text");
});

test("translate instruction mentions both languages", () => {
  const msgs = buildActionMessages("translate", "zdravo");
  const sys = msgs[0].parts[0].type === "text" ? msgs[0].parts[0].text : "";
  assert.match(sys, /Serbian/i);
  assert.match(sys, /English/i);
});
