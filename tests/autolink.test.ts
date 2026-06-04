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
test("links a plain mention even when an unrelated link precedes it", () => {
  assert.equal(linkMentions("[[Other]] then Project Plan.", ["Project Plan"]), "[[Other]] then [[Project Plan]].");
});
test("prefers the longer title when both match", () => {
  assert.equal(linkMentions("Project Plan here", ["Plan", "Project Plan"]), "[[Project Plan]] here");
});
test("links titles containing special characters", () => {
  assert.equal(linkMentions("I use C++ daily", ["C++"]), "I use [[C++]] daily");
});
