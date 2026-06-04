import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoiceOutput } from "../src/core/voice-parse.ts";

test("splits the three sections", () => {
  const text = ["### TRANSCRIPT", "hello world", "", "### SUMMARY", "- point one", "", "### TASKS", "- [ ] call dentist"].join("\n");
  const r = parseVoiceOutput(text);
  assert.equal(r.transcript, "hello world");
  assert.match(r.summary, /point one/);
  assert.match(r.tasks, /\- \[ \] call dentist/);
});
test("falls back to transcript when no headers", () => {
  const r = parseVoiceOutput("just a raw transcript");
  assert.equal(r.transcript, "just a raw transcript");
  assert.equal(r.summary, "");
  assert.equal(r.tasks, "");
});

test("handles a missing transcript section", () => {
  const text = "### SUMMARY\n- s1\n\n### TASKS\n- [ ] t1";
  const r = parseVoiceOutput(text);
  assert.equal(r.transcript, "");
  assert.match(r.summary, /s1/);
  assert.match(r.tasks, /t1/);
});
