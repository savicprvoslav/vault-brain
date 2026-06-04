import { test } from "node:test";
import assert from "node:assert/strict";
import { linkMentions } from "../src/core/autolink.ts";

test("links the first plain mention of an existing title", () => {
  assert.equal(linkMentions("See Project Plan and Project Plan again.", ["Project Plan"]), "See [[Project Plan]] and Project Plan again.");
});
test("does not double-link an already-linked title", () => {
  assert.equal(linkMentions("See [[Project Plan]] here.", ["Project Plan"]), "See [[Project Plan]] here.");
});
test("ignores very short titles", () => {
  assert.equal(linkMentions("a b c", ["a"]), "a b c");
});
