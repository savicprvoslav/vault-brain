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
