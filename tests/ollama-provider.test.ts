import { test } from "node:test";
import assert from "node:assert/strict";
import { partToOpenAi, buildChatRequest, parseSseLine } from "../src/core/ollama-provider.ts";

test("partToOpenAi maps text", () => {
  assert.deepEqual(partToOpenAi({ type: "text", text: "hi" }), { type: "text", text: "hi" });
});

test("partToOpenAi maps audio -> input_audio", () => {
  assert.deepEqual(
    partToOpenAi({ type: "audio", format: "wav", dataB64: "AAA" }),
    { type: "input_audio", input_audio: { data: "AAA", format: "wav" } }
  );
});

test("partToOpenAi maps image -> image_url data URL", () => {
  assert.deepEqual(
    partToOpenAi({ type: "image", mime: "image/png", dataB64: "AAA" }),
    { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }
  );
});

test("buildChatRequest builds /v1 body", () => {
  const body = buildChatRequest("gemma4:latest", [{ role: "user", parts: [{ type: "text", text: "hi" }] }], true) as any;
  assert.equal(body.model, "gemma4:latest");
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages[0], { role: "user", content: [{ type: "text", text: "hi" }] });
});

test("parseSseLine extracts delta content", () => {
  assert.equal(parseSseLine('data: {"choices":[{"delta":{"content":"Hel"}}]}'), "Hel");
});

test("parseSseLine returns null on [DONE]", () => {
  assert.equal(parseSseLine("data: [DONE]"), null);
});

test("parseSseLine returns empty string for non-data / unparseable", () => {
  assert.equal(parseSseLine(": keep-alive"), "");
  assert.equal(parseSseLine("data: not-json"), "");
});
