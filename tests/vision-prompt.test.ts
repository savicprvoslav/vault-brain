import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVisionMessages } from "../src/core/vision-prompt.ts";

test("builds a single user message with text + image parts", () => {
  const msgs = buildVisionMessages("image/png", "B64DATA");
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, "user");
  const parts = msgs[0].parts;
  assert.equal(parts[0].type, "text");
  assert.deepEqual(parts[1], { type: "image", mime: "image/png", dataB64: "B64DATA" });
});
