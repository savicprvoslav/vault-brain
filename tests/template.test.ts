import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/core/template.ts";

test("replaces known placeholders", () => {
  assert.equal(render("{{a}} and {{b}}", { a: "1", b: "2" }), "1 and 2");
});
test("unknown placeholder becomes empty string", () => {
  assert.equal(render("x {{missing}} y", {}), "x  y");
});
test("leaves text without placeholders unchanged", () => {
  assert.equal(render("plain text", { a: "1" }), "plain text");
});
