import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaProvider } from "../src/core/ollama-provider.ts";

const host = "http://127.0.0.1";
const port = 11434;

// Discover an installed gemma4 model so the contract test isn't tied to a specific tag.
async function installedGemma(): Promise<string | null> {
  try {
    const r = await fetch(`${host}:${port}/api/tags`);
    if (!r.ok) return null;
    const d = (await r.json()) as { models?: { name: string }[] };
    return (d.models ?? []).map((m) => m.name).find((n) => n.startsWith("gemma4:")) ?? null;
  } catch {
    return null;
  }
}

const gemma = await installedGemma();

test("streams tokens from local Ollama", { skip: !gemma }, async () => {
  const p = new OllamaProvider({ host, port, model: gemma as string });
  const tokens: string[] = [];
  const out = await p.chatStream(
    [{ role: "user", parts: [{ type: "text", text: "Reply with the single word: ok" }] }],
    { signal: new AbortController().signal, onToken: (t) => tokens.push(t) }
  );
  assert.ok(tokens.length >= 1, "should receive at least one token");
  assert.ok(out.toLowerCase().includes("ok"));
});

test("the installed gemma4 reports audio + vision capabilities", { skip: !gemma }, async () => {
  const p = new OllamaProvider({ host, port, model: gemma as string });
  const caps = await p.showCapabilities(gemma as string);
  assert.ok(caps.includes("audio") && caps.includes("vision"), `caps were: ${caps.join(",")}`);
});

test("embeds text with nomic-embed-text", { skip: !gemma }, async () => {
  const p = new OllamaProvider({ host, port, model: gemma as string });
  const vecs = await p.embed("nomic-embed-text:latest", ["hello world"]);
  assert.equal(vecs.length, 1);
  assert.equal(vecs[0].length, 768);
});
