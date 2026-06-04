import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHealth } from "../src/core/health.ts";
import type { LlmProvider } from "../src/core/provider.ts";

function stub(over: Partial<LlmProvider>): LlmProvider {
  return {
    chatStream: async () => "",
    listModels: async () => [],
    showCapabilities: async () => [],
    embed: async () => [],
    ...over,
  };
}

test("server down when listModels throws", async () => {
  const s = await checkHealth(stub({ listModels: async () => { throw new Error("ECONNREFUSED"); } }), "gemma4:latest");
  assert.equal(s.server, "down");
  assert.equal(s.model, "unknown");
});

test("model missing when not in list", async () => {
  const s = await checkHealth(stub({ listModels: async () => ["other:latest"] }), "gemma4:latest");
  assert.equal(s.server, "up");
  assert.equal(s.model, "missing");
});

test("ready with caps when present", async () => {
  const s = await checkHealth(
    stub({ listModels: async () => ["gemma4:latest"], showCapabilities: async () => ["audio", "vision"] }),
    "gemma4:latest"
  );
  assert.equal(s.server, "up");
  assert.equal(s.model, "ready");
  assert.deepEqual(s.caps, ["audio", "vision"]);
});
