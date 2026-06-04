import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVoiceMessages, buildMeetingMessages } from "../src/core/voice-prompt.ts";

test("builds a user message with instruction + audio part", () => {
  const msgs = buildVoiceMessages("AUDIOB64");
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, "user");
  assert.equal(msgs[0].parts[0].type, "text");
  assert.deepEqual(msgs[0].parts[1], { type: "audio", format: "wav", dataB64: "AUDIOB64" });
});

test("buildMeetingMessages: diarized instruction + audio part", () => {
  const m = buildMeetingMessages("B64");
  assert.equal(m[0].role, "user");
  assert.match(m[0].parts[0].type === "text" ? m[0].parts[0].text : "", /Speaker/i);
  assert.deepEqual(m[0].parts[1], { type: "audio", format: "wav", dataB64: "B64" });
});
