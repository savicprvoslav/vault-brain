import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings, DEFAULT_SETTINGS } from "../src/core/settings-model.ts";

test("empty/undefined/null -> all defaults", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test("coerces string port and clamps invalid", () => {
  assert.equal(normalizeSettings({ port: "11434" as unknown as number }).port, 11434);
  assert.equal(normalizeSettings({ port: -1 }).port, DEFAULT_SETTINGS.port);
  assert.equal(normalizeSettings({ port: 0 }).port, DEFAULT_SETTINGS.port);
  assert.equal(normalizeSettings({ port: 70000 }).port, DEFAULT_SETTINGS.port);
});

test("invalid enums fall back", () => {
  assert.equal(normalizeSettings({ dailyNoteMode: "bogus" as unknown as "append" }).dailyNoteMode, "append");
  assert.equal(normalizeSettings({ outputLanguage: "fr" as unknown as "auto" }).outputLanguage, "auto");
});

test("preserves valid overrides", () => {
  const s = normalizeSettings({ host: "http://localhost", model: "gemma4:12b-mlx", contextTokenCap: 4000, keepAlive: true });
  assert.equal(s.host, "http://localhost");
  assert.equal(s.model, "gemma4:12b-mlx");
  assert.equal(s.contextTokenCap, 4000);
  assert.equal(s.keepAlive, true);
});

test("blank host/model fall back to defaults", () => {
  assert.equal(normalizeSettings({ host: "  " }).host, DEFAULT_SETTINGS.host);
  assert.equal(normalizeSettings({ model: "" }).model, DEFAULT_SETTINGS.model);
});
test("preserves and clamps the newer fields", () => {
  const s = normalizeSettings({ embedModel: "x", ragTopK: 100, micDeviceId: "mic1", customPrompts: "A :: b", watchFolder: "Rec" });
  assert.equal(s.embedModel, "x");
  assert.equal(s.ragTopK, DEFAULT_SETTINGS.ragTopK); // 100 > 50 -> falls back to default
  assert.equal(s.micDeviceId, "mic1");
  assert.equal(s.customPrompts, "A :: b");
  assert.equal(s.watchFolder, "Rec");
  assert.equal(normalizeSettings({ ragTopK: 6 }).ragTopK, 6);
});
