import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaProvider } from "../src/core/ollama-provider.ts";

const cfg = { host: "http://127.0.0.1", port: 11434, model: "gemma4:latest" };

async function ollamaUp(): Promise<boolean> {
  try {
    const r = await fetch(`${cfg.host}:${cfg.port}/api/tags`);
    return r.ok;
  } catch {
    return false;
  }
}

test("streams tokens from local Ollama", { skip: !(await ollamaUp()) }, async () => {
  const p = new OllamaProvider(cfg);
  const tokens: string[] = [];
  const out = await p.chatStream(
    [{ role: "user", parts: [{ type: "text", text: "Reply with the single word: ok" }] }],
    { signal: new AbortController().signal, onToken: (t) => tokens.push(t) }
  );
  assert.ok(tokens.length >= 1, "should receive at least one token");
  assert.ok(out.toLowerCase().includes("ok"));
});

test("lists models and gemma4:latest has audio+vision", { skip: !(await ollamaUp()) }, async () => {
  const p = new OllamaProvider(cfg);
  const models = await p.listModels();
  assert.ok(models.includes("gemma4:latest"));
  const caps = await p.showCapabilities("gemma4:latest");
  assert.ok(caps.includes("audio") && caps.includes("vision"), `caps were: ${caps.join(",")}`);
});
