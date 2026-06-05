import { test } from "node:test";
import assert from "node:assert/strict";
import { setupSteps, setupComplete } from "../src/core/setup.ts";

test("all present -> all steps ok and complete", () => {
  const steps = setupSteps({ server: true, chatModel: true, embedModel: true }, "gemma4:latest", "nomic-embed-text:latest");
  assert.ok(steps.every((s) => s.ok));
  assert.equal(setupComplete({ server: true, chatModel: true, embedModel: true }), true);
});
test("missing server -> not complete, server step has a fix link", () => {
  const steps = setupSteps({ server: false, chatModel: false, embedModel: false }, "m", "e");
  assert.equal(steps[0].ok, false);
  assert.equal(steps[0].action, "link");
  assert.ok(steps[0].fix);
  assert.equal(setupComplete({ server: false, chatModel: false, embedModel: false }), false);
});
test("embed is optional: server + chat present counts as complete", () => {
  assert.equal(setupComplete({ server: true, chatModel: true, embedModel: false }), true);
  const steps = setupSteps({ server: true, chatModel: true, embedModel: false }, "m", "e");
  assert.equal(steps[2].ok, false);
  assert.equal(steps[2].action, "pull");
  assert.equal(steps[2].target, "e");
});
