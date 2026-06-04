import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStatus } from "../src/core/status-bar.ts";

test("server down -> red + how to start (tooltip + click)", () => {
  const v = renderStatus({ server: "down", model: "unknown", caps: [] }, "gemma4:latest");
  assert.match(v.text, /🔴/);
  assert.match(v.tooltip, /ollama serve/);
  assert.match(v.click, /ollama serve/);
});

test("model missing -> yellow + pull command in click", () => {
  const v = renderStatus({ server: "up", model: "missing", caps: [] }, "gemma4:latest");
  assert.match(v.text, /🟡/);
  assert.match(v.click, /ollama pull gemma4:latest/);
});

test("ready -> green with caps", () => {
  const v = renderStatus({ server: "up", model: "ready", caps: ["audio", "vision"] }, "gemma4:latest");
  assert.match(v.text, /🟢/);
  assert.match(v.click, /ready/i);
  assert.match(v.click, /audio, vision/);
});
