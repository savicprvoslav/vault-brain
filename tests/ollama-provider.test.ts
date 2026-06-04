import { test } from "node:test";
import assert from "node:assert/strict";
import { partToOpenAi, buildChatRequest, parseSseLine, OllamaProvider } from "../src/core/ollama-provider.ts";

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
  const body = buildChatRequest("gemma4:latest", [{ role: "user", parts: [{ type: "text", text: "hi" }] }], true);
  assert.equal(body.model, "gemma4:latest");
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages[0], { role: "user", content: [{ type: "text", text: "hi" }] });
});

test("parseSseLine extracts delta content", () => {
  assert.equal(parseSseLine('data: {"choices":[{"delta":{"content":"Hel"}}]}'), "Hel");
});

test("parseSseLine handles data: with no space", () => {
  assert.equal(parseSseLine('data:{"choices":[{"delta":{"content":"x"}}]}'), "x");
});

test("parseSseLine returns null on [DONE]", () => {
  assert.equal(parseSseLine("data: [DONE]"), null);
});

test("parseSseLine returns empty string for non-data / unparseable", () => {
  assert.equal(parseSseLine(": keep-alive"), "");
  assert.equal(parseSseLine("data: not-json"), "");
});

function streamResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

test("chatStream reassembles multi-chunk SSE and flushes final line without [DONE]", async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
    'data: {"choices":[{"delta":{"content":"lo wor',
    'ld"}}]}\n',
    'data: {"choices":[{"delta":{"content":"!"}}]}',
  ];
  const fakeFetch = (async () => streamResponse(chunks)) as unknown as typeof fetch;
  const p = new OllamaProvider({ host: "http://x", port: 1, model: "m" }, fakeFetch);
  const toks: string[] = [];
  const out = await p.chatStream(
    [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
    { signal: new AbortController().signal, onToken: (t) => toks.push(t) }
  );
  assert.equal(out, "Hello world!");
  assert.deepEqual(toks, ["Hel", "lo world", "!"]);
});

test("chatStream stops at [DONE] and ignores trailing data", async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"done"}}]}\n',
    "data: [DONE]\n",
    'data: {"choices":[{"delta":{"content":"IGNORED"}}]}\n',
  ];
  const fakeFetch = (async () => streamResponse(chunks)) as unknown as typeof fetch;
  const p = new OllamaProvider({ host: "http://x", port: 1, model: "m" }, fakeFetch);
  const out = await p.chatStream(
    [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
    { signal: new AbortController().signal, onToken: () => {} }
  );
  assert.equal(out, "done");
});

test("chatStream throws on non-OK response", async () => {
  const fakeFetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
  const p = new OllamaProvider({ host: "http://x", port: 1, model: "m" }, fakeFetch);
  await assert.rejects(
    () => p.chatStream([{ role: "user", parts: [{ type: "text", text: "hi" }] }], { signal: new AbortController().signal, onToken: () => {} }),
    /HTTP 500/
  );
});
