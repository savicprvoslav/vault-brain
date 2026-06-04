import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStatus } from "../src/core/status-bar.ts";

test("server down -> red + how to start", () => {
  const v = renderStatus({ server: "down", model: "unknown", caps: [] }, "gemma4:latest");
  assert.match(v.text, /🔴/);
  assert.match(v.tooltip, /ollama serve/);
});

test("model missing -> yellow + pull command", () => {
  const v = renderStatus({ server: "up", model: "missing", caps: [] }, "gemma4:latest");
  assert.match(v.text, /🟡/);
  assert.match(v.tooltip, /ollama pull gemma4:latest/);
});

test("ready -> green", () => {
  const v = renderStatus({ server: "up", model: "ready", caps: ["audio", "vision"] }, "gemma4:latest");
  assert.match(v.text, /🟢/);
  assert.match(v.tooltip, /Ready/);
});
